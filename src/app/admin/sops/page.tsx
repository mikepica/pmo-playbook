'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Edit, X, Plus, Trash2 } from 'lucide-react';
import SOPEditor from '@/components/admin/SOPEditor';

interface SOP {
  _id: string;
  sopId: string;
  title: string;
  version: number;
  markdownContent: string;
  updatedAt: string;
}

export default function SOPManagement() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const loadSOPs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/content-db?type=human&all=true');
      const data = await response.json();
      
      if (data.sops) {
        // Sort SOPs by SOP ID for consistent ordering
        const sortedSOPs = data.sops.sort((a: SOP, b: SOP) => a.sopId.localeCompare(b.sopId));
        setSops(sortedSOPs);
        if (sortedSOPs.length > 0 && !selectedSOP) {
          setSelectedSOP(sortedSOPs[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load SOPs:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSOP]);

  useEffect(() => {
    loadSOPs();
  }, [loadSOPs]);

  const handleSOPUpdate = (updatedSOP: SOP) => {
    setSops(prev => prev.map(sop => 
      sop.sopId === updatedSOP.sopId ? updatedSOP : sop
    ));
    setSelectedSOP(updatedSOP);
  };

  const handleSOPCreate = (newSOP: SOP) => {
    setSops(prev => [...prev, newSOP].sort((a, b) => a.sopId.localeCompare(b.sopId)));
    setSelectedSOP(newSOP);
    setCreateMode(false);
    setEditMode(false);
  };

  const handleCreateNew = () => {
    setSelectedSOP(null);
    setCreateMode(true);
    setEditMode(true);
  };

  const handleCancelCreate = () => {
    setCreateMode(false);
    setEditMode(false);
    // If there are SOPs, select the first one
    if (sops.length > 0) {
      setSelectedSOP(sops[0]);
    }
  };

  const handleDelete = async (sopId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will permanently delete both the Human SOP and Agent SOP. This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/content-db?sopId=${encodeURIComponent(sopId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Remove the SOP from the list
        setSops(prev => prev.filter(sop => sop.sopId !== sopId));
        
        // If this was the selected SOP, select another one or clear selection
        if (selectedSOP?.sopId === sopId) {
          const remainingSops = sops.filter(sop => sop.sopId !== sopId);
          setSelectedSOP(remainingSops.length > 0 ? remainingSops[0] : null);
          setEditMode(false);
          setCreateMode(false);
        }
        
        // Show success message
        alert(`SOP "${title}" has been successfully deleted.`);
        
      } else {
        const errorData = await response.json();
        alert(`Failed to delete SOP: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete SOP error:', error);
      alert('Failed to delete SOP. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SOPs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* SOP List */}
      <div className="w-1/4 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Standard Operating Procedures</h2>
            <button
              onClick={handleCreateNew}
              className="flex items-center px-3 py-1 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </button>
          </div>
          <p className="text-sm text-gray-600">{sops.length} SOPs available</p>
        </div>
        
        <div className="overflow-y-auto">
          {sops.map((sop) => (
            <div
              key={sop.sopId}
              onClick={() => {
                setSelectedSOP(sop);
                setEditMode(false);
                setCreateMode(false);
              }}
              className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedSOP?.sopId === sop.sopId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-black truncate">{sop.title}</h3>
                  <div className="flex items-center space-x-2 mt-1 text-xs text-black">
                    <span>v{sop.version}</span>
                    <span>•</span>
                    <span>{sop.sopId}</span>
                  </div>
                  <p className="text-xs text-black mt-1">
                    Updated {new Date(sop.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
          
          {sops.length === 0 && (
            <div className="p-4 text-sm text-black italic text-center">
              No SOPs available. Create your first SOP to get started.
            </div>
          )}
        </div>
      </div>

      {/* SOP Editor */}
      <div className="flex-1 bg-gray-50">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                {createMode ? (
                  <>
                    <h1 className="text-xl font-semibold text-black">Create New SOP</h1>
                    <p className="text-sm text-black">
                      Fill in the details below to create a new Standard Operating Procedure
                    </p>
                  </>
                ) : selectedSOP ? (
                  <>
                    <h1 className="text-xl font-semibold text-black">{selectedSOP.title}</h1>
                    <p className="text-sm text-black">
                      {selectedSOP.sopId} • Version {selectedSOP.version}
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-black">SOP Management</h1>
                    <p className="text-sm text-black">
                      Select an SOP from the list to view or edit, or create a new one
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {createMode ? (
                  <button
                    onClick={handleCancelCreate}
                    className="flex items-center px-3 py-2 text-sm text-black bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                ) : editMode ? (
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex items-center px-3 py-2 text-sm text-black bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                ) : selectedSOP ? (
                  <>
                    <button
                      onClick={() => handleDelete(selectedSOP.sopId, selectedSOP.title)}
                      className="flex items-center px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit SOP
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {createMode || (selectedSOP && editMode) || (!createMode && selectedSOP) ? (
              <SOPEditor
                sop={selectedSOP}
                editMode={editMode || createMode}
                createMode={createMode}
                onSOPUpdate={handleSOPUpdate}
                onSOPCreate={handleSOPCreate}
                onEditModeChange={setEditMode}
                onCancel={handleCancelCreate}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-black">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">Select an SOP</h3>
                  <p>Choose an SOP from the list to view or edit, or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}