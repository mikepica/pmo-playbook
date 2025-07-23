'use client';

import { useState, useEffect } from 'react';
import { X, User, Bot, Clock, ChevronRight } from 'lucide-react';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  selectedSopId?: string;
  confidence?: number;
  isHighlighted: boolean;
}

interface ConversationThread {
  sessionId: string;
  sessionName: string;
  summary?: string;
  messages: ConversationMessage[];
  startedAt: string;
  lastActive: string;
  messageCount: number;
}

interface ConversationModalProps {
  sessionId: string;
  highlightMessageId?: string;
  onClose: () => void;
}

export default function ConversationModal({ 
  sessionId, 
  highlightMessageId, 
  onClose 
}: ConversationModalProps) {
  const [conversation, setConversation] = useState<ConversationThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversation();
  }, [sessionId, highlightMessageId]);

  const loadConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (highlightMessageId) {
        params.append('highlightMessageId', highlightMessageId);
      }

      const response = await fetch(`/api/sessions/${sessionId}/thread?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = await response.json();
      setConversation(data);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              {conversation?.sessionName || 'Conversation Thread'}
            </h2>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span>Session: {sessionId.split('-')[1]}</span>
              {conversation && (
                <>
                  <span>•</span>
                  <span>{conversation.messageCount} messages</span>
                  <span>•</span>
                  <span>Started {formatTimeAgo(conversation.startedAt)}</span>
                </>
              )}
            </div>
            {conversation?.summary && (
              <p className="text-sm text-gray-500 mt-1">{conversation.summary}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading conversation...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600">
                <p className="text-lg font-medium mb-2">Error Loading Conversation</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={loadConversation}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : conversation && conversation.messages.length > 0 ? (
            <div className="space-y-4">
              {conversation.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex space-x-3 ${
                    message.isHighlighted 
                      ? 'bg-yellow-50 -mx-3 px-3 py-2 rounded-lg border-l-4 border-yellow-400' 
                      : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900">
                        {message.role === 'user' ? 'User' : 'AI Assistant'}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTimestamp(message.timestamp)}
                      </div>
                      {message.isHighlighted && (
                        <span className="px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">
                          Highlighted
                        </span>
                      )}
                    </div>
                    
                    <div className="prose prose-sm max-w-none">
                      {message.content.split('\n').map((paragraph, pIndex) => (
                        <p key={pIndex} className="mb-2 last:mb-0 text-gray-800">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {/* AI Attribution */}
                    {message.role === 'assistant' && message.selectedSopId && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                        <div className="flex items-center">
                          <span>Source: {message.selectedSopId}</span>
                          {message.confidence && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{Math.round(message.confidence * 100)}% confidence</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium mb-2">No Messages Found</p>
                <p className="text-sm">This conversation appears to be empty.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}