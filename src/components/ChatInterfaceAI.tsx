'use client';

import { useState } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attribution?: {
    selectedSOP: {
      sopId: string;
      title: string;
      phase: number;
    };
    confidence: number;
    reasoning: string;
  };
  suggestedChange?: {
    detected: boolean;
    section: string;
  };
}

export default function ChatInterfaceAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center">
          <Bot className="w-5 h-5 mr-2 text-blue-600" />
          <h3 className="text-lg font-medium">AI PMO Assistant</h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Ask questions about project management - I'll automatically find the right SOP
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Ready to Help!</p>
            <p>Ask me anything about project management:</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>• "How do I create a project charter?"</p>
              <p>• "What's needed for project closure?"</p>
              <p>• "How do I manage project risks?"</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  
                  {/* SOP Attribution */}
                  {message.type === 'assistant' && message.attribution && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="space-y-2">
                        <div className="flex items-center text-xs text-gray-600">
                          <span className="font-medium">Source:</span>
                          <span className="ml-2 bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs">
                            {message.attribution.selectedSOP.sopId}: Phase {message.attribution.selectedSOP.phase}
                          </span>
                          <span className="ml-2 text-gray-500">
                            {message.attribution.selectedSOP.title}
                          </span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            {Math.round(message.attribution.confidence * 100)}% confident
                          </span>
                          {message.suggestedChange?.detected && (
                            <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                              Improvement suggested
                            </span>
                          )}
                        </div>
                      </div>
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
            <div className="bg-white text-gray-800 shadow border rounded-lg px-4 py-2 max-w-xs">
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
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    </div>
  );
}