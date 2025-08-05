import Link from 'next/link';
import { FileText, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-8">
          <FileText className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SOP Not Found</h1>
          <p className="text-gray-600 mb-6">
            The SOP you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Home
          </Link>
          
          <div className="text-sm text-gray-500">
            <p>Or try one of these:</p>
            <div className="mt-2 space-x-4">
              <Link href="/admin" className="text-blue-600 hover:text-blue-800 underline">
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}