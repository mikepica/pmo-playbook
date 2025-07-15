'use client';

import { useState, useEffect } from 'react';
import { File, FileText } from 'lucide-react';

interface SidebarProps {
  selectedFile: string | null;
  onFileSelect: (filename: string) => void;
  onFilesLoaded?: (files: string[]) => void;
}

export default function Sidebar({ selectedFile, onFileSelect, onFilesLoaded }: SidebarProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/files?type=markdown');
        const data = await response.json();
        const fileList = data.files || [];
        setFiles(fileList);
        onFilesLoaded?.(fileList);
      } catch (error) {
        console.error('Failed to fetch files:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [onFilesLoaded]);

  if (loading) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
      <div className="flex items-center mb-4">
        <FileText className="w-5 h-5 mr-2" />
        <h2 className="font-semibold text-gray-800">Markdown Files</h2>
      </div>
      
      <div className="space-y-1">
        {files.map((file) => (
          <button
            key={file}
            onClick={() => onFileSelect(file)}
            className={`w-full text-left p-2 rounded-md hover:bg-gray-200 transition-colors flex items-center ${
              selectedFile === file ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
            }`}
          >
            <File className="w-4 h-4 mr-2" />
            <span className="truncate">{file}</span>
          </button>
        ))}
      </div>
      
      {files.length === 0 && (
        <div className="text-gray-500 text-sm mt-4">
          No markdown files found in the content folder.
        </div>
      )}
    </div>
  );
}