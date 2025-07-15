'use client';

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';

interface TabViewProps {
  selectedFile: string | null;
  onFileSelect: (filename: string) => void;
  onFilesLoaded?: (files: string[]) => void;
  selectedFiles: string[];
  onFilesChange: (files: string[]) => void;
}

export default function TabView({ selectedFile, onFileSelect, onFilesLoaded, selectedFiles, onFilesChange }: TabViewProps) {
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
        // Auto-select all files for AI context by default
        if (fileList.length > 0 && selectedFiles.length === 0) {
          onFilesChange(fileList);
        }
      } catch (error) {
        console.error('Failed to fetch files:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [onFilesLoaded, selectedFiles.length, onFilesChange]);

  const handleFileToggle = (filename: string) => {
    if (selectedFiles.includes(filename)) {
      // Remove from selection
      onFilesChange(selectedFiles.filter(f => f !== filename));
    } else {
      // Add to selection
      onFilesChange([...selectedFiles, filename]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="h-8 bg-gray-200 rounded w-24"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center px-4 py-2">
        <FileText className="w-5 h-5 mr-3 text-gray-600" />
        <div className="flex flex-wrap gap-1">
          {files.map((file) => (
            <div key={file} className="flex items-center bg-gray-50 rounded-lg p-1">
              <input
                type="checkbox"
                id={`checkbox-${file}`}
                checked={selectedFiles.includes(file)}
                onChange={() => handleFileToggle(file)}
                className="w-4 h-4 mr-2 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <button
                onClick={() => onFileSelect(file)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedFile === file
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {file.replace('.md', '')}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {files.length === 0 && (
        <div className="text-gray-500 text-sm p-4">
          No markdown files found in the content folder.
        </div>
      )}
    </div>
  );
}