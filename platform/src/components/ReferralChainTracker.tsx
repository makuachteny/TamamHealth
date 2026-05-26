'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Home, Activity, CheckCircle2, Clock, AlertTriangle } from '@/components/icons/lucide';
import type { ReferralDoc } from '@/lib/db-types';

interface FacilityLevel {
  id: string;
  shortLabel: string;
  icon: typeof Building2;
  color: string;
  prefixes: string[];
}

const FACILITY_LEVELS: FacilityLevel[] = [
  { id: 'boma', shortLabel: 'Boma', icon: Home, color: 'var(--color-success)', prefixes: ['boma-'] },
  { id: 'phcu', shortLabel: 'PHCU', icon: Building2, color: 'var(--accent-primary)', prefixes: ['phcu-'] },
  { id: 'phcc', shortLabel: 'PHCC', icon: Building2, color: 'var(--accent-primary)', prefixes: ['phcc-'] },
  { id: 'county', shortLabel: 'County', icon: Building2, color: 'var(--accent-primary)', prefixes: ['county-'] },
  { id: 'state', shortLabel: 'State', icon: Building2, color: 'var(--color-warning)', prefixes: ['hosp-'] },
  { id: 'national', shortLabel: 'National', icon: Activity, color: 'var(--color-danger)', prefixes: ['nat-'] },
];

function getFacilityLevel(facilityId: string): string {
  for (const level of FACILITY_LEVELS) {
    if (level.prefixes.some(p => facilityId.startsWith(p))) return level.id;
  }
  if (facilityId.startsWith('hosp-')) return 'state';
  return 'unknown';
}

interface ReferralChainTrackerProps {
  referrals: ReferralDoc[];
  currentFacilityId?: string;
  compact?: boolean;
}

