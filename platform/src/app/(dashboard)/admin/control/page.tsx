'use client';

/**
 * The Control Center has been superseded by the split Risk Center / Audit
 * Logs / Security & Compliance surfaces. This route stays registered (old
 * links, bookmarks) and just forwards on. SuperAdminControlCenter.tsx is
 * kept around, unused, rather than deleted.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminControlCenterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/security');
  }, [router]);

  return null;
}
