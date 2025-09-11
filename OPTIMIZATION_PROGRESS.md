# Query Performance Optimization Progress

## Current Issue
- Query response time: 3+ minutes
- Target: < 30 seconds initially, < 10 seconds with full optimizations

## Optimization Implementation Plan

### Phase 1: In-Memory Caching for SOPs
**Status**: ✅ COMPLETED
**Approach**: 
- Implement lazy-loading singleton cache
- Load SOPs on first request, keep in memory
- Add cache invalidation on SOP updates
- Use summary + full content separation

**Implementation Steps**:
1. ✅ Create `/src/lib/sop-cache.ts` with SOP cache manager
2. ✅ Modify `sopAssessmentNode.ts` to use cached SOPs
3. ✅ Add cache invalidation hooks in `HumanSOP.ts`
4. ✅ Implement cache warming option on server startup

**Expected Impact**: 20-30% reduction in response time

#### 🛑 TESTING CHECKPOINT 1
Ready to test! Run these commands:
```bash
# Test the cache implementation
npm run cache:test

# Check cache stats via API (if server running)
curl http://localhost:3000/api/cache/stats

# Warm cache manually
npm run cache:warm
```

**Testing Steps**:
- [ ] Run `npm run cache:test` to verify cache performance
- [ ] Test a real query and observe cache hit logs
- [ ] Verify memory usage is reasonable (check `/api/cache/stats`)
- [ ] Benchmark: Record new response time vs baseline
- **Success Criteria**: Database calls eliminated after first request, 20%+ speed improvement

---

### Phase 2: Optimize Workflow Routing
**Status**: ✅ COMPLETED
**Approach**:
- Skip fact-checking, source validation, and follow-up generation for high-confidence queries
- Add early exit conditions in workflow
- Implement confidence-based routing thresholds

**Implementation Steps**:
1. ✅ Create configurable routing functions with confidence thresholds
2. ✅ Add early exit after SOP assessment for super high confidence (>0.9)
3. ✅ Optimize coverage evaluation routing:
   - confidence > 0.8 && gaps.length == 0 → skip to response synthesis
   - confidence < 0.3 → go directly to escape hatch
4. ✅ Make fact-checking, source validation, and follow-up generation selective
5. ✅ Add comprehensive configuration options for optimization levels

**Expected Impact**: 30-40% reduction for simple queries

#### 🛑 TESTING CHECKPOINT 2
Ready to test! Run these commands:
```bash
# Test the routing logic
npm run routing:test

# Test with real queries and observe routing decisions in logs
npm run dev
# Look for routing decision logs in console
```

**Testing Steps**:
- [ ] Run `npm run routing:test` to verify routing optimization logic
- [ ] Test high-confidence query and verify it skips extra nodes
- [ ] Test low-confidence query and verify escape hatch routing
- [ ] Check console logs for routing decision explanations
- [ ] Benchmark: Compare response times for different confidence levels
- **Success Criteria**: High-confidence queries skip 2-4 nodes, 30%+ speed improvement

---

### Phase 3: Parallel Processing
**Status**: ✅ COMPLETED
**Approach**:
- Run query analysis and SOP loading concurrently
- Batch process multiple SOPs in assessment when possible

**Implementation Steps**:
1. ✅ Create parallel processing utilities (`/src/lib/langgraph/parallel-utils.ts`)
2. ✅ Modify `queryAnalysisNode.ts` to support concurrent SOP loading
3. ✅ Update `sopAssessmentNode.ts` to use preloaded SOPs when available
4. ✅ Add parallel operation metadata tracking to workflow state
5. ✅ Implement configurable parallel processing with environment variables

**How Parallel Processing Works**:

**Sequential Flow (Before)**:
```
Query Analysis (2-3s) → Load SOPs (1-2s) → SOP Assessment (5-10s) → Coverage (2-3s) → Response (5-10s)
Total: ~15-25 seconds
```

**Parallel Flow (After)**:
```
[Query Analysis + Load SOPs] (2-3s total) → SOP Assessment (5-10s) → Coverage (2-3s) → Response (5-10s)
Total: ~12-18 seconds
```

**Key Features**:
- **Smart Preloading**: SOPs load during query analysis, data passed through state
- **Error Resilience**: If parallel SOP loading fails, falls back to sequential
- **Configurable**: Can be disabled with `ENABLE_PARALLEL_PROCESSING=false`
- **Timeout Protection**: Operations have timeouts to prevent hanging
- **Performance Tracking**: Logs parallel operation metrics

