'use client';

import { Clock, AlertCircle, CheckCircle, XCircle, Filter } from 'lucide-react';

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

interface ProposalListProps {
  proposals: Proposal[];
  selectedProposal: Proposal | null;
  onProposalSelect: (proposal: Proposal) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  loading: boolean;
}

export default function ProposalList({
  proposals,
  selectedProposal,
  onProposalSelect,
  filter,
  onFilterChange,
  loading
}: ProposalListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'addition':
        return 'bg-blue-100 text-blue-800';
      case 'modification':
        return 'bg-purple-100 text-purple-800';
      case 'deletion':
        return 'bg-red-100 text-red-800';
      case 'clarification':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filterOptions = [
    { value: 'pending_review', label: 'Pending Review', count: proposals.filter(p => p.status === 'pending_review').length },
    { value: 'approved', label: 'Approved', count: proposals.filter(p => p.status === 'approved').length },
    { value: 'rejected', label: 'Rejected', count: proposals.filter(p => p.status === 'rejected').length },
    { value: '', label: 'All', count: proposals.length }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header with Filter */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Change Proposals</h2>
          <Filter className="w-4 h-4 text-gray-500" />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filter === option.value
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
      </div>

      {/* Proposal List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-20 rounded"></div>
              ))}
            </div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="font-medium mb-2">No proposals found</h3>
            <p className="text-sm">No change proposals match the current filter</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {proposals.map((proposal) => (
              <div
                key={proposal.proposalId}
                onClick={() => onProposalSelect(proposal)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedProposal?.proposalId === proposal.proposalId
                    ? 'bg-blue-50 border-r-2 border-blue-500'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                   {getStatusIcon(proposal.status)}
                    <span className="text-sm font-mono text-gray-600">
                      {proposal.proposalId}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(proposal.priority)}`}>
                      {proposal.priority}
                    </span>
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                  {proposal.humanSopId.title} - {proposal.proposedChange.section}
                </h3>

                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {proposal.triggerQuery}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded ${getChangeTypeColor(proposal.proposedChange.changeType)}`}>
                      {proposal.proposedChange.changeType}
                    </span>
                    <span>
                      {proposal.metrics.affectedUsersCount} user{proposal.metrics.affectedUsersCount !== 1 ? 's' : ''}
                    </span>
                    <span>
                      {Math.round(proposal.metrics.confidenceScore * 100)}% confidence
                    </span>
                  </div>
                  <span>{formatDate(proposal.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}