import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-7xl font-bold text-gray-200">404</p>
        <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">Page not found</h2>
        <p className="text-gray-500 text-sm mb-6">The page you are looking for does not exist.</p>
        <Link
          href="/dashboard"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
