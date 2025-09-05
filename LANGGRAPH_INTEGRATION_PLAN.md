# LangChain/LangGraph Integration Plan
## PMO Playbook AI System Modernization

---

## 📊 Status Dashboard

| Phase | Status | Progress | Notes |
|-------|--------|----------|--------|
| **Phase 1: Dependencies & Setup** | ✅ Complete | 4/4 | All packages installed, build successful |
| **Phase 2: Core LangGraph Workflow** | ⏳ Pending | 0/6 | Core migration work |
| **Phase 3: Database Enhancement (pgvector)** | ⏳ Pending | 0/3 | Requires pgvector setup |
| **Phase 4: Vector Store Integration** | ⏳ Pending | 0/4 | SOP semantic search |
| **Phase 5: Enhanced Features** | ⏳ Pending | 0/5 | Advanced capabilities |
| **Phase 6: Testing & Deployment** | ⏳ Pending | 0/4 | Validation and rollout |

**Overall Progress**: 4/26 tasks completed (15%)

**Current Focus**: Phase 2 - Core LangGraph Workflow

## 📝 How to Use This Document & Track Progress

### Progress Tracking Instructions
1. **Check off completed tasks** by changing `- [ ]` to `- [x]` in the markdown
2. **Update phase status** in the Status Dashboard:
   - ⏳ Pending → 🔄 In Progress → ✅ Complete
3. **Update progress counts** (e.g., "2/4" when 2 out of 4 tasks done)
4. **Add notes** in the "Notes" column for important context
5. **Update "Overall Progress"** count and percentage
6. **Move "Current Focus"** to the next active phase

### Status Icons Reference
- ⏳ **Pending**: Not started yet
- 🔄 **In Progress**: Currently working on this phase  
- ✅ **Complete**: Phase finished and validated
- ❌ **Blocked**: Cannot proceed (add details in Notes)
- ⚠️ **Issues**: Problems encountered (add details in Notes)

### Example Progress Update
```markdown
| **Phase 1: Dependencies & Setup** | ✅ Complete | 4/4 | All packages installed successfully |
| **Phase 2: Core LangGraph Workflow** | 🔄 In Progress | 2/6 | Working on node implementation |
```

### Chat Session Continuity
- **Before starting work**: Read this entire document to understand current state
- **When resuming**: Check Status Dashboard and Current Focus
- **After each session**: Update completed tasks and add notes
- **Major decisions**: Add to Decision Log section
- **Issues encountered**: Document in relevant phase notes

---

## 🏗️ Current Architecture Analysis

### Existing AI Processing Flow
```
POST /api/chat → 
  ChatHistory.findBySessionId() →
  processQuery() in unified-query-processor.ts →
    analyzeSopsWithXML() →
    generateUnifiedAnswer() →
  ChatHistory.addMessage() →
  Return structured response
```

### Key Files in Current System
- **`/src/lib/unified-query-processor.ts`** - Main processing pipeline
- **`/src/app/api/chat/route.ts`** - API endpoint
- **`/src/lib/ai-config.ts`** - Configuration management
- **`/src/models/HumanSOP.ts`** - SOP database model
- **`/src/models/ChatHistory.ts`** - Conversation persistence
- **`ai-system.yaml`** - System configuration
- **`ai-prompts.yaml`** - Prompt templates

### Current Processing Phases
1. **Query Analysis** - Parse user intent and extract key topics
2. **SOP Assessment** - Analyze SOPs for relevance and coverage
3. **Coverage Evaluation** - Determine response strategy based on confidence
4. **Response Synthesis** - Generate final markdown answer

### Confidence Thresholds
- **High Coverage**: ≥ 70% confidence → Full answer
- **Medium Coverage**: 40-69% confidence → Partial answer + gap acknowledgment
- **Low Coverage**: < 40% confidence → Escape hatch

---

## 🎯 Target Architecture with LangChain/LangGraph

### LangGraph Workflow Design
```
Entry → Query Analysis Node → SOP Assessment Node → 
  Coverage Evaluation Node → Response Synthesis Node → Exit
    ↓ (conditional routing based on confidence)
Fact-checking Node ← Source Validation Node ← Follow-up Generation Node
```

