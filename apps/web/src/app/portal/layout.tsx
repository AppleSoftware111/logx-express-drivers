import Link from 'next/link';
import { Truck } from 'lucide-react';

import { AuthGuard } from '@/components/auth/AuthGuard';

const portalNav = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/deliveries', label: 'Deliveries' },
  { href: '/portal/tracking', label: 'Live Tracking' },
  { href: '/portal/pod', label: 'Proof of Delivery' },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900">LOGX Express</span>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-medium">
              Client Portal
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {portalNav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
    </AuthGuard>
  );
}
