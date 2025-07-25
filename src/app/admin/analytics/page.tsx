'use client';

import { useState, useEffect } from 'react';
import { BarChart, TrendingUp, Users, MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, FileText } from 'lucide-react';

interface AnalyticsData {
  userFeedback: {
    totalReports: number;
    byStatus: Record<string, number>;
    bySOP: Record<string, number>;
    recentGaps: Array<{
      id: string;
      sopId: string;
      userComment: string;
      createdAt: string;
    }>;
  };
  messageFeedback: {
    totalRatings: number;
    byRating: Record<string, number>;
    bySOP: Record<string, { helpful: number; not_helpful: number; total: number; rate: number }>;
    confidenceAccuracy: Array<{
      confidenceRange: string;
      total: number;
      helpful: number;
      helpfulnessRate: number;
    }>;
  };
  usage: {
    totalSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    sopUsageFrequency: Record<string, number>;
    recentActivity: Array<{
      date: string;
      sessions: number;
      messages: number;
    }>;
  };
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feedback' | 'ratings' | 'usage'>('feedback');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Load user feedback analytics
      const feedbackRes = await fetch('/api/user-feedback?analytics=true');
      const feedbackData = await feedbackRes.json();

      // Load message ratings analytics
      const ratingsRes = await fetch('/api/message-feedback?stats=all');
      const ratingsData = await ratingsRes.json();

      // Load usage analytics
      const sessionsRes = await fetch('/api/sessions?analytics=true');
      const sessionsData = await sessionsRes.json();

      setAnalytics({
        userFeedback: feedbackData,
        messageFeedback: ratingsData,
        usage: sessionsData
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor user feedback, ratings, and system usage</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Gap Reports</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.userFeedback.totalReports}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Message Ratings</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.messageFeedback.totalRatings}</p>
            </div>
            <ThumbsUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.usage.totalSessions}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Messages/Session</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.usage.avgMessagesPerSession.toFixed(1)}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'feedback'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              User Feedback
            </button>
            <button
              onClick={() => setActiveTab('ratings')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'ratings'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Message Ratings
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'usage'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Usage Stats
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* User Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Gap Reports by SOP</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.userFeedback.bySOP).map(([sopId, count]) => (
                    <div key={sopId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">{sopId}</span>
                      <span className="text-orange-600 font-semibold">{count} reports</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Gap Reports</h3>
                <div className="space-y-3">
                  {analytics.userFeedback.recentGaps.slice(0, 5).map((gap) => (
                    <div key={gap.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{gap.userComment}</p>
                          <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{gap.sopId}</span>
                            <span>{new Date(gap.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message Ratings Tab */}
          {activeTab === 'ratings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Ratings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Helpful</p>
                        <p className="text-2xl font-bold text-green-700">
                          {analytics.messageFeedback.byRating.helpful || 0}
                        </p>
                      </div>
                      <ThumbsUp className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Not Helpful</p>
                        <p className="text-2xl font-bold text-red-700">
                          {analytics.messageFeedback.byRating.not_helpful || 0}
                        </p>
                      </div>
                      <ThumbsDown className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Helpfulness by SOP</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.messageFeedback.bySOP).map(([sopId, stats]) => (
                    <div key={sopId} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{sopId}</span>
                        <span className="text-sm text-gray-600">{stats.rate.toFixed(1)}% helpful</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-600">👍 {stats.helpful}</span>
                        <span className="text-red-600">👎 {stats.not_helpful}</span>
                        <span className="text-gray-500">Total: {stats.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Confidence vs Accuracy</h3>
                <div className="space-y-2">
                  {analytics.messageFeedback.confidenceAccuracy.map((range) => (
                    <div key={range.confidenceRange} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {typeof range.confidenceRange === 'number' 
                            ? `${(range.confidenceRange * 100).toFixed(0)}-${((range.confidenceRange + 0.1) * 100).toFixed(0)}%`
                            : range.confidenceRange}
                        </span>
                        <div className="text-sm">
                          <span className="text-gray-600">Helpful rate: </span>
                          <span className="font-semibold text-green-600">
                            {range.helpfulnessRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Usage Stats Tab */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">SOP Usage Frequency</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.usage.sopUsageFrequency)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sopId, count]) => (
                      <div key={sopId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="font-medium">{sopId}</span>
                        <span className="text-blue-600 font-semibold">{count} uses</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-2">
                  {analytics.usage.recentActivity.map((activity) => (
                    <div key={activity.date} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{activity.date}</span>
                        <div className="text-sm space-x-4">
                          <span className="text-blue-600">{activity.sessions} sessions</span>
                          <span className="text-purple-600">{activity.messages} messages</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}