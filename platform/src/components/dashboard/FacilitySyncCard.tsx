'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink } from '@/components/icons/lucide';

interface SyncElement {
  name: string;
  status: 'synced' | 'syncing' | 'pending';
}

// National HMIS / DHIS2 data streams shown on every facility dashboard.
const DEFAULT_SYNC_ELEMENTS: SyncElement[] = [
  { name: 'OPD Attendance', status: 'synced' },
  { name: 'Malaria Cases', status: 'synced' },
  { name: 'ANC Visits', status: 'synced' },
  { name: 'Immunizations', status: 'synced' },
  { name: 'Births', status: 'synced' },
  { name: 'Deaths', status: 'synced' },
  { name: 'Lab Results', status: 'synced' },
  { name: 'Referrals', status: 'synced' },
  { name: 'Inpatient Admissions', status: 'syncing' },
  { name: 'Drug Stock Levels', status: 'pending' },
];

/**
 * Facility Sync — the dotted progress-ring card from the clinical-officer
 * dashboard. Self-contained so any dashboard can drop it beside the hero.
 */
export default function FacilitySyncCard({
  className = '',
  elements = DEFAULT_SYNC_ELEMENTS,
}: {
  className?: string;
  elements?: SyncElement[];
}) {
  const router = useRouter();
  const syncedCount = elements.filter(e => e.status === 'synced').length;
  const syncPct = Math.round((syncedCount / elements.length) * 100);
  const pendingNames = elements.filter(e => e.status !== 'synced').map(e => e.name);

  return (
    <div className={`dash-card p-4 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>Facility Sync</h3>
        <button onClick={() => router.push('/dhis2-export')} className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--overlay-subtle)]" style={{ color: 'var(--accent-primary)' }} aria-label="Open sync" title="Open sync">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-4 flex-1">
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push('/dhis2-export')} className="btn btn-secondary btn-sm">Sync Now</button>
          {pendingNames.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                <span className="rounded-full flex-shrink-0" style={{ width: 20, height: 20, background: 'var(--color-warning)' }} /> Pending:
              </div>
              <ul className="mt-1 space-y-0.5">
                {pendingNames.map(n => (
                  <li key={n} className="text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* Dotted ring: one dot per data element, green=synced / amber=pending */}
        <div className="relative flex-shrink-0" style={{ width: 116, height: 116 }}>
          {elements.map((el, idx) => {
            const a = (idx / elements.length) * 2 * Math.PI - Math.PI / 2;
            const r = 48;
            const cx = 58 + r * Math.cos(a);
            const cy = 58 + r * Math.sin(a);
            return (
              <span
                key={el.name}
                className="absolute rounded-full"
                style={{
                  width: 16, height: 16, left: cx - 8, top: cy - 8,
                  background: el.status === 'synced' ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
            );
          })}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{syncPct}%</span>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t flex items-center gap-1.5" style={{ borderColor: 'var(--border-light)' }}>
        <span className="rounded-full flex-shrink-0" style={{ width: 20, height: 20, background: 'var(--color-success)' }} />
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Last synced: today · 08:00</span>
      </div>
    </div>
  );
}
