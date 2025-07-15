'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText } from 'lucide-react';


interface MarkdownViewerProps {
  selectedFile: string | null;
}

export default function MarkdownViewer({ selectedFile }: MarkdownViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setContent('');
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/content?filename=${selectedFile}&type=markdown`);
        const data = await response.json();
        setContent(data.content || '');
      } catch (error) {
        console.error('Failed to fetch content:', error);
        setContent('Error loading file content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Select a markdown file to view its content</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-white">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-white overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 pb-2 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">{selectedFile}</h1>
        </div>
        
        <div className="max-w-none text-black">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({...props}) => <h1 className="text-3xl font-bold mb-4 text-black" {...props} />,
              h2: ({...props}) => <h2 className="text-2xl font-semibold mb-3 text-black" {...props} />,
              h3: ({...props}) => <h3 className="text-xl font-medium mb-2 text-black" {...props} />,
              h4: ({...props}) => <h4 className="text-lg font-medium mb-2 text-black" {...props} />,
              h5: ({...props}) => <h5 className="text-base font-medium mb-2 text-black" {...props} />,
              h6: ({...props}) => <h6 className="text-sm font-medium mb-2 text-black" {...props} />,
              p: ({...props}) => <p className="mb-4 text-black leading-relaxed" {...props} />,
              ul: ({...props}) => <ul className="list-disc pl-6 mb-4 text-black" {...props} />,
              ol: ({...props}) => <ol className="list-decimal pl-6 mb-4 text-black" {...props} />,
              li: ({...props}) => <li className="mb-1 text-black" {...props} />,
              blockquote: ({...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-black" {...props} />,
              code: ({...props}) => <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-black" {...props} />,
              pre: ({...props}) => <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-black" {...props} />,
              strong: ({...props}) => <strong className="font-bold text-black" {...props} />,
              em: ({...props}) => <em className="italic text-black" {...props} />,
              a: ({...props}) => <a className="text-blue-600 hover:text-blue-800 underline" {...props} />,
              table: ({...props}) => <table className="w-full border-collapse border border-gray-300 mb-4" {...props} />,
              th: ({...props}) => <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-black" {...props} />,
              td: ({...props}) => <td className="border border-gray-300 px-4 py-2 text-black" {...props} />,
              hr: ({...props}) => <hr className="my-8 border-gray-300" {...props} />,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}