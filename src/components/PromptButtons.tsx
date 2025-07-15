'use client';

import { useState, useEffect } from 'react';
import { Zap, Settings } from 'lucide-react';

interface PromptConfig {
  title: string;
  description: string;
  model: string;
  prompt: string;
  defaultFiles: string[];
}

interface PromptButtonsProps {
  onPromptSelect: (prompt: string, files: string[]) => void;
  onFileOverride: (files: string[]) => void;
}

export default function PromptButtons({ onPromptSelect, onFileOverride }: PromptButtonsProps) {
  const [prompts, setPrompts] = useState<{ [key: string]: PromptConfig }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch('/api/files?type=prompts');
        const data = await response.json();
        const promptFiles = data.files || [];

        const promptConfigs: { [key: string]: PromptConfig } = {};
        
        await Promise.all(
          promptFiles.map(async (file: string) => {
            try {
              const contentResponse = await fetch(`/api/content?filename=${file}&type=prompt`);
              const contentData = await contentResponse.json();
              if (contentData.content) {
                promptConfigs[file] = contentData.content;
              }
            } catch (error) {
              console.error(`Failed to fetch prompt ${file}:`, error);
            }
          })
        );

        setPrompts(promptConfigs);
      } catch (error) {
        console.error('Failed to fetch prompts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  const handlePromptClick = (promptKey: string) => {
    const config = prompts[promptKey];
    if (config) {
      onPromptSelect(config.prompt, config.defaultFiles);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border-b border-gray-200">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 rounded w-32"></div>
          <div className="h-8 bg-gray-200 rounded w-28"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center mb-3">
        <Zap className="w-4 h-4 mr-2" />
        <h3 className="text-sm font-medium text-gray-800">Quick Prompts</h3>
      </div>
      
      <div className="space-y-2">
        {Object.entries(prompts).map(([key, config]) => (
          <div key={key} className="flex items-center space-x-2">
            <button
              onClick={() => handlePromptClick(key)}
              className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors text-left"
              title={config.description}
            >
              {config.title}
            </button>
            <button
              onClick={() => onFileOverride(config.defaultFiles)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="Override default files"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {Object.keys(prompts).length === 0 && (
        <div className="text-sm text-gray-500">
          No prompt files found in the prompts folder.
        </div>
      )}
    </div>
  );
}