### New Components to Add
1. **State Management**: Unified state object with checkpointing
2. **Vector Store**: pgvector integration for semantic SOP search
3. **Memory System**: ConversationSummaryBufferMemory
4. **Enhanced Nodes**: Fact-checking, source validation, follow-up generation
5. **Monitoring**: LangSmith integration for debugging and tracing

### Database Enhancement
- **Keep PostgreSQL as primary storage**
- **Add pgvector extension** for semantic search
- **Hybrid approach**: SQL for structured data, vectors for similarity

---

## 📋 Implementation Plan

### Phase 1: Dependencies & Setup
**Estimated Time**: 2-3 hours

- [x] **Task 1.1**: Install core LangChain packages
  - `@langchain/core`
  - `@langchain/langgraph` 
  - `@langchain/openai`
  - `@langchain/community`
  - Note: `@langchain/postgres` doesn't exist, using community package instead
  
- [x] **Task 1.2**: Install additional dependencies
  - `pgvector` ✅ v0.2.1
  - `langsmith` ✅ v0.3.67
  - `redis` ✅ v5.8.2
  
- [x] **Task 1.3**: Update package.json scripts
  - Added langgraph:migrate script
  - Added embeddings:generate and embeddings:update scripts
  - Added vector:setup and langsmith:test scripts
  
- [x] **Task 1.4**: Environment configuration
  - Added LANGCHAIN_API_KEY (placeholder - needs real key)
  - Added LANGCHAIN_PROJECT=pmo-playbook
  - Added feature flags for gradual migration
  - Added Redis URL configuration

**Acceptance Criteria**: All dependencies installed, environment configured, no build errors

---

### Phase 2: Core LangGraph Workflow
**Estimated Time**: 6-8 hours

- [ ] **Task 2.1**: Define state schema (`src/lib/langgraph/state.ts`)
  ```typescript
  interface WorkflowState {
    query: string;
    conversationContext: ChatMessage[];
    sopReferences: SOPReference[];
    coverageAnalysis: CoverageAnalysis;
    confidence: number;
    response: string;
    metadata: ProcessingMetadata;
  }
  ```

- [ ] **Task 2.2**: Create base nodes (`src/lib/langgraph/nodes/`)
  - `queryAnalysisNode.ts` - Replace XML parsing logic
  - `sopAssessmentNode.ts` - Enhanced SOP evaluation
  - `coverageEvaluationNode.ts` - Coverage determination
  - `responseSynthesisNode.ts` - Final answer generation

- [ ] **Task 2.3**: Implement enhanced nodes
  - `factCheckingNode.ts` - Validate SOP information
  - `sourceValidationNode.ts` - Cross-reference SOPs
  - `followUpGenerationNode.ts` - Suggest clarifying questions

- [ ] **Task 2.4**: Build workflow graph (`src/lib/langgraph/workflow.ts`)
  - Define node connections and edges
  - Implement conditional routing logic
  - Add confidence-based decision points

- [ ] **Task 2.5**: Add checkpointing and persistence
  - Implement state checkpointing
  - Add workflow resume capabilities
  - Connect to existing session management

- [ ] **Task 2.6**: Create LangGraph processor (`src/lib/langgraph-processor.ts`)
  - Replace unified-query-processor.ts functionality
  - Maintain backward compatibility
  - Add feature flag for gradual migration

**Acceptance Criteria**: LangGraph workflow processes queries correctly, maintains state, supports checkpointing

---

### Phase 3: Database Enhancement (pgvector)
**Estimated Time**: 3-4 hours

- [ ] **Task 3.1**: Set up pgvector extension
  - Enable pgvector in PostgreSQL
  - Create migration script for vector columns
  - Add embedding columns to HumanSOP table
  
- [ ] **Task 3.2**: SOP embedding generation
  - Create script to generate embeddings for existing SOPs
  - Implement incremental embedding updates
  - Add embedding generation to SOP creation workflow
  
