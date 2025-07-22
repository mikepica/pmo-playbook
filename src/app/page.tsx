'use client';

import { useState } from 'react';
import SOPTabs from '@/components/SOPTabs';
import MarkdownViewerDB from '@/components/MarkdownViewerDB';
import ChatInterfaceAI from '@/components/ChatInterfaceAI';

export default function Home() {
  const [selectedSOP, setSelectedSOP] = useState<string | null>(null);

  const handleSOPSelect = (sopId: string) => {
    setSelectedSOP(sopId);
  };

  const handleSOPsLoaded = (sops: any[]) => {
    // Auto-select the first SOP if none is selected
    if (sops.length > 0 && !selectedSOP) {
      const firstSOP = sops[0];
      setSelectedSOP(firstSOP.id);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <SOPTabs
        selectedSOP={selectedSOP}
        onSOPSelect={handleSOPSelect}
        onSOPsLoaded={handleSOPsLoaded}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* SOP Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          <MarkdownViewerDB selectedSOP={selectedSOP} />
        </div>
        
        {/* AI Chat Interface - Doubled width from 500px to 1000px */}
        <div className="w-[1000px] flex flex-col border-l border-gray-300 overflow-hidden h-full">
          <ChatInterfaceAI />
        </div>
      </div>
    </div>
  );
}
