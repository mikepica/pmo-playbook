'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SOP {
  id: string;
  slug?: string;
  filename: string;
  title: string;
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSOPs = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/api/files-db?type=markdown', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const sopList: SOP[] = data.sops || [];
        
        if (sopList.length > 0) {
          // Find the pre-initiation phase SOP, or fallback to first SOP with slug
          const preInitiationSOP = sopList.find(sop => 
            sop.slug === 'pre-initiation-phase' || 
            sop.title.toLowerCase().includes('pre-initiation')
          );
          const targetSOP = preInitiationSOP || sopList.find(sop => sop.slug) || sopList[0];
          
          // Use slug if available, otherwise use ID
          const identifier = targetSOP.slug || targetSOP.id;
          router.replace(`/sop/${identifier}`);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch SOPs:', error);
        setLoading(false);
      }
    };

    fetchSOPs();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PMO Playbook...</p>
        </div>
      </div>
    );
  }

  // Fallback if no SOPs found
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">PMO Playbook</h1>
        <p className="text-gray-600 mb-4">No SOPs found in the database.</p>
        <a 
          href="/admin" 
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Go to Admin Panel
        </a>
      </div>
    </div>
  );
}
