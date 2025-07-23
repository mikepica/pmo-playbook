# PMO Playbook SOP Management System - 10-Step Implementation Plan

## Instructions for Tracking Progress

After completing each step:
1. Run the verification tests listed in each step
2. Check off all items in the verification checklist
3. Once all verifications pass, mark the step as complete by changing `[ ]` to `[x]`
4. Commit your changes with a message like "Complete Step X: [Step Name]"
5. Only proceed to the next step after the current step is fully verified

## Implementation Checklist

- [x] Step 1: Database Setup and Data Models
- [x] Step 2: Import Existing SOPs into Database
- [x] Step 2.1: UI Consolidation and AI Preparation (Added)
- [x] Step 3: Enhance AI Integration for SOP Selection
- [x] Step 4: Implement Chat History and Memory
- [x] Step 5: Build Change Proposal System
- [x] Step 6: Create Admin Dashboard
- [x] Step 6.5: Simplify to User Feedback System (Updated)
- [ ] Step 7: Implement Proposal Approval Workflow
- [ ] Step 8: Enhance UI/UX and Add Features
- [ ] Step 9: Testing and Quality Assurance
- [ ] Step 10: Documentation and Deployment Preparation

## Overview
Transform the existing PMO Playbook Next.js application into an intelligent SOP management system with AI-powered assistance, change tracking, and admin approval workflows.

**Tech Stack:**
- Frontend: Next.js 15.3.5 with TypeScript and Tailwind CSS
- Backend: Next.js API Routes
- Database: MongoDB
- AI: OpenAI GPT-4o and o3
- Existing SOPs: 5 PMO phase markdown documents

---

## Step 1: Database Setup and Data Models ✅

### Tasks:
1. Install MongoDB dependencies
   ```bash
   npm install mongodb mongoose
   ```
2. Set up MongoDB connection in `src/lib/mongodb.ts`
3. Create Mongoose schemas:
   - `HumanSOP`: Store original markdown content
   - `AgentSOP`: Store processed JSON with metadata
   - `ChatHistory`: Track all interactions
   - `ChangeProposal`: Store suggested improvements
   - `User`: Basic user model (for future auth)

### File Structure:
```
src/
├── lib/
│   └── mongodb.ts
└── models/
    ├── HumanSOP.ts
    ├── AgentSOP.ts
    ├── ChatHistory.ts
    ├── ChangeProposal.ts
    └── User.ts
```

### Verification:
- [x] MongoDB connection successful (`npm run test-db` shows "Connected to MongoDB")
- [x] Test CRUD operations for each model using a test script (`npm run test-models`)
- [x] Verify data persistence across server restarts

**Status**: ✅ Completed on 2025-01-23
- All Mongoose schemas created and tested
- MongoDB Atlas connection established
- CRUD operations verified for all models
- Test script created: `scripts/test-models.ts`

---

## Step 2: Import Existing SOPs into Database ✅

### Tasks:
1. Create migration script `scripts/migrate-sops.ts`
2. Process existing markdown files:
   - Read each file from `content/markdown/`
   - Extract metadata (title, phase number, key sections)
   - Store as HumanSOP documents
3. Generate initial AgentSOPs:
   - Create structured JSON from markdown
   - Extract key activities, deliverables, tools
   - Add searchable metadata

### Data Structure Example:
```typescript
// HumanSOP
{
  sopId: "SOP-001",
  title: "Pre-Initiate Phase",
  markdownContent: "full markdown content...",
  version: 1,
  createdAt: Date,
  updatedAt: Date
}

// AgentSOP
{
  sopId: "SOP-001",
  title: "Pre-Initiate Phase",
  summary: "Guidelines for project pre-initiation...",
  sections: {
    objectives: [...],
    keyActivities: [...],
    deliverables: [...],
    tools: [...]
  },
  searchableContent: "concatenated searchable text",
  humanSopId: "reference to HumanSOP"
}
```

### Verification:
- [x] All 5 SOPs imported successfully
- [x] MongoDB contains 5 HumanSOP documents
- [x] MongoDB contains 5 corresponding AgentSOP documents
- [x] Can query and retrieve SOPs by ID

**Status**: ✅ Completed on 2025-01-23
- Migration script created and executed successfully
- All 5 SOPs processed and stored in MongoDB
- Both HumanSOP and AgentSOP collections populated
- Database queries tested and verified working
- SOP retrieval API endpoints functional

---

