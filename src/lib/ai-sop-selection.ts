import OpenAI from 'openai';
import { AgentSOP } from '@/models/AgentSOP';

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

    // Format SOPs for AI analysis with enhanced context
    const sopList = sopSummaries.map(sop => 
      `- sopId: ${sop.sopId}
   title: "${sop.title}" 
   phase: ${sop.phase}
   summary: "${sop.summary}"
   key_activities: "${sop.keyActivities?.slice(0, 3).join(', ') || 'N/A'}"
   deliverables: "${sop.deliverables?.slice(0, 3).join(', ') || 'N/A'}"
   keywords: "${sop.keywords?.join(', ') || 'N/A'}"`
    ).join('\n\n');

    const prompt = `You are an expert PMO assistant with extensive project management knowledge. A user has asked: "${userQuery}"

Based on the following available Standard Operating Procedures (SOPs), determine which one is most relevant to answer the question, OR if none adequately address the question, indicate this should be answered with general PM expertise.

Available SOPs:
${sopList}

Instructions:
1. Analyze the user's question to understand their specific intent and needs
2. Match it to the most appropriate SOP based on the phase, activities, deliverables, and keywords
3. Consider the full project lifecycle: Pre-Initiate → Initiate → Design & Plan → Implement & Control → Close & Realize Benefits
4. If no SOP adequately covers the question (confidence < 0.6), indicate this should be answered with general knowledge
5. Respond with ONLY a JSON object in this format:
{
  "selectedSopId": "SOP-XXX" | "GENERAL_PM_KNOWLEDGE",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this SOP was selected or why general knowledge is more appropriate"
}

Use "GENERAL_PM_KNOWLEDGE" if the question is better answered with general project management expertise rather than a specific SOP.
The confidence should be a number between 0 and 1, where 1 means you're completely certain about your selection.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert PMO consultant. Your goal is to help users with project management questions. You have access to company SOPs but can also provide general PM expertise when SOPs don\'t fully address the question. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Still consistent but less rigid
      max_tokens: 300
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
      
      // Handle general PM knowledge selection
      if (result.selectedSopId === 'GENERAL_PM_KNOWLEDGE') {
        // Ensure confidence is within bounds
        result.confidence = Math.max(0, Math.min(1, result.confidence));
        return result;
      }

      // Validate the selected SOP exists
      const selectedSOP = sopSummaries.find(sop => sop.sopId === result.selectedSopId);
      if (!selectedSOP) {
        throw new Error(`Selected SOP ${result.selectedSopId} not found in available SOPs`);
      }

      // Ensure confidence is within bounds
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      return result;
    } catch {
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
    const fullSOP = await AgentSOP.findBySopId(selectedSopId);
    if (!fullSOP) {
      throw new Error(`SOP ${selectedSopId} not found or not active`);
    }

    // Generate AI context from the SOP
    const sopContext = AgentSOP.generateAIContext(fullSOP);

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
6. Respond in JSON format:

{
  "answer": "Your detailed response here"
}`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a senior PMO consultant with deep project management expertise. Use the provided SOP as your primary source, but supplement with general PM knowledge when appropriate. Be practical and actionable. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5, // More natural responses
      max_tokens: 2000
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
        sourceInfo: {
          sopId: fullSOP.sopId,
          title: fullSOP.title,
          phase: fullSOP.phase
        }
      };
    } catch {
      throw new Error(`Failed to parse AI answer response as JSON: ${content}`);
    }

  } catch (error) {
    console.error('Error in generateAnswer:', error);
    throw error;
  }
}

/**
 * Generate answer using general PM knowledge when no SOP is appropriate
 */
export async function generateGeneralAnswer(
  userQuery: string,
  conversationContext?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<AnswerGenerationResult> {
  try {
    // Build conversation context if provided
    let conversationHistory = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationHistory = '\n\nConversation History (for context only):\n' + 
        conversationContext.slice(-4).map(msg => // Only include last 4 messages
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n') + '\n';
    }

    const prompt = `You are a senior PMO consultant with over 15 years of experience in project management across various industries. You have expertise in PMI standards, PRINCE2, Agile/Scrum, and organizational change management.

A user has asked you a project management question that doesn't require specific company SOPs but needs your general expertise.${conversationHistory}

User's Current Question: "${userQuery}"

Instructions:
1. Consider the conversation context (if any) to provide relevant follow-up responses
2. Provide practical, actionable project management advice based on industry best practices
3. Draw from PMI PMBOK, PRINCE2, Agile principles, and real-world experience
4. Include specific steps, frameworks, or methodologies when appropriate
5. If relevant, mention common tools, templates, or approaches (but be general, not company-specific)
6. Be conversational yet professional - like speaking to a colleague
7. Respond in JSON format:

{
  "answer": "Your detailed response here"
}`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a senior PMO consultant with deep project management expertise. Provide practical, actionable advice based on industry best practices and standards. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6, // Higher temperature for more natural, creative responses
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI for general answer generation');
    }

    try {
      // Clean and parse the JSON response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const aiResponse = JSON.parse(cleanContent);
      
      return {
        answer: aiResponse.answer,
        sourceInfo: {
          sopId: 'GENERAL_PM_KNOWLEDGE',
          title: 'General PM Expertise',
          phase: 0 // Indicates general knowledge, not phase-specific
        }
      };
    } catch {
      throw new Error(`Failed to parse AI general answer response as JSON: ${content}`);
    }

  } catch (error) {
    console.error('Error in generateGeneralAnswer:', error);
    throw error;
  }
}