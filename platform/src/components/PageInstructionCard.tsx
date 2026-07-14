'use client';

// A short, dismissible "how to use this page" hint shown at the top of a
// feature page. Reuses the same copy (and the same completed-step bookkeeping)
// as the first-run onboarding checklist (GetStartedCard) — dismissing this
// card marks the matching onboarding step done, so a user who skipped the
// initial checklist still gets taught the page, and one who already did the
// checklist never sees this repeated.

import { usePathname } from 'next/navigation';
import { HelpCircle, X } from '@/components/icons/lucide';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import { ROUTE_GUIDE } from '@/lib/onboarding/steps';

export default function PageInstructionCard() {
  const pathname = usePathname();
  const { ready, completedStepIds, completeStep } = useOnboarding();
  const guide = pathname ? ROUTE_GUIDE[pathname] : undefined;
  const stepId = `route:${pathname}`;

  if (!ready || !guide || completedStepIds.has(stepId)) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-3.5 mb-4"
      style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-card-solid)' }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--accent-light)' }}
      >
        <HelpCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{guide.verb}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{guide.desc}</p>
      </div>
      <button
        onClick={() => completeStep(stepId)}
        aria-label="Dismiss"
        title="Got it, don't show again"
        className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
        style={{ color: 'var(--text-muted)' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