- [ ] **Task 3.3**: Vector similarity search implementation
  - Create vector search functions
  - Implement hybrid search (SQL + semantic)
  - Add similarity scoring mechanisms

**Acceptance Criteria**: pgvector enabled, SOPs have embeddings, semantic search working

---

### Phase 4: Vector Store Integration
**Estimated Time**: 4-5 hours

- [ ] **Task 4.1**: Implement LangChain vector store (`src/lib/langchain/vectorstore.ts`)
  - Set up PGVector integration
  - Configure embedding model (text-embedding-3-small)
  - Implement document loading from SOPs

- [ ] **Task 4.2**: Document management (`src/lib/langchain/documents.ts`)
  - Create SOP document loaders
  - Implement text chunking strategies
  - Add metadata extraction (SOP ID, sections, confidence)

- [ ] **Task 4.3**: Hybrid search implementation
  - Combine keyword search (existing) with semantic search
  - Implement search result ranking
  - Add search result deduplication

- [ ] **Task 4.4**: Update SOP assessment node
  - Replace direct database queries with vector search
  - Maintain confidence scoring
  - Preserve XML analysis structure for compatibility

**Acceptance Criteria**: Vector search improves SOP retrieval, hybrid search works, performance is maintained

---

### Phase 5: Enhanced Features & Monitoring
**Estimated Time**: 5-6 hours

- [ ] **Task 5.1**: Memory system implementation (`src/lib/langchain/memory.ts`)
  - Set up ConversationSummaryBufferMemory
  - Integrate with existing ChatHistory model
  - Implement entity memory for project tracking

- [ ] **Task 5.2**: LangSmith integration
  - Set up tracing for all workflow nodes
  - Add custom callbacks for logging
  - Implement performance metrics collection

- [ ] **Task 5.3**: Caching layer (Redis)
  - Cache frequent SOP queries
  - Implement embedding caching
  - Add cache invalidation for updated SOPs

- [ ] **Task 5.4**: Streaming support
  - Add streaming response capability
  - Update API endpoints for real-time responses
  - Maintain compatibility with existing UI

- [ ] **Task 5.5**: Advanced routing and error handling
  - Implement fallback chains for errors
  - Add retry logic with exponential backoff
  - Create circuit breaker for external dependencies

**Acceptance Criteria**: Memory system works, LangSmith provides insights, caching improves performance, streaming functional

---

### Phase 6: Testing, Migration & Deployment
**Estimated Time**: 4-6 hours

- [ ] **Task 6.1**: Comprehensive testing suite
  - Unit tests for all new components
  - Integration tests for workflow
  - Performance benchmarking against current system

- [ ] **Task 6.2**: Parallel processing validation
  - Run both old and new systems side-by-side
  - Compare response quality and accuracy
  - Validate response times and token usage

- [ ] **Task 6.3**: Feature flag implementation
  - Create gradual rollout mechanism
  - Add A/B testing capability
  - Implement rollback procedures

- [ ] **Task 6.4**: Documentation and training
  - Update API documentation
  - Create troubleshooting guides
  - Document new configuration options

**Acceptance Criteria**: Tests pass, parallel validation successful, rollout plan ready

---

## 🔧 Technical Specifications

### Dependencies
```json
{
  "@langchain/core": "^0.2.27",
  "@langchain/langgraph": "^0.0.34",
  "@langchain/openai": "^0.2.7",
  "@langchain/community": "^0.2.28",
  "@langchain/postgres": "^0.0.8",
  "langsmith": "^0.1.39",
  "pgvector": "^0.1.8",
  "redis": "^4.6.13"
}
```

### File Structure (New Components)
```
src/
├── lib/
│   ├── langgraph/
│   │   ├── state.ts                 # State schema definition
│   │   ├── workflow.ts              # Main workflow graph
│   │   └── nodes/
│   │       ├── queryAnalysisNode.ts
│   │       ├── sopAssessmentNode.ts
│   │       ├── coverageEvaluationNode.ts
│   │       ├── responseSynthesisNode.ts
│   │       ├── factCheckingNode.ts
│   │       ├── sourceValidationNode.ts
│   │       └── followUpGenerationNode.ts
│   ├── langchain/
│   │   ├── vectorstore.ts           # PGVector integration
│   │   ├── documents.ts             # Document loaders
│   │   └── memory.ts                # Memory systems
│   └── langgraph-processor.ts       # New processor (replaces unified-query-processor.ts)
```

