'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context';
import EhrTopRail from '@/components/ehr/EhrTopRail';
import RoleGuard from '@/components/RoleGuard';
import { SettingsProvider } from '@/lib/settings/SettingsProvider';
import PreferenceEffects from '@/components/PreferenceEffects';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import LockScreen from '@/components/LockScreen';
import ConnectivityNotice from '@/components/ConnectivityNotice';
import { TourProvider } from '@/lib/tour/tour-context';
import GetStartedCard from '@/components/onboarding/GetStartedCard';
import ForcePasswordChange from '@/components/ForcePasswordChange';
import { useAutoLock } from '@/lib/hooks/useAutoLock';
import { Loader2 } from '@/components/icons/lucide';
import { useIsMobileViewport } from '@/lib/hooks/useIsMobileViewport';
import { getMobileShellArchetype } from '@/lib/mobile-shell/dashboard-strategy';
import MobileAppShell from '@/components/mobile/MobileAppShell';
import UsageTracker from '@/components/UsageTracker';
import EhrAttentionRail from '@/components/ehr/EhrAttentionRail';
import { AttentionRailProvider, useAttentionRailOwnedByPage } from '@/lib/attention-rail';

/**
 * The module body and the shared "Needs your attention" rail, side by side.
 * Split into its own component so it can read the rail-ownership context that
 * the provider below it establishes — a screen with its own right rail (the
 * doctor and care dashboards) suppresses this one instead of showing two.
 */
function DashboardBody({ children }: { children: React.ReactNode }) {
  const pageOwnsRail = useAttentionRailOwnedByPage();
  return (
    <div className="dashboard-content-area flex-1 flex min-w-0 overflow-hidden">
      <main id="main-content" className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        <RoleGuard>{children}</RoleGuard>
        <GetStartedCard />
      </main>
      {!pageOwnsRail && <EhrAttentionRail />}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, currentUser, dbReady, logout } = useAuth();
  const orgTimeout = currentUser?.organization?.lockTimeoutMinutes;
  const { isLocked, hasPin, unlock, verifyPin, setPin } = useAutoLock(isAuthenticated, orgTimeout);
  const isMobile = useIsMobileViewport();
  const mobileArchetype = currentUser ? getMobileShellArchetype(currentUser.role) : undefined;
  const useShell = isMobile && !!mobileArchetype;

  useEffect(() => {
    if (dbReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, dbReady, router]);

  if (!dbReady || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen tamam-solid-bg">
        <div className="flex flex-col items-center gap-4 relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logos/SVG/Tamam_Style_Guide-33.svg" alt="TamamHealth" className="w-14 h-14" />
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

  return (
    <SettingsProvider>
    <TourProvider>
    <AttentionRailProvider>
    <div className="flex h-screen overflow-hidden tamam-solid-bg tamam-ehr-app">
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
      {useShell ? (
        <MobileAppShell archetype={mobileArchetype!}>
          <RoleGuard>{children}</RoleGuard>
        </MobileAppShell>
      ) : (
        <>
          <EhrTopRail />
          <div
            className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 transition-all duration-300 ease-in-out tamam-ehr-content-frame"
          >
            <DashboardBody>{children}</DashboardBody>
          </div>
        </>
      )}
      <PreferenceEffects />
      <KeyboardShortcuts />
      <ConnectivityNotice />
      <UsageTracker />
    </div>
    </AttentionRailProvider>
    </TourProvider>
    </SettingsProvider>
  );
}
