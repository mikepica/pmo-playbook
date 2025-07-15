'use client';

import { useState, useEffect } from 'react';
import TabView from '@/components/TabView';
import MarkdownViewer from '@/components/MarkdownViewer';
import ChatInterface from '@/components/ChatInterface';
import PromptButtons from '@/components/PromptButtons';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const handleFileSelect = (filename: string) => {
    setSelectedFile(filename);
    if (!selectedFiles.includes(filename)) {
      setSelectedFiles([filename]);
    }
  };

  const handleFilesLoaded = (files: string[]) => {
    // Auto-select the first file if none is selected
    if (files.length > 0 && !selectedFile) {
      const firstFile = files[0];
      setSelectedFile(firstFile);
    }
    // Auto-select all files for AI context by default
    if (files.length > 0 && selectedFiles.length === 0) {
      setSelectedFiles(files);
    }
  };

  const handlePromptSelect = (prompt: string, files: string[]) => {
    setSelectedFiles(files);
    // This would trigger the chat interface to send the prompt
  };

  const handleFileOverride = (files: string[]) => {
    setSelectedFiles(files);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <TabView
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onFilesLoaded={handleFilesLoaded}
        selectedFiles={selectedFiles}
        onFilesChange={setSelectedFiles}
      />
      
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <MarkdownViewer selectedFile={selectedFile} />
        </div>
        
        <div className="w-96 flex flex-col" style={{ width: '72rem' }}>
          <PromptButtons
            onPromptSelect={handlePromptSelect}
            onFileOverride={handleFileOverride}
          />
          <ChatInterface
            selectedFiles={selectedFiles}
            onFilesChange={setSelectedFiles}
          />
        </div>
      </div>
    </div>
  );
}