## Step 2.1: UI Consolidation and AI Preparation ✅

### Tasks:
1. Remove manual SOP selection UI components
2. Eliminate quick prompt system
3. Consolidate to single MongoDB-powered interface
4. Create AI-ready chat interface
5. Prepare SOP attribution framework

### Verification:
- [x] Mode toggle removed, single interface active
- [x] Checkboxes removed from SOP tabs - view only
- [x] Quick prompts eliminated from codebase
- [x] Chat interface ready for automatic SOP selection
- [x] All content sourced from MongoDB

**Status**: ✅ Completed on 2025-01-23
- UI consolidated to single AI-powered interface
- Manual SOP selection removed
- Application ready for automatic AI selection
- Clean architecture prepared for Step 3 implementation

---

## Step 3: Enhance AI Integration for SOP Selection ✅

### Tasks:
1. Update `/api/chat/route.ts` to implement two-step process:
   - Tool Selection: Analyze user query against all AgentSOPs
   - Answer Generation: Use selected SOP to generate response
2. Create utility functions:
   - `selectBestSOP()`: Use GPT-4o to match query to SOP
   - `generateAnswer()`: Create response using SOP content
   - `extractChangeProposal()`: Identify gaps in SOPs
3. Implement streaming responses for better UX

### API Flow:
```typescript
// Step A: Tool Selection
const sopSummaries = await AgentSOP.find({}, 'sopId title summary');
const selectedSopId = await selectBestSOP(userQuery, sopSummaries);

// Step B: Answer Generation
const fullSOP = await AgentSOP.findOne({ sopId: selectedSopId });
const { answer, suggestedChange } = await generateAnswer(userQuery, fullSOP);
```

### Verification:
- [x] Chat endpoint successfully selects appropriate SOP
- [x] Responses accurately reflect SOP content
- [x] Test with queries for each of the 5 phases
- [x] Streaming responses work smoothly

**Status**: ✅ Completed on 2025-01-23
- Two-step AI process implemented: tool selection + answer generation
- GPT-4o integration for intelligent SOP selection
- Streaming responses implemented for improved user experience
- Comprehensive testing completed across all 5 PMO phases
- AI accurately matches user queries to appropriate SOPs
- Response quality validated with SOP content accuracy

---

## Step 4: Implement Chat History and Memory ✅

### Tasks:
1. ✅ Create API endpoint `/api/chat-history/`
2. ✅ Store every interaction:
   - User query
   - Selected SOP
   - Generated answer
   - Timestamp
   - Session ID
3. ✅ Update chat UI to show conversation history
4. ✅ Add session management (using cookies/localStorage)

### Implementation Details:

#### API Endpoints Created:
- **GET `/api/chat-history?sessionId=xxx`**: Retrieves conversation history for a session
- **POST `/api/chat-history`**: Manually add messages to history (if needed)
- **PATCH `/api/chat-history?limit=N`**: Get active sessions for admin/debugging

#### Session Management:
- **localStorage Integration**: Session IDs stored persistently in browser
- **Unique Session IDs**: Format `session-{timestamp}-{random}`
- **Automatic Session Creation**: New sessions created when none exists
- **Manual Session Reset**: "New Conversation" button for fresh starts

#### Context-Aware AI:
- **Conversation Context**: Last 4 messages passed to AI for context
- **Enhanced Prompts**: AI considers conversation history when generating responses
- **Memory Across Interactions**: Follow-up questions reference previous exchanges

#### UI Enhancements:
- **Loading States**: Shows spinner while retrieving chat history
- **History Restoration**: Messages reload on page refresh
- **New Conversation Button**: Appears when messages exist, allows fresh start
- **Session Indicators**: Clear visual feedback during session initialization

### Features Implemented:
- ✅ Persistent chat sessions across page refreshes
- ✅ Full conversation history retrieval and display
- ✅ Context awareness within sessions (AI remembers previous exchanges)
- ✅ Isolated sessions with unique identifiers
- ✅ Graceful fallback when history loading fails
- ✅ Clean session reset functionality

### Code Changes:
1. **Updated `src/lib/ai-sop-selection.ts`**:
   - Added `conversationContext` parameter to `generateAnswer()`
   - Enhanced AI prompts to include conversation history
   - Context limited to last 4 messages to prevent token bloat

2. **Updated `src/app/api/chat/route.ts`**:
   - Added conversation context retrieval from existing chat history
   - Integrated context into AI answer generation process

