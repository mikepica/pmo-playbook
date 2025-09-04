⏺ Example: Project Manager Query Processing Flow

  Scenario

  PM Question: "How should I handle scope creep when the client keeps
  requesting additional features mid-sprint?"

  File Structure & Processing Flow

  pmo_playbook/
  ├── ai-system.yaml           # System configuration
  ├── ai-prompts.yaml          # Prompt templates
  ├── src/
  │   ├── app/
  │   │   └── api/
  │   │       └── chat/
  │   │           └── route.ts # [1] Entry point - receives question
  │   ├── lib/
  │   │   ├── ai-config.ts    # [2] Loads configuration
  │   │   └── unified-query-processor.ts # [3] Main processing
  │   └── models/
  │       └── HumanSOP.ts      # [4] Fetches SOPs from database

  Step-by-Step Processing

⏺ 1. Request Reception (/api/chat/route.ts:9-22)

  // PM's question arrives via POST request
  {
    message: "How should I handle scope creep when the client keeps requesting additional features 
  mid-sprint?",
    sessionId: "session-1234567890-abc"
  }

  // Load conversation context from ChatHistory
  conversationContext = [
    { role: "user", content: "What's our sprint planning process?" },
    { role: "assistant", content: "According to SOP-102..." }
  ]

  2. Configuration Loading (ai-config.ts:109-151)

  # Loads from ai-system.yaml:
  processing:
    model: "gpt-4o"
    temperature: 0.3
    coverage_thresholds:
      high_confidence: 0.7
      medium_confidence: 0.4
      low_confidence: 0.4

  # Loads from ai-prompts.yaml:
  sop_analysis_xml: "Analyze the user's query..."
  answer_generation_unified: "Generate a clean markdown response..."

⏺ 3. Phase 1: SOP Analysis (unified-query-processor.ts:133-250)

  3a. Fetch all SOPs from database:
  // HumanSOP.getAllActiveSOPs() returns:
  [
    { sopId: "SOP-101", title: "Sprint Planning Guidelines", content: "..." },
    { sopId: "SOP-204", title: "Change Management Process", content: "..." },
    { sopId: "SOP-305", title: "Client Communication Standards", content: "..." },
    // ... more SOPs
  ]

  3b. Send to GPT-4o for XML analysis:
  // unified-query-processor.ts:180-203
  const prompt = `
  ${sop_analysis_xml_prompt}

  User Query: "How should I handle scope creep when the client keeps requesting additional features 
  mid-sprint?"

  Available SOPs:
  - SOP ID: SOP-101
    Title: "Sprint Planning Guidelines"
    Full Content: "Sprint planning involves... scope must be frozen during sprint..."
    
  - SOP ID: SOP-204
    Title: "Change Management Process"
    Full Content: "All changes must go through formal process... mid-sprint changes discouraged..."
    
  - SOP ID: SOP-305
    Title: "Client Communication Standards"
    Full Content: "Set clear expectations... document all requests..."
  `;

  3c. GPT-4o returns XML analysis:
  <query_processing>
    <query_analysis>
      <intent>How to manage scope creep and client feature requests during active sprints</intent>
      <key_topics>scope creep, client requests, sprint management, change control</key_topics>
      <specificity_level>High - specific scenario about mid-sprint changes</specificity_level>
    </query_analysis>

    <sop_assessment>
      <sop id="SOP-204" confidence="0.85">
        <relevant_sections>Section 3.2 Mid-Sprint Changes, Section 4.1 Change Request
  Process</relevant_sections>
        <key_points>Formal change process required, Changes logged in backlog, Sprint scope
  protection</key_points>
        <applicability>Directly addresses scope change management process</applicability>
      </sop>

      <sop id="SOP-101" confidence="0.72">
        <relevant_sections>Section 2.4 Sprint Commitment, Section 5.1 Scope Definition</relevant_sections>
        <key_points>Sprint scope frozen after planning, Changes deferred to next sprint</key_points>
        <applicability>Provides sprint protection guidelines</applicability>
      </sop>

      <sop id="SOP-305" confidence="0.68">
        <relevant_sections>Section 3.1 Expectation Setting, Section 4.2 Request
  Documentation</relevant_sections>
        <key_points>Clear communication protocols, Document all requests, Educate clients on
  process</key_points>
        <applicability>Supports client communication aspect</applicability>
      </sop>
    </sop_assessment>

    <coverage_evaluation>
      <overall_confidence>0.82</overall_confidence>
      <coverage_level>high</coverage_level>
      <gaps>Specific escalation procedures for persistent clients</gaps>
      <response_strategy>full_answer</response_strategy>
    </coverage_evaluation>
  </query_processing>

