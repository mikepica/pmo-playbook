'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, RotateCcw, AlertCircle, ChevronDown, Clock, Edit2, ThumbsUp, ThumbsDown, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatContext } from '@/contexts/ChatContext';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attribution?: {
    // Primary SOP for backward compatibility
    selectedSOP: {
      sopId: string;
      title: string;
    };
    confidence: number;
    
    // New unified system data
    responseStrategy?: 'full_answer' | 'partial_answer' | 'escape_hatch';
    coverageLevel?: 'high' | 'medium' | 'low';
    sopSources?: Array<{
      sopId: string;
      title: string;
      confidence: number;
      sections: string[];
      keyPoints: string[];
    }>;
    gaps?: string[];
    queryIntent?: string;
    keyTopics?: string[];
    processingTime?: number;
    tokensUsed?: number;
    
    // Legacy fields
    reasoning?: string;
    responseMode?: string;
    usedChainOfThought?: boolean;
  };
  suggestedChange?: {
    detected: boolean;
    section: string;
  };
}

// interface Session {
//   sessionId: string;
//   name: string;
//   sessionName: string;
//   summary: string;
//   messageCount: number;
//   startedAt: Date;
//   lastActive: Date;
//   isActive: boolean;
// }

export default function ChatInterfacePersistent() {
  const {
    messages,
    setMessages,
    sessionId,
    setSessionId,
    historyLoaded,
    setHistoryLoaded,
    sessions,
    setSessions,
    preservedState
  } = useChatContext();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportingGap, setReportingGap] = useState<string | null>(null);
  const [gapDescription, setGapDescription] = useState('');
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'helpful' | 'not_helpful'>>({});
  // Removed response mode selector - now using unified system
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  };

  const initializeSession = useCallback(async (newSession = false) => {
    try {
      // Get or create session ID from localStorage
      let storedSessionId = localStorage.getItem('pmo-chat-session');
      
      if (!storedSessionId || newSession) {
        storedSessionId = generateSessionId();
        localStorage.setItem('pmo-chat-session', storedSessionId);
      }

      setSessionId(storedSessionId);
      
      if (newSession) {
        // Clear messages for new session
        setMessages([]);
        setHistoryLoaded(true);
        return;
      }
      
      // Load chat history for this session
      const response = await fetch(`/api/chat-history?sessionId=${storedSessionId}`);
      const data = await response.json();
      
      if (data.exists && data.messages) {
        const formattedMessages: Message[] = data.messages.map((msg: {
          role: string;
          content: string;
          timestamp: string;
          selectedSopId?: string;
          confidence?: number;
        }, index: number) => ({
          id: `${Date.now()}-${index}`,
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          attribution: msg.selectedSopId ? {
            selectedSOP: {
              sopId: msg.selectedSopId,
              title: `SOP ${msg.selectedSopId}`
            },
            confidence: msg.confidence || 0.9,
            reasoning: 'From chat history'
          } : undefined
        }));
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Add user-visible error recovery
      setMessages([{
        id: 'error-recovery',
        type: 'assistant',
        content: 'I had trouble loading your chat history, but you can continue chatting. Your new messages will be saved.',
        timestamp: new Date()
      }]);
    }
    
    setHistoryLoaded(true);
  }, [setMessages, setSessionId, setHistoryLoaded]);

  const startNewConversation = () => {
    // Save current session before starting new
    if (sessionId && messages.length > 0) {
      updateSessionLastActive(sessionId);
    }
    initializeSession(true);
    loadSessions();
  };

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions?limit=20&currentSessionId=${sessionId || ''}`);
      const data = await response.json();
      
      if (data.sessions) {
        setSessions(data.sessions.map((s: {
          sessionId: string;
          name: string;
          sessionName: string;
          summary: string;
          messageCount: number;
          startedAt: string;
          lastActive: string;
          isActive: boolean;
        }) => ({
          ...s,
          startedAt: new Date(s.startedAt),
          lastActive: new Date(s.lastActive)
        })));
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [sessionId, setSessions]);

  // Initialize session and load history only once
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Check if we have preserved state first
      if (preservedState.current.sessionId && preservedState.current.messages.length > 0) {
        setMessages(preservedState.current.messages);
        setSessionId(preservedState.current.sessionId);
        setHistoryLoaded(true);
        loadSessions();
      } else {
        initializeSession();
        loadSessions();
      }
    }
  }, [initializeSession, loadSessions, preservedState, setHistoryLoaded, setMessages, setSessionId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSessionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const switchToSession = async (targetSessionId: string) => {
    if (targetSessionId === sessionId) return;
    
    // Save current session
    if (sessionId && messages.length > 0) {
      await updateSessionLastActive(sessionId);
    }
    
    // Load the selected session
    localStorage.setItem('pmo-chat-session', targetSessionId);
    setSessionId(targetSessionId);
    setMessages([]);
    setHistoryLoaded(false);
    
    // Load chat history for the selected session
    try {
      const response = await fetch(`/api/chat-history?sessionId=${targetSessionId}`);
      const data = await response.json();
      
      if (data.exists && data.messages) {
        const formattedMessages: Message[] = data.messages.map((msg: {
          role: string;
          content: string;
          timestamp: string;
          selectedSopId?: string;
          confidence?: number;
        }, index: number) => ({
          id: `${Date.now()}-${index}`,
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          attribution: msg.selectedSopId ? {
            selectedSOP: {
              sopId: msg.selectedSopId,
              title: `SOP ${msg.selectedSopId}`
            },
            confidence: msg.confidence || 0.9,
            reasoning: 'From chat history'
          } : undefined
        }));
        
        setMessages(formattedMessages);
      }
      
      // Update lastActive for the loaded session
      await updateSessionLastActive(targetSessionId);
    } catch (error) {
      console.error('Failed to load session:', error);
      // Add user-visible error and fallback
      setMessages([{
        id: 'session-error-recovery',
        type: 'assistant', 
        content: `I couldn't load that chat session. You can start a new conversation or try selecting a different session.`,
        timestamp: new Date()
      }]);
    }
    
    setHistoryLoaded(true);
    setShowSessionDropdown(false);
    loadSessions();
  };

  const updateSessionLastActive = async (sessionIdToUpdate: string) => {
    try {
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdToUpdate,
          updateLastActive: true
        })
      });
    } catch (error) {
      console.error('Failed to update session lastActive:', error);
    }
  };

  const renameSession = async (sessionIdToRename: string, newName: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdToRename,
          sessionName: newName
        })
      });
      
      if (response.ok) {
        setEditingSessionId(null);
        setEditingSessionName('');
        loadSessions();
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const deleteSession = async (sessionIdToDelete: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        const response = await fetch(`/api/sessions?sessionId=${sessionIdToDelete}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // If deleting current session, start a new one
          if (sessionIdToDelete === sessionId) {
            initializeSession(true);
          }
          loadSessions();
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  const formatSessionDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Update session ID if not set
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        attribution: data.attribution,
        suggestedChange: data.suggestedChange
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const reportGap = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.attribution) return;

    setReportingGap(messageId);
  };

  const handleMessageFeedback = async (messageId: string, rating: 'helpful' | 'not_helpful') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.attribution) return;

    try {
      const response = await fetch('/api/message-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          sessionId,
          rating,
          sopUsed: message.attribution.selectedSOP.sopId,
          confidence: message.attribution.confidence
        })
      });

      if (response.ok) {
        setMessageFeedback(prev => ({ ...prev, [messageId]: rating }));
        
        // If user marked as not helpful, suggest leaving detailed feedback
        if (rating === 'not_helpful') {
          reportGap(messageId);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Removed triggerComprehensiveMode - now using unified system

  const removeMessageFeedback = async (messageId: string) => {
    try {
      const response = await fetch(`/api/message-feedback?messageId=${messageId}&sessionId=${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessageFeedback(prev => {
          const updated = { ...prev };
          delete updated[messageId];
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to remove feedback:', error);
    }
  };

  const exportConversation = () => {
    if (messages.length === 0) return;

    const currentSession = sessions.find(s => s.sessionId === sessionId);
    const sessionTitle = currentSession?.sessionName || `Chat Session ${sessionId}`;
    
    let markdown = `# ${sessionTitle}\n\n`;
    markdown += `**Date:** ${new Date().toLocaleDateString()}\n`;
    markdown += `**Session ID:** ${sessionId}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((message, index) => {
      const timestamp = message.timestamp.toLocaleString();
      
      if (message.type === 'user') {
        markdown += `### 👤 User (${timestamp})\n\n`;
        markdown += `${message.content}\n\n`;
      } else {
        markdown += `### 🤖 Assistant (${timestamp})\n\n`;
        markdown += `${message.content}\n\n`;
        
        if (message.attribution) {
          if (message.attribution.selectedSOP.sopId === 'GENERAL_PM_KNOWLEDGE') {
            markdown += `> **Source:** General PM Expertise\n`;
          } else {
            markdown += `> **Source:** ${message.attribution.selectedSOP.sopId} - ${message.attribution.selectedSOP.title}\n`;
          }
          markdown += `> **Confidence:** ${Math.round(message.attribution.confidence * 100)}%\n`;
          
          const feedback = messageFeedback[message.id];
          if (feedback) {
            markdown += `> **Feedback:** ${feedback === 'helpful' ? '👍 Helpful' : '👎 Not helpful'}\n`;
          }
          markdown += '\n';
        }
      }
      
      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });

    // Create and download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const submitGapReport = async () => {
    if (!reportingGap || !gapDescription.trim()) return;

    const message = messages.find(m => m.id === reportingGap);
    if (!message || !message.attribution) return;

    try {
      // Find the user's original question
      const messageIndex = messages.findIndex(m => m.id === reportingGap);
      const userQuestion = messages[messageIndex - 1]?.content || 'Unknown question';

      const response = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messageId: message.id,
          userQuestion,
          aiResponse: message.content,
          userComment: gapDescription,
          sopId: message.attribution.selectedSOP.sopId,
          sopTitle: message.attribution.selectedSOP.title,
          confidence: message.attribution.confidence
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Add a system message confirming the report
        const confirmMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: data.message || 'Thank you for your feedback! We will review this and improve our knowledge base.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, confirmMessage]);
      }
    } catch (error) {
      console.error('Failed to submit gap report:', error);
    } finally {
      setReportingGap(null);
      setGapDescription('');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Bot className="w-5 h-5 mr-2 text-blue-600" />
            <h3 className="text-lg font-medium text-black">AI PMO Assistant</h3>
          </div>
          <div className="flex items-center space-x-2">
            {/* Session Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Clock className="w-4 h-4 mr-2" />
                Recent Chats
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>
              
              {showSessionDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No previous conversations
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.sessionId}
                        className={`border-b border-gray-100 last:border-b-0 ${
                          session.sessionId === sessionId ? 'bg-blue-50' : ''
                        }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (confirm('Delete this conversation?')) {
                            deleteSession(session.sessionId);
                          }
                        }}
                      >
                        {editingSessionId === session.sessionId ? (
                          <div className="p-3">
                            <input
                              type="text"
                              value={editingSessionName}
                              onChange={(e) => setEditingSessionName(e.target.value)}
                              onBlur={() => {
                                if (editingSessionName.trim()) {
                                  renameSession(session.sessionId, editingSessionName);
                                } else {
                                  setEditingSessionId(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  renameSession(session.sessionId, editingSessionName);
                                } else if (e.key === 'Escape') {
                                  setEditingSessionId(null);
                                  setEditingSessionName('');
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div
                            className="p-3 cursor-pointer hover:bg-gray-50 group"
                            onClick={() => switchToSession(session.sessionId)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0 mr-2">
                                <div className="font-medium text-sm text-gray-900 truncate">
                                  {session.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {session.messageCount} messages • {formatSessionDate(session.lastActive)}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.sessionId);
                                  setEditingSessionName(session.name);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                              >
                                <Edit2 className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            {messages.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportConversation}
                  className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Export conversation as markdown"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
                <button
                  onClick={startNewConversation}
                  className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Chat
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Ask questions about project management - I&apos;ll automatically find the right SOP
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0">
        {!historyLoaded && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300 animate-pulse" />
            <p>Loading conversation history...</p>
          </div>
        )}
        
        {historyLoaded && messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Ready to Help!</p>
            <p>Ask me anything about project management:</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>• &ldquo;How do I create a project charter?&rdquo;</p>
              <p>• &ldquo;What&rsquo;s needed for project closure?&rdquo;</p>
              <p>• &ldquo;How do I manage project risks?&rdquo;</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-2xl px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-800 shadow border'
              }`}
            >
              <div className="flex items-start space-x-2">
                {message.type === 'assistant' && (
                  <Bot className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" />
                )}
                {message.type === 'user' && (
                  <User className="w-5 h-5 mt-0.5 text-white flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className={`prose prose-sm max-w-none ${message.type === 'user' ? 'text-white' : 'text-gray-800'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({...props}) => <h1 className={`text-lg font-bold mb-2 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        h2: ({...props}) => <h2 className={`text-base font-semibold mb-2 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        h3: ({...props}) => <h3 className={`text-sm font-medium mb-1 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        p: ({...props}) => <p className={`mb-2 last:mb-0 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        ul: ({...props}) => <ul className={`list-disc pl-4 mb-2 space-y-1 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        ol: ({...props}) => <ol className={`list-decimal pl-4 mb-2 space-y-1 ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        li: ({...props}) => <li className={message.type === 'user' ? 'text-white' : 'text-gray-800'} {...props} />,
                        strong: ({...props}) => <strong className={`font-semibold ${message.type === 'user' ? 'text-white' : 'text-gray-900'}`} {...props} />,
                        em: ({...props}) => <em className={`italic ${message.type === 'user' ? 'text-white' : ''}`} {...props} />,
                        code: ({...props}) => <code className={message.type === 'user' ? 'bg-blue-500 text-white px-1 py-0.5 rounded text-xs font-mono border border-blue-400' : 'bg-blue-50 text-blue-800 px-1 py-0.5 rounded text-xs font-mono border'} {...props} />,
                        pre: ({...props}) => <pre className={message.type === 'user' ? 'bg-blue-500 p-2 rounded border border-blue-400 text-xs overflow-x-auto mb-2 text-white' : 'bg-gray-50 p-2 rounded border text-xs overflow-x-auto mb-2'} {...props} />,
                        blockquote: ({...props}) => <blockquote className={message.type === 'user' ? 'border-l-4 border-white pl-3 italic text-white mb-2' : 'border-l-4 border-blue-200 pl-3 italic text-gray-700 mb-2'} {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Simplified Attribution Display */}
                  {message.type === 'assistant' && message.attribution && (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        {/* Overall Confidence */}
                        <span className="text-gray-600">
                          Overall Confidence (avg): {Math.round(message.attribution.confidence * 100)}%
                        </span>
                        
                      </div>
                      
                      {/* Processing Info */}
                      {message.attribution.processingTime && (
                        <span className="text-gray-400 text-xs">
                          {message.attribution.processingTime}ms
                        </span>
                      )}
                    </div>
                  )}

                  {/* Feedback buttons */}
                  {message.type === 'assistant' && message.attribution && (
                    <div className="flex items-center space-x-3 mt-2">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => 
                            messageFeedback[message.id] === 'helpful' 
                              ? removeMessageFeedback(message.id)
                              : handleMessageFeedback(message.id, 'helpful')
                          }
                          className={`p-1 rounded transition-colors ${
                            messageFeedback[message.id] === 'helpful'
                              ? 'bg-green-100 text-green-700'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => 
                            messageFeedback[message.id] === 'not_helpful' 
                              ? removeMessageFeedback(message.id)
                              : handleMessageFeedback(message.id, 'not_helpful')
                          }
                          className={`p-1 rounded transition-colors ${
                            messageFeedback[message.id] === 'not_helpful'
                              ? 'bg-red-100 text-red-700'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {!message.suggestedChange?.detected && (
                        <button
                          onClick={() => reportGap(message.id)}
                          className="flex items-center text-xs text-orange-600 hover:text-orange-700"
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Report Gap
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs mt-2 opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 shadow border rounded-lg px-4 py-2 max-w-xs lg:max-w-2xl">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a project management question..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Gap Reporting Modal */}
      {reportingGap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Report Missing Information</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please describe what information you were looking for that wasn&apos;t provided in the response.
            </p>
            <textarea
              value={gapDescription}
              onChange={(e) => setGapDescription(e.target.value)}
              placeholder="Example: I need specific steps on how to handle budget overruns during the project..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={4}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setReportingGap(null);
                  setGapDescription('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitGapReport}
                disabled={!gapDescription.trim()}
                className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}