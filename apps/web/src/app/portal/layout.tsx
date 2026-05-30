import { AuthGuard } from '@/components/auth/AuthGuard';
import { PortalHeader } from '@/components/layout/PortalHeader';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <PortalHeader />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