export default function ReferralChainTracker({ referrals, currentFacilityId, compact = false }: ReferralChainTrackerProps) {
  const router = useRouter();

  const levelStats = useMemo(() => {
    const stats: Record<string, { incoming: number; outgoing: number; pending: number; accepted: number }> = {};
    for (const level of FACILITY_LEVELS) {
      stats[level.id] = { incoming: 0, outgoing: 0, pending: 0, accepted: 0 };
    }
    for (const ref of referrals) {
      const fromLevel = getFacilityLevel(ref.fromHospitalId);
      const toLevel = getFacilityLevel(ref.toHospitalId);
      if (stats[fromLevel]) stats[fromLevel].outgoing++;
      if (stats[toLevel]) {
        stats[toLevel].incoming++;
        if (ref.status === 'sent' || ref.status === 'received') stats[toLevel].pending++;
        if (ref.status === 'seen' || ref.status === 'completed') stats[toLevel].accepted++;
      }
    }
    return stats;
  }, [referrals]);

  const activeFlows = useMemo(() => {
    const flowMap: Record<string, { count: number; urgent: number }> = {};
    for (const ref of referrals) {
      if (ref.status === 'completed' || ref.status === 'cancelled') continue;
      const from = getFacilityLevel(ref.fromHospitalId);
      const to = getFacilityLevel(ref.toHospitalId);
      const key = `${from}->${to}`;
      if (!flowMap[key]) flowMap[key] = { count: 0, urgent: 0 };
      flowMap[key].count++;
      if (ref.urgency === 'emergency' || ref.urgency === 'urgent') flowMap[key].urgent++;
    }
    return Object.entries(flowMap).map(([key, val]) => {
      const [from, to] = key.split('->');
      return { from, to, ...val };
    });
  }, [referrals]);

  const recentReferrals = useMemo(() => {
    return [...referrals]
      .filter(r => r.status !== 'completed' && r.status !== 'cancelled')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, compact ? 3 : 6);
  }, [referrals, compact]);

  const currentLevel = currentFacilityId ? getFacilityLevel(currentFacilityId) : null;

  return (
    <div className="space-y-4">
      {/* Facility Level Pipeline */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--card-shadow)',
      }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Referral Chain</span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {referrals.filter(r => r.status === 'sent' || r.status === 'received').length} active
          </span>
        </div>

        <div className="p-4 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-[600px]">
            {FACILITY_LEVELS.map((level, idx) => {
              const stats = levelStats[level.id];
              const isCurrentLevel = currentLevel === level.id;
              const hasActivity = stats.incoming > 0 || stats.outgoing > 0;
              const Icon = level.icon;

              return (
                <div key={level.id} className="flex items-center flex-1">
                  <div
                    className="flex-1 p-2.5 rounded-xl transition-all cursor-pointer relative"
                    style={{
                      background: isCurrentLevel ? `${level.color}12` : hasActivity ? 'var(--overlay-subtle)' : 'transparent',
                      border: isCurrentLevel ? `2px solid ${level.color}40` : `1px solid ${hasActivity ? 'var(--border-light)' : 'transparent'}`,
                      opacity: hasActivity || isCurrentLevel ? 1 : 0.4,
                    }}
                    onClick={() => router.push('/referrals')}
                  >
                    {isCurrentLevel && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{
                        background: level.color, boxShadow: `0 0 8px ${level.color}60`,
                      }} />
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5" style={{ color: level.color }} />
                      <span className="text-[10px] font-bold" style={{ color: level.color }}>{level.shortLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {stats.pending > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" style={{ color: 'var(--color-warning)' }} />
                          <span className="text-[9px] font-bold" style={{ color: 'var(--color-warning)' }}>{stats.pending}</span>
                        </div>
                      )}
                      {stats.accepted > 0 && (
                        <div className="flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" style={{ color: 'var(--color-success)' }} />
                          <span className="text-[9px] font-bold" style={{ color: 'var(--color-success)' }}>{stats.accepted}</span>
                        </div>
                      )}
                      {stats.incoming === 0 && stats.outgoing === 0 && (
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </div>

                  {idx < FACILITY_LEVELS.length - 1 && (
                    <div className="px-1 flex-shrink-0">
                      {(() => {
                        const flow = activeFlows.find(f =>
                          (f.from === level.id && f.to === FACILITY_LEVELS[idx + 1].id) ||
                          (f.to === level.id && f.from === FACILITY_LEVELS[idx + 1].id)
                        );
                        return (
                          <div className="flex flex-col items-center">
                            <ArrowRight className="w-3.5 h-3.5" style={{
                              color: flow ? (flow.urgent > 0 ? 'var(--color-danger)' : 'var(--accent-primary)') : 'var(--border-light)',
                              opacity: flow ? 1 : 0.3,
                            }} />
                            {flow && flow.count > 0 && (
                              <span className="text-[8px] font-bold" style={{
                                color: flow.urgent > 0 ? 'var(--color-danger)' : 'var(--accent-primary)',
                              }}>{flow.count}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Referrals List */}
      {recentReferrals.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: 'var(--card-shadow)',
        }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Active Referrals</span>
            <button onClick={() => router.push('/referrals')} className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>View all →</button>
          </div>
          <div className="p-3 space-y-1.5">
            {recentReferrals.map(ref => (
              <div key={ref._id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all"
                onClick={() => router.push('/referrals')}
                style={{
                  background: ref.urgency === 'emergency' ? 'rgba(201,69,69,0.06)' : 'var(--overlay-subtle)',
                  border: `1px solid ${ref.urgency === 'emergency' ? 'rgba(201,69,69,0.2)' : 'var(--border-light)'}`,
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: ref.urgency === 'emergency' ? 'var(--color-danger)' : ref.urgency === 'urgent' ? 'var(--color-warning)' : 'var(--accent-primary)' }}>
                  {(ref.patientName || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ref.patientName}</p>
                  <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {ref.fromHospital || ref.fromHospitalId} → {ref.toHospital || ref.toHospitalId}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                    background: ref.status === 'seen' ? 'rgba(74,222,128,0.12)' : 'rgba(27, 154, 170,0.12)',
                    color: ref.status === 'seen' ? 'var(--color-success)' : 'var(--accent-primary)',
                  }}>{ref.status.toUpperCase()}</span>
                  {ref.urgency && ref.urgency !== 'routine' && (
                    <div className="flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" style={{ color: ref.urgency === 'emergency' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
                      <span className="text-[8px] font-bold" style={{ color: ref.urgency === 'emergency' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {ref.urgency.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
