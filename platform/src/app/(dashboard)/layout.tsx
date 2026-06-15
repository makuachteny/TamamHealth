'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/lib/context';
import Sidebar from '@/components/Sidebar';
import RoleGuard from '@/components/RoleGuard';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import LockScreen from '@/components/LockScreen';
import ConnectivityNotice from '@/components/ConnectivityNotice';
import GetStartedCard from '@/components/onboarding/GetStartedCard';
import ForcePasswordChange from '@/components/ForcePasswordChange';
import { useAutoLock } from '@/lib/hooks/useAutoLock';
import { Loader2 } from '@/components/icons/lucide';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Messaging is an immersive, full-screen workspace: it hides the global nav
  // rail and chrome so the chat occupies the entire screen (a Back control in
  // the page returns to the rest of the app).
  const focusMode = !!pathname && pathname.startsWith('/messages');
  const { isAuthenticated, currentUser, dbReady, sidebarCollapsed, logout } = useApp();
  const orgTimeout = currentUser?.organization?.lockTimeoutMinutes;
  const { isLocked, hasPin, unlock, verifyPin, setPin } = useAutoLock(isAuthenticated, orgTimeout);

  useEffect(() => {
    if (dbReady && !isAuthenticated) {
      // Check if the cookie exists before redirecting — prevents a race condition
      // where state hasn't propagated yet but the user just logged in.
      const hasCookie = typeof document !== 'undefined' &&
        document.cookie.split(';').some(c => c.trim().startsWith('tamamhealth-token='));
      if (!hasCookie) {
        router.push('/login');
      }
    }
  }, [isAuthenticated, dbReady, router]);

  if (!dbReady || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen gradient-mesh-bg">
        <div className="flex flex-col items-center gap-4 relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/tamamhealth-logo.svg" alt="TamamHealth" className="w-14 h-14" style={{
            filter: 'drop-shadow(0 4px 12px rgba(10, 61, 107, 0.3))',
          }} />
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading TamamHealth...</p>
          </div>
        </div>
      </div>
    );
  }

  // Force a password change before any app content when the account is still on
  // an admin-issued temporary credential (freshly created or reset).
  if (currentUser?.mustChangePassword) {
    return <ForcePasswordChange userName={currentUser.name} onLogout={logout} />;
  }

  // Sidebar: 256px/80px + 12px left margin = 268px/92px. Content needs matching margin.
  const sidebarMargin = sidebarCollapsed ? '92px' : '268px';

  return (
    <div className="flex h-screen overflow-hidden gradient-mesh-bg">
      {isLocked && currentUser && (
        <LockScreen
          userName={currentUser.name}
          hasPin={hasPin}
          onVerifyPin={verifyPin}
          onSetPin={setPin}
          onUnlock={unlock}
          onLogout={logout}
        />
      )}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {!focusMode && <Sidebar />}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 transition-all duration-300 ease-in-out"
      >
        {!focusMode && (
          <style>{`
            @media (min-width: 1024px) {
              .dashboard-content-area { margin-left: ${sidebarMargin}; }
            }
          `}</style>
        )}
        <div className={`${focusMode ? '' : 'dashboard-content-area pt-3'} flex-1 flex flex-col min-w-0 overflow-hidden`}>
          <main id="main-content" className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
            <RoleGuard>{children}</RoleGuard>
            {/* First-run onboarding. Self-gates: only renders for a new user
                on their home dashboard, overlaying the content area. */}
            {!focusMode && <GetStartedCard />}
          </main>
        </div>
      </div>
      <KeyboardShortcuts />
      <ConnectivityNotice />
    </div>
  );
}