3. **Enhanced `src/components/ChatInterfaceAI.tsx`**:
   - Added session management with localStorage persistence
   - Implemented history loading on component initialization
   - Added "New Conversation" button with proper state management
   - Enhanced loading states and error handling

4. **Utilized existing `src/app/api/chat-history/route.ts`**:
   - Leveraged existing GET endpoint for history retrieval
   - Proper error handling and session isolation

### Verification Results:
- ✅ Chat history persists after page refresh - **VERIFIED**
- ✅ Can retrieve full conversation history - **VERIFIED**
- ✅ Sessions properly isolated - **VERIFIED**
- ✅ Database stores all required fields - **VERIFIED**
- ✅ Context-aware responses work correctly - **VERIFIED**
- ✅ New conversation functionality works - **VERIFIED**

**Status**: ✅ Completed on 2025-01-23
- Full chat history and memory system implemented
- Session management with browser persistence
- Context-aware AI responses enhance conversation flow
- Clean UI with proper loading states and session management
- Database integration for persistent conversation storage

### Step 4.1: Enhanced Session Management (Added - Advanced Feature)

**Additional Implementation**: Saved Chat Threads with Comprehensive Session Management

#### Features Added:
- **Session Dropdown**: "Recent Chats" dropdown showing last 20 conversations
- **AI Summarization**: Auto-generated 3-5 word summaries using GPT-4o-mini  
- **Session Switching**: Click to load any previous conversation with auto-save
- **Session Renaming**: Click edit button to rename conversations (Enter/Escape shortcuts)
- **Right-Click Delete**: Context menu to delete conversations with confirmation
- **Smart Ordering**: Sessions ordered by last activity/viewing time
- **Session Persistence**: `lastActive` timestamp updates on every interaction

#### Technical Implementation:
- **New API Endpoint**: `/api/sessions` with GET/PATCH/DELETE operations
- **Database Schema Updates**: Added `sessionName`, `summary`, `lastActive` fields
- **UI Components**: Advanced dropdown with edit/delete functionality  
- **Auto-Save Logic**: Sessions update `lastActive` on every view/interaction
- **AI Integration**: Automatic conversation topic summarization

#### User Experience Improvements:
- Sessions display format: "Project Charter Creation • 5 messages • 2h ago"
- Current session highlighted in blue background
- Smooth dropdown with click-outside-to-close behavior
- Inline editing with keyboard shortcuts
- Intelligent time formatting (just now, 2h ago, 3d ago, date)

**Status**: ✅ Completed on 2025-01-23
- Fulfilled missing "review past conversations" requirement from original Step 4
- Advanced session management beyond original scope
- AI-powered conversation summarization for improved user experience

- Ready for Step 5: Build Change Proposal System

---

## Step 5: Build Change Proposal System ✅

### Tasks:
1. ✅ Enhance answer generation to detect gaps
2. ✅ Create `ChangeProposal` when gaps identified:
   ```typescript
   {
     sopId: "SOP-001",
     originalSection: "Key Activities",
     suggestedChange: "Add section about stakeholder communication",
     triggerQuery: "How do I communicate with stakeholders?",
     conversationContext: {...},
     status: "pending_review",
     createdAt: Date
   }
   ```
3. ✅ Create API endpoint `/api/proposals/` for CRUD operations
4. ✅ Auto-generate proposals during chat interactions

### Implementation Details:

#### API Endpoints Created:
- **GET `/api/proposals`**: List all proposals with filtering (status, priority, sopId)
- **POST `/api/proposals`**: Create new proposal with duplicate detection
- **GET `/api/proposals/[id]`**: Get individual proposal details
- **PATCH `/api/proposals/[id]`**: Update proposal (approve/reject/review)
- **DELETE `/api/proposals/[id]`**: Archive proposal

#### Change Proposal Features:
- **Automatic Gap Detection**: AI analyzes if SOP fully addresses user question
- **Smart Duplicate Prevention**: Checks for similar proposals in last 24 hours
- **Metric Tracking**: Updates affected user count instead of creating duplicates
- **Priority Auto-Assignment**: Based on confidence score and affected users
- **Change Type Classification**: Automatically determines addition/modification/deletion/clarification
- **Context Preservation**: Stores conversation history with proposals

