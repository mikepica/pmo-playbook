'use client';

import { useState } from 'react';
import { Save, Eye, Edit, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SOP {
  _id: string;
  sopId: string;
  title: string;
  phase: number;
  version: number;
  markdownContent: string;
  updatedAt: string;
}

interface SOPEditorProps {
  sop: SOP;
  editMode: boolean;
  onSOPUpdate: (sop: SOP) => void;
  onEditModeChange: (editMode: boolean) => void;
}

export default function SOPEditor({ sop, editMode, onSOPUpdate, onEditModeChange }: SOPEditorProps) {
  const [content, setContent] = useState(sop.markdownContent);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== sop.markdownContent);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/content-db', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sopId: sop.sopId,
          markdownContent: content,
          type: 'human'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedSOP = {
          ...sop,
          markdownContent: content,
          version: data.sop.version,
          updatedAt: data.sop.updatedAt
        };
        
        onSOPUpdate(updatedSOP);
        setHasChanges(false);
        onEditModeChange(false);
        
        // Show regeneration feedback
        if (data.warning) {
          alert(`Warning: ${data.warning}\n\nErrors: ${data.regenerationErrors?.join('\n') || 'None'}\n\nWarnings: ${data.regenerationWarnings?.join('\n') || 'None'}`);
        } else if (data.agentSOPRegenerated) {
          console.log(`SOP and AgentSOP updated successfully. AgentSOP version: ${data.agentSOPVersion}`);
          if (data.regenerationWarnings?.length > 0) {
            console.log('Regeneration warnings:', data.regenerationWarnings);
          }
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to save SOP: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save SOP');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        setContent(sop.markdownContent);
        setHasChanges(false);
        onEditModeChange(false);
      }
    } else {
      onEditModeChange(false);
    }
  };

  if (editMode) {
    return (
      <div className="flex flex-col h-full">
        {/* Editor Header */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPreview(false)}
                className={`px-3 py-2 text-sm rounded ${
                  !showPreview
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Edit className="w-4 h-4 mr-2 inline" />
                Edit
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className={`px-3 py-2 text-sm rounded ${
                  showPreview
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 mr-2 inline" />
                Preview
              </button>
            </div>
            
            {hasChanges && (
              <div className="flex items-center text-orange-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" />
                Unsaved changes
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden">
          {showPreview ? (
            /* Preview Mode */
            <div className="h-full overflow-y-auto p-6 bg-white">
              <div className="max-w-4xl mx-auto">
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
          ) : (
            /* Edit Mode */
            <div className="h-full p-4 bg-gray-50">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-full p-4 border border-gray-300 rounded-lg font-mono text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Enter markdown content..."
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // View Mode
  return (
    <div className="h-full overflow-y-auto p-6 bg-white">
      <div className="max-w-4xl mx-auto">
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
          {sop.markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}