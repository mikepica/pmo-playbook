'use client';

import { useState, useEffect } from 'react';
import { Save, Eye, Edit, AlertCircle, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SOP {
  _id: string;
  sopId: string;
  title: string;
  version: number;
  markdownContent: string;
  updatedAt: string;
}

interface SOPEditorProps {
  sop: SOP | null;
  editMode: boolean;
  createMode?: boolean;
  onSOPUpdate: (sop: SOP) => void;
  onSOPCreate?: (sop: SOP) => void;
  onEditModeChange: (editMode: boolean) => void;
  onCancel?: () => void;
}

export default function SOPEditor({ 
  sop, 
  editMode, 
  createMode = false, 
  onSOPUpdate, 
  onSOPCreate, 
  onEditModeChange, 
  onCancel 
}: SOPEditorProps) {
  const [content, setContent] = useState(createMode ? '# New SOP\n\nWrite your Standard Operating Procedure here using any format that works for you. The system will automatically extract the relevant information to create a structured version for AI assistance.\n\n' : (sop?.markdownContent || ''));
  const [title, setTitle] = useState(createMode ? '' : (sop?.title || ''));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(createMode || newContent !== (sop?.markdownContent || ''));
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasChanges(createMode || newTitle !== (sop?.title || ''));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    // Validation
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    
    if (!content.trim()) {
      alert('Content is required');
      return;
    }
    
    setSaving(true);
    try {
      const method = createMode ? 'POST' : 'PUT';
      const body = createMode 
        ? {
            title: title.trim(),
            markdownContent: content.trim()
          }
        : {
            sopId: sop!.sopId,
            markdownContent: content.trim(),
            type: 'human'
          };

      const response = await fetch('/api/content-db', {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (createMode) {
          onSOPCreate && onSOPCreate(data.sop);
        } else {
          const updatedSOP = {
            ...sop!,
            markdownContent: content,
            version: data.sop.version,
            updatedAt: data.sop.updatedAt
          };
          
          onSOPUpdate(updatedSOP);
        }
        
        setHasChanges(false);
        onEditModeChange(false);
        
        // Show regeneration feedback
        if (data.warning) {
          alert(`Warning: ${data.warning}\n\nErrors: ${data.regenerationErrors?.join('\n') || 'None'}\n\nWarnings: ${data.regenerationWarnings?.join('\n') || 'None'}`);
        } else if (data.agentSOPRegenerated || data.agentSOPCreated) {
          console.log(`SOP ${createMode ? 'created' : 'updated'} and AgentSOP processed successfully. AgentSOP version: ${data.agentSOPVersion}`);
          if (data.regenerationWarnings?.length > 0) {
            console.log('Regeneration warnings:', data.regenerationWarnings);
          }
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to ${createMode ? 'create' : 'save'} SOP: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Failed to ${createMode ? 'create' : 'save'} SOP`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        if (createMode) {
          onCancel && onCancel();
        } else {
          setContent(sop!.markdownContent);
          setHasChanges(false);
          onEditModeChange(false);
        }
      }
    } else {
      if (createMode) {
        onCancel && onCancel();
      } else {
        onEditModeChange(false);
      }
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
                  {createMode ? 'Create SOP' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Form Fields - for both create and edit modes */}
        {(createMode || (!createMode && sop)) && (
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-black mb-2">
                  SOP Title *
                </label>
                {createMode ? (
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter SOP title..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    required
                  />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-black">
                    {sop?.title}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                placeholder={createMode ? "Replace the template placeholders with your specific content..." : "Enter markdown content..."}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // View Mode
  if (!sop) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No SOP Selected</h3>
          <p>Choose an SOP from the list to view or create a new one</p>
        </div>
      </div>
    );
  }

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