#### Integration with Chat System:
1. **AI Gap Detection**: In `generateAnswer()`, AI identifies when SOP lacks information
2. **Proposal Generation**: Chat API automatically creates proposals when gaps detected
3. **HumanSOP Linking**: Properly links proposals to source SOP documents
4. **Session Context**: Includes last 5 messages for proposal context

### Code Changes:
1. **Created `/api/proposals/route.ts`**:
   - Full CRUD operations for change proposals
   - Duplicate detection logic
   - Tag extraction for better organization
   - Pagination support

2. **Created `/api/proposals/[id]/route.ts`**:
   - Individual proposal management
   - Approval/rejection workflow
   - Review history tracking

3. **Enhanced `/api/chat/route.ts`**:
   - Integrated proposal creation with chat flow
   - Added duplicate checking before creating new proposals
   - Implemented change type determination logic
   - Proper humanSopId resolution from AgentSOP

4. **Added User-Initiated Gap Reporting** (Advanced from Step 8):
   - **Report Gap Button**: Appears on AI responses for user feedback
   - **Gap Description Modal**: Users explain what information was missing
   - **High-Priority Proposals**: User reports create 90% confidence proposals
   - **Context Preservation**: Includes conversation context for admin review

5. **Updated `src/components/ChatInterfaceAI.tsx`**:
   - Added "Report Gap" button on AI responses
   - Implemented gap reporting modal with description field
   - Integrated with proposals API for user-initiated submissions
   - Added confirmation message after successful report

6. **Created test scripts**:
   - `scripts/test-proposals.ts`: API testing suite
   - `scripts/check-proposals.ts`: Database verification tool

### Verification:
- ✅ Proposals created when SOPs lack information - **AI identifies gaps and creates proposals**
- ✅ Proposals include sufficient context - **Stores trigger query, conversation history, and rationale**
- ✅ Can query proposals by status - **API supports filtering by status, priority, and sopId**
- ✅ No duplicate proposals for same issue - **24-hour duplicate detection with metric updates**
- ✅ User-initiated gap reporting - **Manual feedback mechanism implemented ahead of schedule**

### Key Features Beyond Original Scope:
- **User Feedback Integration**: Implemented manual change proposal submission from Step 8
- **Two-Pronged Gap Detection**: Both AI automatic and user-initiated reporting
- **Enhanced User Experience**: Users can explain exactly what information was missing
- **Higher Priority for User Reports**: 90% confidence for user-reported gaps

**Status**: ✅ Completed on 2025-01-23
- Full change proposal system with both automatic and manual gap detection
- User-initiated gap reporting added (advanced from Step 8)
- Smart duplicate prevention ensures efficient proposal management
- API endpoints ready for admin dashboard integration
- Proposals generated both automatically and through user feedback
- Priority auto-assignment based on impact metrics and report source
- Ready for Step 6: Create Admin Dashboard

---

## Step 6: Create Admin Dashboard

### Tasks:
1. Create new route `/admin` with basic layout
2. Build components:
   - `ProposalList`: Show all pending proposals
   - `ProposalReview`: Side-by-side diff view
   - `SOPEditor`: Edit markdown with preview
3. Implement review actions:
   - Approve: Update HumanSOP and regenerate AgentSOP
   - Reject: Mark proposal as rejected
   - Request more info: Add comments

### UI Structure:
```
/admin
├── Sidebar (navigation)
├── Main Content Area
│   ├── Proposal List (filterable)
│   └── Detail View (split screen)
└── Action Buttons
```

### Implementation Details:

#### Admin Routes Created:
- **`/admin`**: Main dashboard with proposal management
- **`/admin/sops`**: SOP management and editing interface
- **`/admin/layout.tsx`**: Shared layout with navigation sidebar

#### Components Built:
- **`ProposalList`**: Filterable list showing pending/approved/rejected proposals
- **`ProposalReview`**: Side-by-side diff view with approval/rejection actions
- **`SOPEditor`**: Full markdown editor with live preview and save functionality

#### Key Features Implemented:
- **Proposal Management**: Filter by status, view details, approve/reject with comments
- **Side-by-Side Diff**: Clear visualization of original vs proposed content
- **SOP Editing**: Full markdown editor with edit/preview toggle
- **Responsive Design**: Professional admin interface with proper navigation
- **Action Workflow**: Approve/reject proposals with admin comments and context

#### API Enhancements:
- **Enhanced `/api/content-db`**: Added PUT method for SOP updates and GET all SOPs
- **Utilized `/api/proposals/[id]`**: PATCH method for proposal approval/rejection workflow

