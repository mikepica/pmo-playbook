'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import SOPTabs from '@/components/SOPTabs';
import MarkdownViewerDB from '@/components/MarkdownViewerDB';
import ChatInterfacePersistent from '@/components/ChatInterfacePersistent';

interface SOP {
  id: string;
  filename: string;
  title: string;
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
        console.log(`Validating SOP: ${sopId}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/api/files-db?type=markdown', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`API Response status: ${response.status}`);
        
        if (!response.ok) {
          console.error(`API request failed with status: ${response.status}`);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API data received:', data);
        const sopList: SOP[] = data.sops || [];
        
        console.log(`Available SOPs: ${sopList.map(s => s.id).join(', ')}`);
        console.log(`Looking for SOP: ${sopId}`);
        
        const sopExists = sopList.some(sop => sop.id === sopId);
        console.log(`SOP exists: ${sopExists}`);
        
        if (!sopExists && sopList.length > 0) {
          console.warn(`SOP ${sopId} not found in available SOPs`);
          notFound();
        } else {
          console.log('SOP validation successful');
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to validate SOP:', error);
        console.log('Continuing without validation - letting other components handle SOP loading');
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

  const handleSOPsLoaded = () => {
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
          <ChatInterfacePersistent />
        </div>
      </div>
    </div>
  );
}