⏺ 4. Phase 2: Answer Generation (unified-query-processor.ts:252-364)

  4a. Parse XML results:
  // Extracted data structure:
  sopReferences = [
    {
      sopId: "SOP-204",
      title: "Change Management Process",
      confidence: 0.85,
      sections: ["Section 3.2 Mid-Sprint Changes", "Section 4.1 Change Request Process"],
      keyPoints: ["Formal change process required", "Changes logged in backlog", "Sprint scope protection"]
    },
    {
      sopId: "SOP-101",
      title: "Sprint Planning Guidelines",
      confidence: 0.72,
      sections: ["Section 2.4 Sprint Commitment", "Section 5.1 Scope Definition"],
      keyPoints: ["Sprint scope frozen after planning", "Changes deferred to next sprint"]
    },
    {
      sopId: "SOP-305",
      title: "Client Communication Standards",
      confidence: 0.68,
      sections: ["Section 3.1 Expectation Setting", "Section 4.2 Request Documentation"],
      keyPoints: ["Clear communication protocols", "Document all requests", "Educate clients on process"]
    }
  ]

  coverageAnalysis = {
    overallConfidence: 0.82,
    coverageLevel: 'high',
    responseStrategy: 'full_answer',
    gaps: ["Specific escalation procedures for persistent clients"]
  }

  4b. Generate final response (confidence ≥ 0.7 = full answer):
  // Send to GPT-4o with answer_generation_unified prompt:
  const prompt = `
  Generate a clean markdown response based on HIGH COVERAGE (82% confidence).
  Provide comprehensive answer with inline citations.

  User Query: "How should I handle scope creep..."
  Available SOP Content: [full SOP content loaded]
  `;

  5. Final Response Returned to User

  Based on our Change Management Process and Sprint Planning Guidelines, here's how to handle scope creep when
   clients request additional features mid-sprint:

  ## Immediate Actions

  **1. Acknowledge and Document** [SOP-305, Section: 4.2, 68%]
  Document every feature request immediately in your project management tool. This creates a paper trail and
  shows the client you're taking their input seriously.

  **2. Invoke the Change Management Process** [SOP-204, Section: 3.2, 85%]
  Our formal change process requires that all mid-sprint changes go through proper evaluation:
  - Log the request in the product backlog
  - Assess impact on current sprint goals
  - Calculate effort and timeline implications

  ## Sprint Protection Protocol

  **3. Maintain Sprint Integrity** [SOP-101, Section: 2.4, 72%]
  Once sprint planning is complete, the scope is frozen. Explain to the client that:
  - Current sprint commitments cannot be altered
  - New features will be prioritized for the next sprint
  - This ensures delivery of committed work

  **4. Client Communication** [SOP-305, Section: 3.1, 68%]
  Set clear expectations by:
  - Explaining the sprint methodology and why changes disrupt team velocity
  - Offering to schedule a meeting to discuss the request for next sprint planning
  - Providing visibility into when their request could be addressed

  ## Recommended Response Template

  "I understand this feature is important. Per our change management process [SOP-204, Section: 4.1, 85%],
  I've documented your request in our backlog. We'll evaluate it during our next sprint planning session on
  [date]. This protects our ability to deliver the features we've already committed to this sprint."

  *Note: While our SOPs provide strong guidance, specific escalation procedures for persistently demanding 
  clients may need additional documentation.*

  6. Response Packaging (/api/chat/route.ts:49-162)

  // Final API response:
  {
    response: "[The markdown answer above]",
    sessionId: "session-1234567890-abc",
    attribution: {
      selectedSOP: { sopId: "SOP-204", title: "Change Management Process" },
      confidence: 0.82,
      responseStrategy: "full_answer",
      coverageLevel: "high",
      sopSources: [
        { sopId: "SOP-204", confidence: 0.85, sections: [...], keyPoints: [...] },
        { sopId: "SOP-101", confidence: 0.72, sections: [...], keyPoints: [...] },
        { sopId: "SOP-305", confidence: 0.68, sections: [...], keyPoints: [...] }
      ],
      gaps: ["Specific escalation procedures for persistent clients"],
      queryIntent: "How to manage scope creep and client feature requests during active sprints",
      keyTopics: ["scope creep", "client requests", "sprint management", "change control"],
      processingTime: 3247,
      tokensUsed: 2150
    }
  }

  Summary of Processing Flow

  1. Request arrives → /api/chat/route.ts
  2. Load config → ai-config.ts reads YAML files
  3. Fetch SOPs → HumanSOP.ts queries database
  4. Analyze with XML → GPT-4o evaluates relevance & coverage
  5. Parse results → Extract confidence & gaps
  6. Generate answer → GPT-4o creates response based on coverage level
  7. Save to history → ChatHistory.ts persists conversation
  8. Return response → With full attribution and confidence metrics

  The entire process typically takes 2-4 seconds, using ~2000-3000 tokens total.