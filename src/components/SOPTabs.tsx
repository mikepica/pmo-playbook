'use client';

import { useState, useEffect } from 'react';
import { FileText, Settings } from 'lucide-react';
import Link from 'next/link';

interface SOP {
  id: string;
  filename: string;
  title: string;
  phase: number;
}

interface SOPTabsProps {
  selectedSOP: string | null;
  onSOPSelect: (sopId: string) => void;
  onSOPsLoaded?: (sops: SOP[]) => void;
}

export default function SOPTabs({ selectedSOP, onSOPSelect, onSOPsLoaded }: SOPTabsProps) {
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSOPs = async () => {
      try {
        const response = await fetch('/api/files-db?type=markdown');
        const data = await response.json();
        const sopList = data.sops || [];
        setSOPs(sopList);
        onSOPsLoaded?.(sopList);
      } catch (error) {
        console.error('Failed to fetch SOPs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSOPs();
  }, [onSOPsLoaded]);

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-3 text-gray-600" />
          <div className="text-sm text-gray-600 mr-4">PMO SOPs:</div>
          <div className="flex flex-wrap gap-2">
            {sops.map((sop) => (
              <button
                key={sop.id}
                onClick={() => onSOPSelect(sop.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSOP === sop.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                }`}
                title={sop.title}
              >
                Phase {sop.phase}: {sop.title}
              </button>
            ))}
          </div>
        </div>
        <Link
          href="/admin"
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Settings className="w-4 h-4 mr-2" />
          Admin Panel
        </Link>
      </div>
      
      {sops.length === 0 && (
        <div className="text-gray-500 text-sm px-4 py-3">
          No SOPs found in the database.
        </div>
      )}
    </div>
  );
}