#### Admin Interface Features:
- **Navigation Sidebar**: Easy access to proposals, SOPs, analytics, users
- **Filter System**: Quick filtering by proposal status with counts
- **Edit Modes**: Toggle between view and edit for SOPs with unsaved changes indicator
- **Professional UI**: Clean, responsive design suitable for administrative tasks

### Verification:
- ✅ Admin dashboard loads at `/admin` - **Professional interface with sidebar navigation**
- ✅ All pending proposals visible - **Filterable list with status indicators and metadata**
- ✅ Diff view clearly shows changes - **Side-by-side comparison with color coding**
- ✅ Approve/reject buttons functional - **Full workflow with comments and status updates**
- ✅ SOP editing works - **Markdown editor with preview and save functionality**

**Status**: ✅ Completed on 2025-01-23
- Full admin dashboard implemented with proposal and SOP management
- Professional interface for reviewing and acting on change proposals
- Complete SOP editing capability with markdown support
- Workflow actions for proposal approval/rejection with admin comments
- Responsive design suitable for administrative tasks
- Ready for Step 6.5: Simplify to User Feedback System

---

## Step 6.5: Simplify to User Feedback System

### Overview
Transform the current Change Proposal system into a streamlined User Feedback system that focuses exclusively on user-reported gaps, with simplified workflow and clear visibility into conversation context.

### Tasks:
1. **Phase 1: Cleanup & Removal**
   - Remove AI-generated proposal logic from chat API
   - Remove `suggestedChange` detection from AI response generation
   - Clean up automatic proposal creation workflow

2. **Phase 2: Database & Model Updates**
   - Create new `UserFeedback` model (replace ChangeProposal for user reports)
   - Simplify status to: `pending`, `ongoing`, `closed`
   - Default priority to `medium` with admin adjustment options
   - Capture specific message context and AI suggestions

3. **Phase 3: Admin Interface Updates**
   - Rename "Change Proposals" → "User Feedback" in navigation
   - Create `FeedbackList` component with status filtering
   - Create `FeedbackDetail` component showing conversation context
   - Remove approval/rejection workflow - replace with status management

4. **Phase 4: Enhanced Context Display** 
   - Show user question, AI response, and user feedback clearly
   - Display SOP context with section used
   - Add "View Full SOP" and "View Conversation Thread" buttons
   - Implement chat thread modal with message highlighting

5. **Phase 5: API Restructuring**
   - Create `/api/user-feedback` endpoints
   - Create `/api/sessions/[sessionId]/thread` for conversation viewing
   - Update user gap reporting to capture message IDs and full context

### New User Feedback Model:
```typescript
UserFeedback {
  feedbackId: string
  sessionId: string
  messageId: string        // Which AI response was flagged
  
  // Context
  userQuestion: string     // Question that preceded the response
  aiResponse: string       // Full AI response that didn't help
  userComment: string      // User's description of what's missing
  
  // SOP Info  
  sopId: string
  sopTitle: string
  sopSection: string       // Specific section used for response
  confidence: number       // AI confidence in SOP selection
  
  // AI Suggestion (generated when admin views)
  aiSuggestion: {
    content: string        // What AI recommends adding
    rationale: string      // Why this improvement is needed
  }
  
  // Management
  status: 'pending' | 'ongoing' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high'  // Default: medium
  
  createdAt: Date
  updatedAt: Date
}
```

### Admin Interface Layout:
```
[User Feedback #xxx]                          [Status: Pending ▼] [Priority: Medium ▼]

📝 User Question:
"How do I handle budget overruns during project execution?"

🤖 AI Response (95% confidence):
[The actual response that didn't help the user]

💬 User Feedback:
"This doesn't explain what to do when the overrun exceeds 20%"

📚 SOP Context:
Phase 3 - Design & Plan > Budget Management
[View Full SOP] [View Conversation Thread]

🔧 AI Recommendation:
Consider adding a subsection on "Handling Significant Budget Overruns"...
```

### Integration with Future Steps:
- **Step 7**: Focus only on SOP version management and AgentSOP regeneration
- **Step 8**: User feedback analytics and improved conversation export
- **Manage SOPs**: Admins reference feedback while editing SOPs manually

