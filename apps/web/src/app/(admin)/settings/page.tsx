'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await apiClient.get('/companies');
      return res.data.data;
    },
    enabled: isSuperAdmin,
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-1">Company and system configuration</p>
      </div>

      {/* Company info */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Company</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Company ID</p>
              <p className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
                {user?.companyId ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Your role</p>
              <p className="font-medium text-gray-900">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Your Profile</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Email</p>
            <p className="text-gray-900">{user?.email}</p>
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Change Password
          </button>
        </div>
      </div>

      {/* Super admin: company switcher */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <Globe className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">All Companies (SUPER_ADMIN)</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {companies?.map((company: { _id: string; name: string; cnpj?: string; isActive: boolean }) => (
              <div key={company._id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{company.cnpj ?? 'No CNPJ'}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    company.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {company.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
