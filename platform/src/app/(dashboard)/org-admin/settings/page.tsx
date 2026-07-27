'use client';

/**
 * Organization settings moved into the personal Settings page
 * (Settings → Organization → Organization profile). This route stays only so
 * old links keep working.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrgSettingsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings'); }, [router]);
  return null;
}