### Environment Variables
```bash
# LangChain/LangSmith
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=pmo-playbook
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# Feature flags
ENABLE_LANGGRAPH_PROCESSOR=false  # For gradual migration
```

### Configuration Updates
```yaml
# ai-system.yaml additions
langgraph:
  enable_checkpointing: true
  enable_streaming: false
  node_timeout: 30000
  max_iterations: 10
  
vector_search:
  embedding_model: "text-embedding-3-small"
  similarity_threshold: 0.75
  max_results: 5
  hybrid_weight: 0.7  # 70% semantic, 30% keyword

memory:
  type: "conversation_summary_buffer"
  max_token_limit: 2000
  summary_model: "gpt-4o-mini"
```

---

## 🔄 Migration Strategy

### Phase-by-Phase Rollout
1. **Proof of Concept** (Phase 1-2): Set up infrastructure, validate pgvector
2. **Core Migration** (Phase 3-4): Replace processing pipeline, maintain compatibility
3. **Enhanced Features** (Phase 5): Add advanced capabilities gradually
4. **Full Deployment** (Phase 6): Complete migration with monitoring

### Feature Flag Strategy
```typescript
// In api/chat/route.ts
const enableLangGraph = process.env.ENABLE_LANGGRAPH_PROCESSOR === 'true';
const processor = enableLangGraph 
  ? new LangGraphProcessor() 
  : { processQuery };  // Existing system
```

### Rollback Plan
- Keep existing `unified-query-processor.ts` intact
- Use feature flags to switch between systems
- Monitor error rates and response quality
- Automatic rollback triggers for high error rates

---

## ✅ Testing & Validation Plan

### Test Categories
1. **Unit Tests**: Individual node functionality
2. **Integration Tests**: Complete workflow testing
3. **Performance Tests**: Response time and token usage
4. **Regression Tests**: Ensure existing functionality maintained
5. **Load Tests**: System behavior under high traffic

### Success Metrics
- **Response Quality**: Maintain or improve current satisfaction scores
- **Response Time**: Stay within current SLA (< 5 seconds)
- **Token Efficiency**: Optimize token usage by 10-15%
- **Error Rate**: Keep below 2% for successful migrations

### A/B Testing Plan
- Split traffic 90/10 initially (old/new)
- Gradually increase to 50/50 based on metrics
- Full migration when new system shows 95% reliability

---

## 📝 Decision Log

### Key Decisions Made
1. **Database Choice**: Keep PostgreSQL + pgvector (not separate vector DB)
2. **Migration Strategy**: Gradual with feature flags (not complete rewrite)
3. **Memory System**: ConversationSummaryBufferMemory (fits conversation pattern)
4. **Monitoring**: LangSmith integration (production-ready debugging)
5. **State Management**: Shared state with checkpointing (enables resume)

### Trade-offs Considered
- **Complexity vs. Features**: Added complexity justified by improved capabilities
- **Performance vs. Features**: Vector search may add latency but improves accuracy
- **Migration Risk**: Gradual approach reduces risk but extends timeline
- **Infrastructure Cost**: pgvector cheaper than separate vector DB

---

## 📚 Additional Resources

### Documentation Links
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain PostgreSQL Integration](https://python.langchain.com/docs/integrations/vectorstores/pgvector)
- [pgvector Extension Guide](https://github.com/pgvector/pgvector)
- [LangSmith Monitoring](https://smith.langchain.com/)

### Code Examples Repository
- Create examples folder with sample implementations
- Include migration scripts and utilities
- Add troubleshooting common issues

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-05  
**Next Review**: After Phase 1 completion

---

*This document serves as the single source of truth for the LangChain/LangGraph integration project. Update progress checkboxes as tasks are completed and add notes in the decision log for any changes or issues encountered.*