### Verification:
- [x] AI-generated proposals removed from system - **VERIFIED**
- [x] User feedback creates simplified entries with full context - **VERIFIED**
- [x] Admin can filter by status (pending/ongoing/closed) and adjust priority - **VERIFIED**
- [x] Conversation thread modal shows full context with highlighted messages - **VERIFIED**
- [x] SOP context clearly shows section used for AI response - **VERIFIED**
- [x] User "Report Gap" flow captures all required context - **VERIFIED**

**Status**: ✅ Completed on 2025-01-23 (Updated with completed status)

### Implementation Summary:

#### Phase 1: Cleanup & Removal ✅
- **Removed AI-generated proposal logic** from `/api/chat/route.ts`
- **Eliminated `suggestedChange` detection** from AI response generation in `ai-sop-selection.ts`
- **Cleaned up automatic proposal creation** workflow in chat system
- **Preserved chat functionality** while removing proposal generation

#### Phase 2: Database & Model Updates ✅
- **Created new UserFeedback model** (`src/models/UserFeedback.ts`)
- **Status workflow**: `pending` → `ongoing` → `completed` → `closed`
- **Priority system**: `low` | `medium` (default) | `high`
- **Full context capture**: sessionId, messageId, userQuestion, aiResponse, userComment
- **AI suggestion generation**: On-demand when admin reviews feedback
- **Automatic metrics**: Confidence scores, timestamps, SOP attribution

#### Phase 3: API Infrastructure ✅
- **Created `/api/user-feedback` endpoints** (GET, POST)
- **Created `/api/user-feedback/[id]` endpoints** (GET, PATCH, DELETE)
- **Created `/api/sessions/[sessionId]/thread`** for conversation viewing
- **Status counts aggregation** for filter options
- **AI suggestion generation** using GPT-4o-mini for improvement recommendations

#### Phase 4: Admin Interface Components ✅
- **FeedbackList component**: Filterable list with status counts and priority indicators
- **FeedbackDetail component**: Full context display with status/priority management
- **ConversationModal component**: Complete chat thread with message highlighting
- **Main admin page**: `/admin/user-feedback` as primary interface
- **Responsive design** with proper loading states and error handling

#### Phase 5: User Experience Updates ✅
- **Updated gap reporting** in ChatInterfaceAI to use new User Feedback API
- **Maintained "Report Gap" button** functionality with improved context capture
- **Enhanced feedback confirmation** messages for better user experience
- **Preserved chat functionality** without disrupting existing user workflow

#### Phase 6: Navigation & Legacy System ✅
- **Updated admin navigation** with User Feedback as primary interface
- **Preserved legacy proposals** at `/admin/proposals` for historical reference
- **Added warning notices** about legacy system status
- **Redirected main admin route** to User Feedback system

### Key Features Implemented:

1. **Comprehensive Status Management**:
   - `pending`: Newly submitted feedback awaiting review
   - `ongoing`: Feedback being actively addressed by admin
   - `completed`: Issue resolved and SOP updated
   - `closed`: Feedback archived or deemed not actionable

2. **Full Conversation Context**:
   - Original user question preservation
   - Complete AI response capture
   - User feedback explanation
   - Conversation thread viewing with highlighting

3. **AI-Powered Suggestions**:
   - On-demand improvement recommendations
   - Context-aware rationale for changes
   - Generated using GPT-4o-mini for efficiency

4. **Admin Workflow Optimization**:
   - Filter by status and priority
   - Batch status updates
   - Admin notes for tracking progress
   - Direct links to SOPs and conversation threads

### Technical Architecture:

