'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  User, 
  Clock, 
  FileText, 
  ExternalLink, 
  Eye,
  ChevronDown,
  Lightbulb
} from 'lucide-react';

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

interface FeedbackDetailProps {
  feedback: UserFeedback;
  onFeedbackUpdate: (feedback: UserFeedback) => void;
  onViewConversation: (sessionId: string, messageId: string) => void;
}

export default function FeedbackDetail({ 
  feedback, 
  onFeedbackUpdate, 
  onViewConversation 
}: FeedbackDetailProps) {
  const [status, setStatus] = useState(feedback.status);
  const [priority, setPriority] = useState(feedback.priority);
  const [adminNotes, setAdminNotes] = useState(feedback.adminNotes || '');
  const [updating, setUpdating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(feedback.aiSuggestion);
  const [loadingAI, setLoadingAI] = useState(false);

  // Load AI suggestion if not present
  useEffect(() => {
    if (!aiSuggestion && !loadingAI) {
      loadAISuggestion();
    }
  }, [feedback.feedbackId]);

  const loadAISuggestion = async () => {
    setLoadingAI(true);
    try {
      const response = await fetch(`/api/user-feedback/${feedback.feedbackId}`);
      const data = await response.json();
      if (data.feedback?.aiSuggestion) {
        setAiSuggestion(data.feedback.aiSuggestion);
      }
    } catch (error) {
      console.error('Failed to load AI suggestion:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const updateFeedback = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/user-feedback/${feedback.feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority,
          adminNotes: adminNotes || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        onFeedbackUpdate(data.feedback);
      } else {
        alert('Failed to update feedback');
      }
    } catch (error) {
      console.error('Failed to update feedback:', error);
      alert('Failed to update feedback');
    } finally {
      setUpdating(false);
    }
  };

  const hasChanges = () => {
    return status !== feedback.status || 
           priority !== feedback.priority || 
           adminNotes !== (feedback.adminNotes || '');
  };

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priorityValue: string) => {
    switch (priorityValue) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-xl font-semibold text-gray-900">
                User Feedback #{feedback.feedbackId.split('-')[1]}
              </h1>
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(status)}`}>
                {status}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(priority)}`}>
                {priority} priority
              </span>
            </div>
            <p className="text-sm text-gray-600 font-mono">{feedback.feedbackId}</p>
          </div>
          
          {hasChanges() && (
            <button
              onClick={updateFeedback}
              disabled={updating}
              className="flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>

        {/* Status and Priority Controls */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pending' | 'ongoing' | 'completed' | 'closed')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending Review</option>
              <option value="ongoing">In Progress</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center text-gray-600">
            <User className="w-4 h-4 mr-2" />
            {Math.round(feedback.confidence * 100)}% AI confidence
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            {new Date(feedback.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center text-gray-600">
            <FileText className="w-4 h-4 mr-2" />
            {feedback.sopTitle}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* User Question */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
            User's Original Question
          </h3>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-gray-800">&ldquo;{feedback.userQuestion}&rdquo;</p>
          </div>
        </div>

        {/* AI Response */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <span className="text-green-600 mr-2">🤖</span>
            AI Response ({Math.round(feedback.confidence * 100)}% confidence)
          </h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="prose prose-sm max-w-none text-gray-800">
              {feedback.aiResponse.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-2 last:mb-0">{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        {/* User Feedback */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <span className="text-orange-600 mr-2">💬</span>
            User's Feedback
          </h3>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-gray-800 font-medium">&ldquo;{feedback.userComment}&rdquo;</p>
          </div>
        </div>

        {/* AI Suggestion */}
        {(aiSuggestion || loadingAI) && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
              AI Improvement Suggestion
            </h3>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              {loadingAI ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                  <span className="text-gray-600">Generating AI suggestion...</span>
                </div>
              ) : aiSuggestion ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Suggested Improvement:</h4>
                    <p className="text-gray-800">{aiSuggestion.content}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Rationale:</h4>
                    <p className="text-gray-700 text-sm">{aiSuggestion.rationale}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No AI suggestion available</p>
              )}
            </div>
          </div>
        )}

        {/* SOP Context */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">SOP Context</h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{feedback.sopTitle}</p>
                <p className="text-sm text-gray-600">
                  SOP ID: {feedback.sopId} • Confidence: {Math.round(feedback.confidence * 100)}%
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onViewConversation(feedback.sessionId, feedback.messageId)}
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Conversation
                </button>
                <button className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Full SOP
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Notes */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Admin Notes</h3>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add notes about this feedback, actions taken, or resolution details..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}