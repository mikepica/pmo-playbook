'use client';

import { useState } from 'react';
import FeedbackList from '@/components/admin/FeedbackList';
import FeedbackDetail from '@/components/admin/FeedbackDetail';
import ConversationModal from '@/components/admin/ConversationModal';
import { MessageSquare } from 'lucide-react';

interface UserFeedback {
  _id: string;
  feedbackId: string;
  sessionId: string;
  messageId: string;
  userQuestion: string;
  aiResponse: string;
  userComment: string;
  sopId: string;
  sopTitle: string;
  sopSection: string;
  confidence: number;
  status: 'pending' | 'ongoing' | 'completed' | 'closed';
  priority: 'low' | 'medium' | 'high';
  adminNotes?: string;
  aiSuggestion?: {
    content: string;
    rationale: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function UserFeedbackPage() {
  const [selectedFeedback, setSelectedFeedback] = useState<UserFeedback | null>(null);
  const [conversationModal, setConversationModal] = useState<{
    sessionId: string;
    messageId?: string;
  } | null>(null);

  const handleFeedbackSelect = (feedback: UserFeedback) => {
    setSelectedFeedback(feedback);
  };

  const handleFeedbackUpdate = (updatedFeedback: UserFeedback) => {
    setSelectedFeedback(updatedFeedback);
    // The list will reload automatically or could be updated here
  };

  const handleViewConversation = (sessionId: string, messageId: string) => {
    setConversationModal({ sessionId, messageId });
  };

  const closeConversationModal = () => {
    setConversationModal(null);
  };

  return (
    <div className="flex h-full">
      {/* Feedback List - Left Side */}
      <div className="w-1/3 border-r border-gray-200 bg-white">
        <FeedbackList
          selectedFeedback={selectedFeedback}
          onFeedbackSelect={handleFeedbackSelect}
        />
      </div>

      {/* Feedback Detail - Right Side */}
      <div className="flex-1 bg-gray-50">
        {selectedFeedback ? (
          <FeedbackDetail
            feedback={selectedFeedback}
            onFeedbackUpdate={handleFeedbackUpdate}
            onViewConversation={handleViewConversation}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select User Feedback</h3>
              <p>Choose feedback from the list to view details and take action</p>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Modal */}
      {conversationModal && (
        <ConversationModal
          sessionId={conversationModal.sessionId}
          highlightMessageId={conversationModal.messageId}
          onClose={closeConversationModal}
        />
      )}
    </div>
  );
}