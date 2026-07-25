'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SuperAdminControlCenter from '@/components/admin/SuperAdminControlCenter';
import { useApp } from '@/lib/context';

export default function AdminControlCenterPage() {
  const router = useRouter();
  const { currentUser } = useApp();

  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  return (
    <>
      <TopBar title="Control Center" />
      <main className="page-container page-enter admin-detail-page admin-detail-page--control">
        <SuperAdminControlCenter />
      </main>
    </>
  );
}