```typescript
// UserFeedback Model Structure
{
  feedbackId: string,
  sessionId: string,
  messageId: string,
  userQuestion: string,
  aiResponse: string,
  userComment: string,
  sopId: string,
  sopTitle: string,
  confidence: number,
  status: 'pending' | 'ongoing' | 'completed' | 'closed',
  priority: 'low' | 'medium' | 'high',
  aiSuggestion?: { content: string, rationale: string },
  adminNotes?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Files Created/Modified:

**New Files:**
- `src/models/UserFeedback.ts` - Database model
- `src/app/api/user-feedback/route.ts` - Main API endpoints
- `src/app/api/user-feedback/[id]/route.ts` - Individual feedback management
- `src/app/api/sessions/[sessionId]/thread/route.ts` - Conversation viewing
- `src/components/admin/FeedbackList.tsx` - Admin list component
- `src/components/admin/FeedbackDetail.tsx` - Admin detail component
- `src/components/admin/ConversationModal.tsx` - Thread viewing modal
- `src/app/admin/user-feedback/page.tsx` - Main admin page
- `src/app/admin/proposals/page.tsx` - Legacy system preserved

**Modified Files:**
- `src/app/api/chat/route.ts` - Removed AI proposal generation
- `src/lib/ai-sop-selection.ts` - Removed suggestedChange logic
- `src/components/ChatInterfaceAI.tsx` - Updated gap reporting
- `src/app/admin/layout.tsx` - Updated navigation
- `src/app/admin/page.tsx` - Redirect to user feedback

### Integration Points:
- **User Experience**: Seamless gap reporting without workflow disruption
- **Admin Workflow**: Centralized feedback management with full context
- **SOP Management**: Direct integration with SOP editing for improvements
- **Legacy Support**: Historical proposals preserved for reference

**System Ready For**: Step 7 - SOP Version Management and Auto-Regeneration

---

## Step 7: Implement SOP Version Management and Auto-Regeneration

### Overview
Focus on proper SOP lifecycle management, automatic AgentSOP regeneration when SOPs are updated, and version tracking for audit trails.

### Tasks:
1. **Automatic AgentSOP Regeneration**
   - When SOP is updated in "Manage SOPs", automatically regenerate corresponding AgentSOP
   - Parse markdown structure to extract objectives, activities, deliverables, etc.
   - Update searchable content for improved AI selection

2. **Version History Tracking**
   - Track all SOP changes with timestamps and content diffs
   - Store previous versions for rollback capability
   - Log who made changes (when auth is implemented)

3. **Live Content Updates**
   - Ensure chat immediately uses updated SOP content
   - Clear any caching that might serve stale content
   - Validate AgentSOP regeneration success

4. **SOP Change Validation**
   - Validate markdown structure after edits
   - Ensure required sections are maintained
   - Alert if critical sections are removed

### Workflow:
```
SOP Updated in Admin → Increment Version → Regenerate AgentSOP → Update Search Index → Notify Success
```

### Integration Points:
- **User Feedback**: Admins can reference feedback while editing SOPs manually
- **Chat System**: Immediately uses updated SOP content for responses
- **Admin Dashboard**: Shows version history and regeneration status

### Verification:
- [ ] SOP updates automatically regenerate AgentSOP
- [ ] Version numbers increment correctly with change tracking
- [ ] Chat uses updated SOP content immediately
- [ ] Version history tracks all changes with timestamps
- [ ] Rollback capability works for critical errors

---

## Step 8: Enhance UI/UX and Add Features

### Tasks:
1. ✅ Improve chat interface (Mostly Complete):
   - ✅ Show which SOP was used for each answer (Completed in Step 3)
   - ✅ Add confidence indicators (Completed in Step 3)
   - ✅ Implement typing indicators (Completed in Step 3)
   - ✅ User gap reporting (Completed in Step 5)
   
2. Add SOP browser:
   - View all available SOPs independently from chat
   - Search within SOPs content
   - Preview SOP content without admin access

3. Enhanced feedback features:
   - Thumbs up/down on individual responses
   - User feedback analytics dashboard
   - Export conversations with feedback data

4. Conversation export functionality:
   - Export chat history as markdown/PDF
   - Include SOP attributions and confidence scores
   - Export user feedback reports for analysis

### Updated Components Needed:
- `SOPBrowser`: Public SOP viewing and search
- `FeedbackAnalytics`: Admin analytics for user feedback trends
- `ExportDialog`: Export conversations and feedback

### Integration with User Feedback System:
- Analytics show most common feedback topics
- Export includes feedback reports and SOP improvement suggestions
- SOP browser helps users find information before asking questions

### Verification:
- ✅ SOP attribution visible in chat (Completed in Step 3)
- ✅ User feedback system creates entries with full context (Step 6.5)
- [ ] Can browse all SOPs independently without admin access
- [ ] Feedback analytics show trends and patterns
- [ ] Export generates valid markdown/PDF with feedback data

---

## Step 9: Testing and Quality Assurance

### Tasks:
1. Write comprehensive tests:
   - Unit tests for SOP selection logic
   - Integration tests for API endpoints
   - E2E tests for critical workflows
   - User feedback system tests
   
2. Test edge cases:
   - Ambiguous queries
   - Multiple relevant SOPs
   - No matching SOPs
   - User feedback submission edge cases
   - SOP regeneration failures
   
3. Performance testing:
   - Response time for SOP selection
   - Database query optimization
   - Concurrent user load
   - AgentSOP regeneration performance
   
4. User workflow testing:
   - Complete user feedback flow from gap report to admin review
   - SOP editing and regeneration workflow
   - Session management and conversation threading
   
5. Create test data and scenarios:
   - Sample user feedback with various gap types
   - Test SOPs with different markdown structures
   - Mock conversation threads for testing

### Test Coverage:
```
src/
├── __tests__/
│   ├── api/
│   │   ├── chat.test.ts
│   │   ├── user-feedback.test.ts (new)
│   │   ├── sessions.test.ts (updated)
│   │   └── sop-selection.test.ts
│   ├── components/
│   │   ├── admin/
│   │   │   ├── FeedbackList.test.ts (new)
│   │   │   ├── FeedbackDetail.test.ts (new)
│   │   │   └── SOPEditor.test.ts
│   │   └── ChatInterfaceAI.test.ts
│   └── e2e/
│       ├── user-feedback-workflow.test.ts (new)
│       ├── sop-management.test.ts (new)
│       └── chat-workflows.test.ts
```

### Verification:
- [ ] All tests pass (`npm test`)
- [ ] 80%+ code coverage including user feedback system
- [ ] Response time < 2s for SOP selection
- [ ] User feedback creation and admin review flows work end-to-end
- [ ] SOP regeneration completes within acceptable time limits
- [ ] No memory leaks under load
- [ ] Session management handles concurrent users properly

---

## Step 10: Documentation and Deployment Preparation

### Tasks:
1. Create comprehensive documentation:
   - API documentation (including User Feedback endpoints)
   - Admin user guide (updated for feedback system)
   - User guide for gap reporting
   - SOP authoring guidelines
   - System architecture diagram (updated)
   
2. Set up environment configurations:
   - Development settings
   - Staging settings  
   - Production settings
   - Database migration scripts for User Feedback
   
3. Implement security measures:
   - API rate limiting
   - Input validation for feedback submission
   - Secure admin routes
   - User feedback data protection
   
4. Create deployment scripts and CI/CD pipeline:
   - Database migration for UserFeedback model
   - AgentSOP regeneration verification
   - Rollback procedures for SOP changes

### Updated Documentation Structure:
```
docs/
├── API.md (updated with user feedback endpoints)
├── ADMIN_GUIDE.md (updated with feedback management)
├── USER_GUIDE.md (new - gap reporting workflow)
├── SOP_AUTHORING.md (updated with feedback integration)
├── FEEDBACK_SYSTEM.md (new - system overview)
├── ARCHITECTURE.md (updated architecture)
└── DEPLOYMENT.md (updated with new components)
```

### User Feedback System Documentation:
- How users report gaps in AI responses
- Admin workflow for reviewing and managing feedback
- Integration between feedback and SOP editing
- Conversation threading and context viewing
- Status management (pending → ongoing → closed)

### Verification:
- [ ] All documentation complete and accurate (including feedback system)
- [ ] Environment variables properly configured
- [ ] Security headers implemented with feedback data protection
- [ ] Database migration scripts for UserFeedback model tested
- [ ] Successful deployment to staging environment
- [ ] Load testing shows system handles expected traffic including feedback workflows
- [ ] Admin can successfully manage user feedback end-to-end
- [ ] User gap reporting flow documented and tested

---

## Post-Implementation Checklist

### System Health:
- [ ] All 5 PMO SOPs accessible via chat with proper AI selection
- [ ] User feedback system capturing gap reports correctly
- [ ] Admin can manage feedback status (pending/ongoing/closed)
- [ ] SOP updates regenerate AgentSOPs automatically
- [ ] Chat history persists properly with session management
- [ ] Conversation threading works in admin feedback view

### Performance Metrics:
- [ ] Average response time < 3 seconds
- [ ] 99% uptime in staging
- [ ] Database queries optimized (< 100ms)
- [ ] Memory usage stable over time

### User Experience:
- [ ] Intuitive chat interface
- [ ] Clear SOP attribution
- [ ] Smooth admin workflow
- [ ] Helpful error messages
- [ ] Mobile responsive

## Next Steps (Future Enhancements)
1. Add authentication and user management
2. Implement multi-tenancy for different teams
3. Add analytics dashboard
4. Integrate with external project management tools
5. Implement SOP templates and wizards
6. Add collaborative editing features
7. Build API for external integrations