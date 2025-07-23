'use client';

import { useState } from 'react';
import { Check, X, MessageSquare, User, Clock, FileText, ExternalLink } from 'lucide-react';

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

interface ProposalReviewProps {
  proposal: Proposal;
  onProposalUpdate: (proposal: Proposal) => void;
}

export default function ProposalReview({ proposal, onProposalUpdate }: ProposalReviewProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  const handleApprove = async () => {
    await handleAction('approve', comment);
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    await handleAction('reject', comment);
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    await handleAction('review', comment);
  };

  const handleAction = async (action: string, comments?: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.proposalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          performedBy: 'admin', // TODO: Replace with actual user
          comments,
          reason: action === 'reject' ? comments : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        onProposalUpdate(data.proposal);
        setComment('');
        setShowCommentBox(false);
      } else {
        alert('Failed to perform action');
      }
    } catch (error) {
      console.error('Action failed:', error);
      alert('Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {proposal.humanSopId.title}
              </h1>
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(proposal.status)}`}>
                {proposal.status.replace('_', ' ')}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(proposal.priority)}`}>
                {proposal.priority} priority
              </span>
            </div>
            <p className="text-sm text-gray-600 font-mono">{proposal.proposalId}</p>
          </div>
          
          {proposal.status === 'pending_review' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCommentBox(!showCommentBox)}
                className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={actionLoading}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Add Comment
              </button>
              <button
                onClick={handleReject}
                className="flex items-center px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700"
                disabled={actionLoading}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                disabled={actionLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </button>
            </div>
          )}
        </div>

        {/* Comment Box */}
        {showCommentBox && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={proposal.status === 'pending_review' ? 'Add review comments or rejection reason...' : 'Add comments...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
              rows={3}
            />
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={() => {
                  setShowCommentBox(false);
                  setComment('');
                }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={!comment.trim() || actionLoading}
                className="px-3 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Comment
              </button>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div className="flex items-center text-gray-600">
            <User className="w-4 h-4 mr-2" />
            {proposal.metrics.affectedUsersCount} user{proposal.metrics.affectedUsersCount !== 1 ? 's' : ''} affected
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            {Math.round(proposal.metrics.confidenceScore * 100)}% confidence
          </div>
          <div className="flex items-center text-gray-600">
            <FileText className="w-4 h-4 mr-2" />
            {proposal.proposedChange.changeType} change
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Trigger Query */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Original Question</h3>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-gray-800">&ldquo;{proposal.triggerQuery}&rdquo;</p>
          </div>
        </div>

        {/* Rationale */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Rationale</h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-800">{proposal.proposedChange.rationale}</p>
          </div>
        </div>

        {/* Side-by-side Diff */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Proposed Changes to: {proposal.proposedChange.section}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Original Content */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-red-200 rounded-full mr-2"></span>
                Current Content
              </h4>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg min-h-32">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {proposal.proposedChange.originalContent || 'No existing content'}
                </pre>
              </div>
            </div>

            {/* Suggested Content */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-3 h-3 bg-green-200 rounded-full mr-2"></span>
                Proposed Content
              </h4>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg min-h-32">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {proposal.proposedChange.suggestedContent}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* SOP Context */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">SOP Context</h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{proposal.humanSopId.title}</p>
                <p className="text-sm text-gray-600">
                  SOP ID: {proposal.sopId} • Version: {proposal.humanSopId.version}
                </p>
              </div>
              <button className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full SOP
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}