**Expected Impact**: 15-20% reduction in total time

#### 🛑 TESTING CHECKPOINT 3
Ready to test! Run these commands:
```bash
# Test parallel processing performance
npm run parallel:test

# Test with real queries and observe parallel execution logs
npm run dev
# Look for parallel processing logs like:
# 🚀 Parallel processing enabled - running query analysis and SOP loading concurrently
# ✅ Using preloaded SOPs from parallel processing
```

**Testing Steps**:
- [ ] Run `npm run parallel:test` to verify parallel processing performance
- [ ] Test real queries and verify parallel execution in logs
- [ ] Ensure no race conditions or data corruption
- [ ] Test error handling when one operation fails
- [ ] Benchmark: Compare response times with parallel processing on/off
- **Success Criteria**: 15% reduction from Phase 2 baseline, robust error handling

---

### Phase 4: Streaming Response
**Status**: ⏳ Pending
**Approach**:
- Implement Server-Sent Events (SSE) for streaming
- Stream response as it's generated from GPT

**Implementation Steps**:
1. Modify `/api/chat/route.ts` to support SSE:
   ```typescript
   // Create SSE stream
   const encoder = new TextEncoder();
   const stream = new ReadableStream({
     async start(controller) {
       // Stream implementation
     }
   });
   ```

2. Update `responseSynthesisNode.ts` to use streaming:
   ```typescript
   const stream = await llm.stream([
     { role: 'system', content: systemPrompt },
     { role: 'user', content: fullPrompt }
   ]);
   ```

3. Update client to handle streaming responses
4. Add progress indicators for better UX

**Expected Impact**: 50-70% improvement in perceived performance

#### 🛑 TESTING CHECKPOINT 4
- [ ] Verify first chunk arrives within 5 seconds
- [ ] Test stream interruption/error handling
- [ ] Ensure complete response matches non-streaming version
- [ ] Test with various response lengths
- [ ] Measure time to first byte (TTFB)
- [ ] Benchmark: Record perceived response time
- **Success Criteria**: User sees first response within 10s

---

## Performance Metrics Tracking

### Baseline (Before Optimizations)
| Metric | Time | Notes |
|--------|------|-------|
| Total Response Time | 3+ min | Full workflow execution |
| Query Analysis | 5-10s | Initial query processing |
| SOP Loading | 2-5s | Database fetch |
| SOP Assessment | 60-90s | Processing full content |
| Coverage Evaluation | 5-10s | Coverage analysis |
| Response Synthesis | 30-60s | Final answer generation |
| Additional Nodes | 20-30s | Fact checking, validation |

### After Each Phase

#### Phase 1 Results (Caching)
| Metric | Time | Improvement |
|--------|------|-------------|
| Total Response Time | TBD | TBD |
| SOP Loading | TBD | Expected: ~0s |

#### Phase 2 Results (Routing)
| Metric | Time | Improvement |
|--------|------|-------------|
| Total Response Time | TBD | TBD |
| Nodes Skipped | TBD | TBD |

#### Phase 3 Results (Parallel)
| Metric | Time | Improvement |
|--------|------|-------------|
| Total Response Time | TBD | TBD |
| Query + Load Time | TBD | TBD |

#### Phase 4 Results (Streaming)
| Metric | Time | Improvement |
|--------|------|-------------|
| Time to First Byte | TBD | TBD |
| Perceived Response | TBD | TBD |

---

## Rollback Plan

Each phase can be independently rolled back:

1. **Caching**: Set `ENABLE_SOP_CACHE=false` in environment
2. **Routing**: Revert workflow.ts to original routing logic
3. **Parallel**: Set `ENABLE_PARALLEL_PROCESSING=false`
4. **Streaming**: Revert to JSON response in API route

---

## Next Steps After Each Phase

1. Run testing checkpoint
2. Record metrics in this document
3. If success criteria not met, debug and fix
4. If successful, commit changes and proceed to next phase
5. After all phases, run comprehensive performance test

---

## Notes
- Vector database implementation will be done separately later
- Each optimization should be feature-flagged for easy rollback
- Monitor memory usage after caching implementation
- Keep original code paths available for comparison