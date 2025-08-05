'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Edit, X } from 'lucide-react';
import SOPEditor from '@/components/admin/SOPEditor';

interface SOP {
  _id: string;
  sopId: string;
  title: string;
  phase: number;
  version: number;
  markdownContent: string;
  updatedAt: string;
}

export default function SOPManagement() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const loadSOPs = useCallback(async () => {
    setLoading(true);
    try {
      // Using the existing content-db API to get all SOPs
      const response = await fetch('/api/content-db?type=human&all=true');
      const data = await response.json();
      
      if (data.sops) {
        setSops(data.sops);
        if (data.sops.length > 0 && !selectedSOP) {
          setSelectedSOP(data.sops[0]);
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
          <h2 className="text-lg font-semibold text-gray-900">Standard Operating Procedures</h2>
          <p className="text-sm text-gray-600 mt-1">{sops.length} SOPs available</p>
        </div>
        
        <div className="overflow-y-auto">
          {sops.map((sop) => (
            <div
              key={sop.sopId}
              onClick={() => {
                setSelectedSOP(sop);
                setEditMode(false);
              }}
              className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedSOP?.sopId === sop.sopId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{sop.title}</h3>
                  <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                    <span>Phase {sop.phase}</span>
                    <span>•</span>
                    <span>v{sop.version}</span>
                    <span>•</span>
                    <span>{sop.sopId}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Updated {new Date(sop.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SOP Editor */}
      <div className="flex-1 bg-gray-50">
        {selectedSOP ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{selectedSOP.title}</h1>
                  <p className="text-sm text-gray-600">
                    {selectedSOP.sopId} • Phase {selectedSOP.phase} • Version {selectedSOP.version}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit SOP
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <SOPEditor
                sop={selectedSOP}
                editMode={editMode}
                onSOPUpdate={handleSOPUpdate}
                onEditModeChange={setEditMode}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select an SOP</h3>
              <p>Choose an SOP from the list to view or edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}