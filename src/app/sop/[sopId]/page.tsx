'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import SOPTabs from '@/components/SOPTabs';
import MarkdownViewerDB from '@/components/MarkdownViewerDB';
import ChatInterfaceAI from '@/components/ChatInterfaceAI';

interface SOP {
  id: string;
  filename: string;
  title: string;
  phase: number;
}

export default function SOPPage() {
  const params = useParams();
  const sopId = params.sopId as string;
  const [selectedSOP, setSelectedSOP] = useState<string | null>(sopId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sopId) {
      setSelectedSOP(sopId);
    }
  }, [sopId]);

  useEffect(() => {
    // Validate SOP exists
    const validateSOP = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/api/files-db?type=markdown', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const sopList: SOP[] = data.sops || [];
        
        const sopExists = sopList.some(sop => sop.id === sopId);
        
        if (!sopExists && sopList.length > 0) {
          notFound();
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to validate SOP:', error);
        // If database is unreachable, assume SOP exists and let other components handle errors
        setLoading(false);
      }
    };

    validateSOP();
  }, [sopId]);

  const handleSOPSelect = (newSopId: string) => {
    setSelectedSOP(newSopId);
    // Navigate to the new SOP URL
    window.history.pushState({}, '', `/sop/${newSopId}`);
  };

  const handleSOPsLoaded = (loadedSOPs: SOP[]) => {
    // This is now just for the SOPTabs component
  };

  // Show loading state while we validate SOP exists
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="animate-pulse flex space-x-4">
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading SOP...</p>
          </div>
        </div>
      </div>
    );
  }

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
        
        {/* AI Chat Interface - Persistent across all SOP pages */}
        <div className="w-[1000px] flex flex-col border-l border-gray-300 overflow-hidden h-full">
          <ChatInterfaceAI />
        </div>
      </div>
    </div>
  );
}