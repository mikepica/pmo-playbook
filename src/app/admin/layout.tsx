import { Settings, FileText, Users, BarChart3, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">PMO Admin Dashboard</h1>
            </div>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm border-r border-gray-200">
          <div className="p-4">
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin/user-feedback"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900"
                >
                  <MessageSquare className="w-4 h-4 mr-3" />
                  User Feedback
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/proposals"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-700"
                >
                  <FileText className="w-4 h-4 mr-3" />
                  Legacy Proposals
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/sops"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900"
                >
                  <Settings className="w-4 h-4 mr-3" />
                  Manage SOPs
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/analytics"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900"
                >
                  <BarChart3 className="w-4 h-4 mr-3" />
                  Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/users"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900"
                >
                  <Users className="w-4 h-4 mr-3" />
                  Users & Sessions
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}