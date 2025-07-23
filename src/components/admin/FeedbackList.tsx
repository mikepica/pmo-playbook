'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Clock, User, ChevronRight, AlertCircle } from 'lucide-react';

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
  createdAt: string;
  updatedAt: string;
}

interface StatusCounts {
  pending: number;
  ongoing: number;
  completed: number;
  closed: number;
  total: number;
}

interface FeedbackListProps {
  selectedFeedback: UserFeedback | null;
  onFeedbackSelect: (feedback: UserFeedback) => void;
}

export default function FeedbackList({ selectedFeedback, onFeedbackSelect }: FeedbackListProps) {
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ pending: 0, ongoing: 0, completed: 0, closed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadFeedback();
  }, [activeFilter]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.append('status', activeFilter);
      }
      params.append('limit', '100');

      const response = await fetch(`/api/user-feedback?${params}`);
      const data = await response.json();
      
      if (data.feedback) {
        setFeedback(data.feedback);
        setStatusCounts(data.statusCounts || { pending: 0, ongoing: 0, completed: 0, closed: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const filterOptions = [
    { value: 'all', label: 'All Feedback', count: statusCounts.total },
    { value: 'pending', label: 'Pending Review', count: statusCounts.pending },
    { value: 'ongoing', label: 'In Progress', count: statusCounts.ongoing },
    { value: 'completed', label: 'Completed', count: statusCounts.completed },
    { value: 'closed', label: 'Closed', count: statusCounts.closed }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">User Feedback</h2>
        <p className="text-sm text-gray-600 mt-1">{statusCounts.total} total submissions</p>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4" aria-label="Filter">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeFilter === option.value
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {option.label}
              {option.count > 0 && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeFilter === option.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {option.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Feedback List */}
      <div className="flex-1 overflow-y-auto">
        {feedback.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No feedback found</h3>
              <p>
                {activeFilter === 'all' 
                  ? 'No user feedback has been submitted yet.'
                  : `No ${activeFilter} feedback found.`
                }
              </p>
            </div>
          </div>
        ) : (
          feedback.map((item) => (
            <div
              key={item.feedbackId}
              onClick={() => onFeedbackSelect(item)}
              className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedFeedback?.feedbackId === item.feedbackId 
                  ? 'bg-blue-50 border-r-4 border-blue-500' 
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header with status and priority */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                    {item.priority === 'high' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  {/* SOP and Question */}
                  <h3 className="font-medium text-gray-900 truncate mb-1">
                    {item.sopTitle}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    Q: {item.userQuestion}
                  </p>
                  
                  {/* User Comment */}
                  <p className="text-sm text-gray-800 line-clamp-2 mb-3 bg-gray-50 p-2 rounded">
                    💬 {item.userComment}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {Math.round(item.confidence * 100)}% confidence
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimeAgo(item.createdAt)}
                    </div>
                    <span>#{item.feedbackId.split('-')[1]}</span>
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}