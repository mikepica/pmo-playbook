'use client';

import React, { createContext, useContext, useState, useRef } from 'react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attribution?: {
    selectedSOP: {
      sopId: string;
      title: string;
    };
    confidence: number;
    reasoning: string;
  };
  suggestedChange?: {
    detected: boolean;
    section: string;
  };
}

interface Session {
  sessionId: string;
  name: string;
  sessionName: string;
  summary: string;
  messageCount: number;
  startedAt: Date;
  lastActive: Date;
  isActive: boolean;
}

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessionId: string | null;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  historyLoaded: boolean;
  setHistoryLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  preservedState: React.MutableRefObject<{
    messages: Message[];
    sessionId: string | null;
    historyLoaded: boolean;
  }>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Preserve state across re-mounts
  const preservedState = useRef({
    messages: [] as Message[],
    sessionId: null as string | null,
    historyLoaded: false,
  });

  // Update preserved state when actual state changes
  React.useEffect(() => {
    preservedState.current = { messages, sessionId, historyLoaded };
  }, [messages, sessionId, historyLoaded]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        sessionId,
        setSessionId,
        historyLoaded,
        setHistoryLoaded,
        sessions,
        setSessions,
        preservedState,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}