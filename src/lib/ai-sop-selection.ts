import OpenAI from 'openai';
import AgentSOP from '@/models/AgentSOP';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  return openai;
}

export interface SOPSelectionResult {
  selectedSopId: string;
  confidence: number;
  reasoning: string;
}

export interface AnswerGenerationResult {
  answer: string;
  suggestedChange?: {
    section: string;
    change: string;
    rationale: string;
  };
  sourceInfo: {
    sopId: string;
    title: string;
    phase: number;
  };
}

/**
 * Step A: Tool Selection - Analyze user query and select the most relevant SOP
 */
export async function selectBestSOP(userQuery: string): Promise<SOPSelectionResult> {
  try {
    // Get all SOP summaries from the database
    const sopSummaries = await AgentSOP.getAllSummaries();
    
    if (sopSummaries.length === 0) {
      throw new Error('No SOPs available in database');
    }

    // Format SOPs for AI analysis
    const sopList = sopSummaries.map(sop => 
      `- sopId: ${sop.sopId}, title: "${sop.title}", phase: ${sop.phase}, summary: "${sop.summary}"`
    ).join('\n');

    const prompt = `You are a helpful PMO assistant with expertise in project management. A user has asked: "${userQuery}"

Based on the following available Standard Operating Procedures (SOPs), which one is the most relevant to answer the question? 

Available SOPs:
${sopList}

Instructions:
1. Analyze the user's question to understand their intent and needs
2. Match it to the most appropriate SOP based on the phase and content
3. Consider the project lifecycle: Pre-Initiate → Initiate → Design & Plan → Implement & Control → Close & Realize Benefits
4. Respond with ONLY a JSON object in this format:
{
  "selectedSopId": "SOP-XXX",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this SOP was selected"
}

The confidence should be a number between 0 and 1, where 1 means you're completely certain this is the right SOP.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a project management expert that selects the most relevant SOP for user questions. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Low temperature for consistent selection
      max_tokens: 200
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean and parse the JSON response (handle code blocks)
    try {
      let cleanContent = content.trim();
      // Remove markdown code block wrapper if present
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent) as SOPSelectionResult;
      
      // Validate the selected SOP exists
      const selectedSOP = sopSummaries.find(sop => sop.sopId === result.selectedSopId);
      if (!selectedSOP) {
        throw new Error(`Selected SOP ${result.selectedSopId} not found in available SOPs`);
      }

      // Ensure confidence is within bounds
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      return result;
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${content}`);
    }

  } catch (error) {
    console.error('Error in selectBestSOP:', error);
    
    // Fallback: Return first SOP with low confidence
    const sopSummaries = await AgentSOP.getAllSummaries();
    if (sopSummaries.length > 0) {
      return {
        selectedSopId: sopSummaries[0].sopId,
        confidence: 0.1,
        reasoning: 'Fallback selection due to error in AI processing'
      };
    }
    
    throw error;
  }
}

/**
 * Step B: Answer Generation - Use selected SOP to generate a detailed response
 */
export async function generateAnswer(
  userQuery: string, 
  selectedSopId: string,
  conversationContext?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<AnswerGenerationResult> {
  try {
    // Get the full SOP content
    const fullSOP = await AgentSOP.findOne({ sopId: selectedSopId, isActive: true });
    if (!fullSOP) {
      throw new Error(`SOP ${selectedSopId} not found or not active`);
    }

    // Generate AI context from the SOP
    const sopContext = fullSOP.generateAIContext();

    // Build conversation context if provided
    let conversationHistory = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationHistory = '\n\nConversation History (for context only):\n' + 
        conversationContext.slice(-4).map(msg => // Only include last 4 messages
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n') + '\n';
    }

    const prompt = `You are a PMO assistant helping with project management questions. Use the information from the following Standard Operating Procedure to answer the user's question comprehensively and accurately.

SOP Information:
Title: ${sopContext.title}
Phase: ${sopContext.phase}
Summary: ${sopContext.summary}

Objectives:
${sopContext.sections.objectives.map(obj => `- ${obj}`).join('\n')}

Key Activities:
${sopContext.sections.keyActivities.map((activity, i) => `${i + 1}. ${activity}`).join('\n')}

Deliverables:
${sopContext.sections.deliverables.map(del => `- ${del}`).join('\n')}

Roles & Responsibilities:
${sopContext.sections.rolesResponsibilities.map(role => 
  `${role.role}:\n${role.responsibilities.map(resp => `  - ${resp}`).join('\n')}`
).join('\n\n')}

Tools & Templates:
${sopContext.sections.toolsTemplates.map(tool => `- ${tool}`).join('\n')}${conversationHistory}

User's Current Question: "${userQuery}"

Instructions:
1. Consider the conversation context (if any) to provide relevant follow-up responses
2. Provide a helpful, detailed answer based on the SOP information
3. Include specific steps, deliverables, or guidance from the SOP
4. If relevant templates or tools are mentioned, include them in your response
5. If the SOP doesn't fully address the question, acknowledge the limitation
6. After answering, analyze if the user's question highlights a gap or ambiguity in the SOP
7. Respond in JSON format:

{
  "answer": "Your detailed response here",
  "suggestedChange": {
    "section": "Section name if improvement needed",
    "change": "Specific improvement suggestion",
    "rationale": "Why this change would help"
  }
}

If no improvement is needed, set "suggestedChange" to null.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful PMO assistant. Provide accurate, actionable guidance based on SOPs. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Slightly higher for more natural responses
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI for answer generation');
    }

    try {
      // Clean and parse the JSON response (handle code blocks)
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const aiResponse = JSON.parse(cleanContent);
      
      return {
        answer: aiResponse.answer,
        suggestedChange: aiResponse.suggestedChange,
        sourceInfo: {
          sopId: fullSOP.sopId,
          title: fullSOP.title,
          phase: fullSOP.phase
        }
      };
    } catch (parseError) {
      throw new Error(`Failed to parse AI answer response as JSON: ${content}`);
    }

  } catch (error) {
    console.error('Error in generateAnswer:', error);
    throw error;
  }
}