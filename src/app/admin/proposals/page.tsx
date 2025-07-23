'use client';

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import ProposalList from '@/components/admin/ProposalList';
import ProposalReview from '@/components/admin/ProposalReview';

interface Proposal {
  _id: string;
  proposalId: string;
  sopId: string;
  triggerQuery: string;
  proposedChange: {
    section: string;
    originalContent: string;
    suggestedContent: string;
    changeType: string;
    rationale: string;
  };
  status: string;
  priority: string;
  metrics: {
    confidenceScore: number;
    affectedUsersCount: number;
  };
  createdAt: string;
  humanSopId: {
    title: string;
    version: number;
  };
}

export default function ProposalsPage() {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');

  useEffect(() => {
    loadProposals();
  }, [filter]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/proposals?status=${filter}&limit=50`);
      const data = await response.json();
      
      if (data.proposals) {
        setProposals(data.proposals);
      }
    } catch (error) {
      console.error('Failed to load proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProposalUpdate = (updatedProposal: Proposal) => {
    setProposals(prev => 
      prev.map(p => 
        p.proposalId === updatedProposal.proposalId ? updatedProposal : p
      )
    );
    // If the updated proposal was selected, update the selection
    if (selectedProposal?.proposalId === updatedProposal.proposalId) {
      setSelectedProposal(updatedProposal);
    }
  };

  const handleProposalSelect = (proposal: Proposal) => {
    setSelectedProposal(proposal);
  };

  if (loading && proposals.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Notice */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-800">
              <strong>Legacy System:</strong> AI-generated proposals have been disabled. This page shows historical proposals only. 
              <a href="/admin/user-feedback" className="underline ml-1">Switch to User Feedback</a> for the new system.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Proposal List */}
        <div className="w-1/3 border-r border-gray-200 bg-white">
          <ProposalList
            proposals={proposals}
            selectedProposal={selectedProposal}
            onProposalSelect={handleProposalSelect}
            filter={filter}
            onFilterChange={setFilter}
            loading={loading}
          />
        </div>

        {/* Proposal Review */}
        <div className="flex-1 bg-gray-50">
          {selectedProposal ? (
            <ProposalReview
              proposal={selectedProposal}
              onProposalUpdate={handleProposalUpdate}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Select a Proposal</h3>
                <p>Choose a proposal from the list to review and take action</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}