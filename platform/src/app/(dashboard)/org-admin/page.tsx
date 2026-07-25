'use client';

/**
 * Org admin — Network Overview.
 *
 * Implements design "12 Org Overview" from the Claude Design project
 * (KPI strip with sparklines, 12-week attendance trend, facility league
 * table, state comparison, and a right rail with reporting compliance,
 * network alerts, and service mix). All numbers are computed from real
 * local data — hospitals, medical records, admissions, payments, pharmacy
 * inventory, ANC, immunizations, and audit logs. No fabricated metrics:
 * cards without a real historical series simply omit the sparkline/delta.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { useApp } from '@/lib/context';
import { Building2, Calendar, Download, AlertTriangle, Loader2 } from '@/components/icons/lucide';
import type { HospitalDoc } from '@/lib/db-types';
import type { AdmissionDoc } from '@/lib/db-types-ward';

// ── Design palette (12 Org Overview) ────────────────────────────────────────
const C = {
  text: '#102634',
  muted: '#597386',
  border: '#D8E3EC',
  rowBorder: '#E7EEF5',
  track: '#EDF2F7',
  blue: '#2191D0',
  deep: '#015697',
  orange: '#EB6834',
  green: '#167755',
  amber: '#B55E13',
  red: '#C24135',
  slate: '#3D5967',
};

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
  color: C.text,
};

// ── Tiny chart primitives (inline SVG, from the design's chart math) ────────

function Spark({ pts, color }: { pts: number[]; color: string }) {
  if (pts.length < 2) return null;
  const w = 74, h = 30;
  const max = Math.max(...pts), min = Math.min(...pts);
  const span = (max - min) || 1;
  const xy = pts.map((p, i) => [
    (i / (pts.length - 1)) * w,
    h - ((p - min) / span) * (h - 5) - 2.5,
  ]);
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
    </svg>
  );
}

interface WeekBucket { label: string; opd: number; ipd: number }

function TrendChart({ weeks }: { weeks: WeekBucket[] }) {
  const w = 900, h = 210, padL = 44, padB = 22, padT = 8;
  const rawMax = Math.max(10, ...weeks.map(d => Math.max(d.opd, d.ipd)));
  const maxV = Math.ceil(rawMax * 1.15);
  const plotH = h - padB - padT, plotW = w - padL - 6;
  const bw = plotW / Math.max(1, weeks.length);
  const y = (v: number) => padT + plotH - (v / maxV) * plotH;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxV * f));
  const avg = weeks.length ? weeks.reduce((s, d) => s + d.opd + d.ipd, 0) / weeks.length : 0;
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block', height: 210 }}>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={w - 6} y1={y(g)} y2={y(g)} stroke={C.track} strokeWidth={1} />
          <text x={padL - 8} y={y(g) + 4} textAnchor="end" fontSize={10} fontWeight={700} fill={C.muted}>{fmt(g)}</text>
        </g>
      ))}
      {weeks.map((d, i) => {
        const x0 = padL + i * bw;
        const bar = Math.min(26, bw * 0.46);
        return (
          <g key={i}>
            <rect x={x0 + bw / 2 - bar - 1} y={y(d.opd)} width={bar} height={padT + plotH - y(d.opd)} rx={3} fill={C.blue} opacity={i === weeks.length - 1 ? 1 : 0.85} />
            <rect x={x0 + bw / 2 + 1} y={y(d.ipd)} width={bar} height={padT + plotH - y(d.ipd)} rx={3} fill={C.orange} opacity={i === weeks.length - 1 ? 1 : 0.85} />
            <text x={x0 + bw / 2} y={h - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.muted}>{d.label}</text>
          </g>
        );
      })}
      {avg > 0 && (
        <g>
          <line x1={padL} x2={w - 6} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={w - 8} y={y(avg) - 6} textAnchor="end" fontSize={10} fontWeight={800} fill={C.muted}>12-wk avg {fmt(Math.round(avg))}</text>
        </g>
      )}
    </svg>
  );
}

function Donut({ segs, centre, sub }: { segs: { v: number; c: string }[]; centre: string; sub: string }) {
  const total = Math.max(1, segs.reduce((s, x) => s + x.v, 0));
  const r = 46, cx = 58, cy = 58, sw = 15;
  const circ = 2 * Math.PI * r;
  const lens = segs.map(s => (s.v / total) * circ);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((s, l) => s + l, 0));
  return (
    <svg width={116} height={116} viewBox="0 0 116 116">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.track} strokeWidth={sw} />
      {segs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.c} strokeWidth={sw}
          strokeDasharray={`${lens[i]} ${circ - lens[i]}`} strokeDashoffset={-offsets[i]}
          transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize={24} fontWeight={800} fill={C.text}>{centre}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.muted}>{sub}</text>
    </svg>
  );
}

// ── Data shapes ─────────────────────────────────────────────────────────────

interface VisitDoc { visitDate?: string; createdAt?: string; visitType?: string; hospitalId?: string }
interface NetworkData {
  hospitals: HospitalDoc[];
  records: VisitDoc[];
  admissions: AdmissionDoc[];
  payments: { amount: number; status: string; processedAt?: string; createdAt?: string }[];
  inventory: { hospitalId: string; stockLevel: number }[];
  patients: { createdAt?: string }[];
  ancCount: number;
  immunizationCount: number;
  inactiveUsers: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Monday-start week bucket index for the last `n` weeks; -1 if outside. */
function weekIndex(iso: string | undefined, weekStarts: Date[]): number {
  if (!iso) return -1;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return -1;
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    if (t >= weekStarts[i].getTime()) {
      const end = weekStarts[i].getTime() + 7 * 86400000;
      return t < end ? i : -1;
    }
  }
  return -1;
}

function isoWeekLabel(d: Date): string {
  const target = new Date(d.valueOf());
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `W${week}`;
}

export default function OrgOverviewPage() {
  return (
    <RoleGuard>
      <OrgOverview />
    </RoleGuard>
  );
}

function OrgOverview() {
  const router = useRouter();
  const { currentUser } = useApp();
  const [data, setData] = useState<NetworkData | null>(null);
  const [stateFilter, setStateFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [hospitalSvc, wardSvc, paySvc, invSvc, patientSvc, ancSvc, immSvc, auditSvc, dbMod] = await Promise.all([
        import('@/lib/services/hospital-service'),
        import('@/lib/services/ward-service'),
        import('@/lib/services/payment-service'),
        import('@/lib/services/pharmacy-inventory-service'),
        import('@/lib/services/patient-service'),
        import('@/lib/services/anc-service'),
        import('@/lib/services/immunization-service'),
        import('@/lib/services/audit-service'),
        import('@/lib/db'),
      ]);
      const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
        try { return await p; } catch { return fallback; }
      };
      const [allHospitals, admissions, payments, inventory, patients, ancVisits, immunizations, auditLogs, recordsRes] = await Promise.all([
        settle(hospitalSvc.getAllHospitals(), [] as HospitalDoc[]),
        settle(wardSvc.getAllAdmissions(), [] as AdmissionDoc[]),
        settle(paySvc.getAllPayments(), []),
        settle(invSvc.getAllInventory(), []),
        settle(patientSvc.getAllPatients(), []),
        settle(ancSvc.getAllANCVisits(), []),
        settle(immSvc.getAllImmunizations(), []),
        settle(auditSvc.getRecentAuditLogs(50), []),
        settle<{ rows: { doc?: unknown }[] }>(
          dbMod.getDB('tamamhealth_medical_records').allDocs({ include_docs: true }) as unknown as Promise<{ rows: { doc?: unknown }[] }>,
          { rows: [] },
        ),
      ]);
      if (cancelled) return;

      const hospitals = currentUser?.orgId
        ? (() => { const own = allHospitals.filter(h => h.orgId === currentUser.orgId); return own.length ? own : allHospitals; })()
        : allHospitals;

      // Users with no audit activity in 7+ days (same heuristic the previous
      // dashboard used).
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const lastAction: Record<string, string> = {};
      for (const log of auditLogs as { username?: string; createdAt: string }[]) {
        if (log.username && (!lastAction[log.username] || log.createdAt > lastAction[log.username])) {
          lastAction[log.username] = log.createdAt;
        }
      }
      const inactiveUsers = Object.values(lastAction).filter(tstamp => new Date(tstamp).getTime() < sevenDaysAgo).length;

      setData({
        hospitals,
        records: (recordsRes.rows || []).map(r => r.doc as VisitDoc).filter(Boolean),
        admissions,
        payments: payments as NetworkData['payments'],
        inventory: (inventory as { hospitalId: string; stockLevel: number }[]),
        patients: patients as { createdAt?: string }[],
        ancCount: ancVisits.length,
        immunizationCount: immunizations.length,
        inactiveUsers,
      });
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.orgId]);

  const view = useMemo(() => (data ? buildView(data) : null), [data]);

  if (!view) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#F8FBFD' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.blue }} />
      </div>
    );
  }

  const states = ['all', ...view.states.map(s => s.name)];
  const facilities = stateFilter === 'all'
    ? view.facilities
    : view.facilities.filter(f => f.state === stateFilter);

  const exportBoardPack = () => {
    const head = ['Facility', 'Type', 'State', 'Patients', 'Bed occupancy %', 'Staff', 'Stock-outs', 'Status'];
    const lines = view.facilities.map(f =>
      [f.name, f.type, f.state, f.patients, f.occupancyPct, f.staff, f.stockouts, f.status]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-overview-${monthKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pillBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px',
    border: `1px solid ${C.border}`, borderRadius: 999, background: '#fff', color: C.text,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ background: '#F8FBFD', color: C.text }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px 16px', width: '100%' }}>
        {/* ── Title row ── */}
        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '6px 0 12px' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>Network Overview</h1>
            <p style={{ margin: '2px 0 0', color: C.muted, fontSize: 12, fontWeight: 600 }}>{view.subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...pillBtn, cursor: 'default' }}>
              <Calendar className="w-4 h-4" />
              This month
            </span>
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              style={{ ...pillBtn, appearance: 'none', paddingRight: 18, fontFamily: 'inherit' }}
            >
              {states.map(s => <option key={s} value={s}>{s === 'all' ? 'All states' : s}</option>)}
            </select>
            <button
              onClick={exportBoardPack}
              style={{ ...pillBtn, border: `1px solid ${C.blue}`, background: C.blue, color: '#fff', padding: '0 16px' }}
            >
              <Download className="w-4 h-4" />
              Export board pack
            </button>
          </div>
        </section>

        {/* ── KPI strip ── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 12 }}>
          {view.kpis.map(k => (
            <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>{k.label}</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 23, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</b>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11.5, fontWeight: 700, color: k.deltaColor }}>
                    {k.delta}
                    <span style={{ color: C.muted, fontWeight: 600 }}>{k.deltaNote}</span>
                  </span>
                </div>
                {k.spark && <span style={{ flex: 'none' }}><Spark pts={k.spark} color={k.sparkColor} /></span>}
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 1fr)', gap: 12, alignItems: 'start' }}>
          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {/* Attendance trend */}
            <section style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 style={sectionTitle}>Attendance across the network — last 12 weeks</h3>
                <div style={{ display: 'flex', gap: 14, color: C.muted, fontSize: 11, fontWeight: 700 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue }} />Outpatient</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} />Inpatient</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 14, height: 2, background: C.muted }} />Average</span>
                </div>
              </div>
              <TrendChart weeks={view.weeks} />
            </section>

            {/* Facility league table */}
            <section style={{ ...card, overflow: 'hidden', overflowX: 'auto' }} className="show-scrollbar">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderBottom: `1px solid ${C.rowBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Building2 className="w-4 h-4" style={{ color: C.blue }} />
                  <h3 style={sectionTitle}>Facility performance</h3>
                </div>
                <button onClick={() => router.push('/org-admin/hospitals')} style={{ border: 'none', background: 'none', fontSize: 12, fontWeight: 700, color: C.deep, cursor: 'pointer', padding: 0 }}>
                  All {view.facilities.length} facilities →
                </button>
              </div>
              <div style={{ minWidth: 'fit-content', display: 'grid', gridTemplateColumns: 'minmax(190px,2fr) minmax(90px,1fr) minmax(150px,1.4fr) minmax(80px,1fr) minmax(96px,1fr) minmax(100px,1fr)', gap: 14, alignItems: 'center', padding: '10px 16px', background: 'rgba(33,145,208,0.07)', borderBottom: `1px solid ${C.rowBorder}` }}>
                {['Facility', 'Patients', 'Bed occupancy', 'Staff', 'Stock-outs', 'Status'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted }}>{h}</span>
                ))}
              </div>
              {facilities.slice(0, 7).map(f => (
                <div key={f.id} style={{ minWidth: 'fit-content', display: 'grid', gridTemplateColumns: 'minmax(190px,2fr) minmax(90px,1fr) minmax(150px,1.4fr) minmax(80px,1fr) minmax(96px,1fr) minmax(100px,1fr)', gap: 14, alignItems: 'center', minHeight: 52, padding: '8px 16px', borderBottom: '1px solid #EDF2F7', background: '#fff' }}>
                  <div style={{ minWidth: 0 }}>
                    <button
                      onClick={() => router.push('/org-admin/hospitals')}
                      style={{ display: 'block', border: 'none', background: 'none', padding: 0, textAlign: 'left', color: C.deep, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', cursor: 'pointer' }}
                    >
                      {f.name}
                    </button>
                    <span style={{ display: 'block', marginTop: 1, color: C.muted, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.type}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f.patients.toLocaleString()}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, f.occupancyPct)}%`, borderRadius: 999, background: f.occupancyColor }} />
                    </span>
                    <b style={{ flex: 'none', color: f.occupancyColor, fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{f.occupancyPct}%</b>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f.staff}</span>
                  <span style={{ color: f.stockColor, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f.stockouts}</span>
                  <span>
                    <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, background: f.stBg, color: f.stColor, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{f.status}</span>
                  </span>
                </div>
              ))}
              {facilities.length === 0 && (
                <div style={{ padding: '18px 16px', color: C.muted, fontSize: 12.5, fontWeight: 600 }}>No facilities in this state.</div>
              )}
            </section>

            {/* State comparison */}
            <section style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <h3 style={sectionTitle}>Patients by state</h3>
                <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Share of {view.totalPatients.toLocaleString()} registered patients</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {view.states.map(s => (
                  <div key={s.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,0.8fr) minmax(0,1fr) 116px', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                      <span style={{ display: 'block', color: C.muted, fontSize: 11, fontWeight: 600 }}>{s.facilities} {s.facilities === 1 ? 'facility' : 'facilities'}</span>
                    </span>
                    <span style={{ display: 'flex', height: 18, borderRadius: 5, background: C.track, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${s.pct}%`, background: C.blue }} />
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
                      <b style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.total.toLocaleString()}</b>
                      <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>{s.share}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Right rail ── */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {/* Reporting compliance */}
            <section style={{ ...card, padding: 16 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 4 }}>MoH reporting compliance</h3>
              <span style={{ display: 'block', color: C.muted, fontSize: 11.5, fontWeight: 600 }}>Facility self-reports, {view.monthLabel} period</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
                <span style={{ flex: 'none' }}>
                  <Donut segs={view.compliance.map(c => ({ v: c.count, c: c.color }))} centre={view.compliancePct} sub="submitted" />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  {view.compliance.map(c => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <i style={{ flex: 'none', width: 9, height: 9, borderRadius: 3, background: c.color }} />
                      <span style={{ minWidth: 0, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <b style={{ marginLeft: 'auto', flex: 'none', fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{c.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Needs attention */}
            <section style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${C.rowBorder}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: C.red }} />
                  <h3 style={sectionTitle}>Needs attention</h3>
                </div>
                <b style={{ minWidth: 22, height: 22, display: 'grid', placeItems: 'center', padding: '0 7px', borderRadius: 999, background: '#FFF0EF', color: C.red, fontSize: 11, fontWeight: 800 }}>{view.alerts.length}</b>
              </div>
              {view.alerts.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3px minmax(0,1fr)', gap: 11, padding: '11px 16px 11px 0', borderBottom: '1px solid #F2F6FA' }}>
                  <i style={{ background: a.color }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</b>
                    </div>
                    <p style={{ margin: '3px 0 0', color: C.muted, fontSize: 11.5, fontWeight: 600, lineHeight: 1.45 }}>{a.detail}</p>
                  </div>
                </div>
              ))}
              {view.alerts.length === 0 && (
                <div style={{ padding: '16px', color: C.muted, fontSize: 12, fontWeight: 600 }}>Nothing needs attention right now.</div>
              )}
            </section>

            {/* Service mix */}
            <section style={{ ...card, padding: 16 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 12 }}>Service mix</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {view.services.map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                      <b style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.value.toLocaleString()}</b>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.pct}%`, borderRadius: 999, background: C.blue, opacity: s.opacity }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

// ── Derivations ─────────────────────────────────────────────────────────────

function buildView(data: NetworkData) {
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // 12 Monday-start week buckets ending this week.
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStarts = Array.from({ length: 12 }, (_, i) => new Date(monday.getTime() - (11 - i) * 7 * 86400000));

  const weeks: WeekBucket[] = weekStarts.map(ws => ({ label: isoWeekLabel(ws), opd: 0, ipd: 0 }));
  const visitDateOf = (r: VisitDoc) => r.visitDate || r.createdAt;
  for (const r of data.records) {
    const idx = weekIndex(visitDateOf(r), weekStarts);
    if (idx >= 0) weeks[idx].opd += 1;
  }
  for (const a of data.admissions) {
    const idx = weekIndex(a.admissionDate || a.createdAt, weekStarts);
    if (idx >= 0) weeks[idx].ipd += 1;
  }

  // Month-over-month series
  const inMonth = (iso: string | undefined, key: string) => !!iso && iso.startsWith(key);
  const visitsThis = data.records.filter(r => inMonth(visitDateOf(r), thisMonth)).length;
  const visitsLast = data.records.filter(r => inMonth(visitDateOf(r), lastMonth)).length;
  const patientsThis = data.patients.filter(p => inMonth(p.createdAt, thisMonth)).length;
  const patientsLast = data.patients.filter(p => inMonth(p.createdAt, lastMonth)).length;
  const paidOf = (p: NetworkData['payments'][number]) => p.processedAt || p.createdAt;
  const completed = data.payments.filter(p => p.status === 'completed' || p.status === 'paid');
  const revenueThis = completed.filter(p => inMonth(paidOf(p), thisMonth)).reduce((s, p) => s + (p.amount || 0), 0);
  const revenueLast = completed.filter(p => inMonth(paidOf(p), lastMonth)).reduce((s, p) => s + (p.amount || 0), 0);

  // Weekly sparkline series (last 7 of the 12 buckets)
  const sparkOf = (fn: (weekIdx: number) => number) => weekStarts.slice(5).map((_, i) => fn(i + 5));
  const weeklyVisits = sparkOf(i => weeks[i].opd + weeks[i].ipd);
  const weeklyPatients = weekStarts.map(() => 0);
  for (const p of data.patients) {
    const idx = weekIndex(p.createdAt, weekStarts);
    if (idx >= 0) weeklyPatients[idx] += 1;
  }
  const weeklyRevenue = weekStarts.map(() => 0);
  for (const p of completed) {
    const idx = weekIndex(paidOf(p), weekStarts);
    if (idx >= 0) weeklyRevenue[idx] += p.amount || 0;
  }

  const delta = (cur: number, prev: number, upIsGood: boolean, fmt?: (n: number) => string) => {
    if (prev === 0 && cur === 0) return { text: '—', note: ' no change', color: C.muted };
    if (prev === 0) return { text: '▲ new', note: ' vs last month', color: upIsGood ? C.green : C.red };
    const pct = ((cur - prev) / prev) * 100;
    const up = pct >= 0;
    return {
      text: `${up ? '▲' : '▼'} ${fmt ? fmt(Math.abs(cur - prev)) : `${Math.abs(pct).toFixed(1)}%`}`,
      note: ' vs last month',
      color: (up === upIsGood) ? C.green : C.red,
    };
  };

  const fmtSSP = (n: number) => {
    if (n >= 1_000_000) return `SSP ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `SSP ${(n / 1_000).toFixed(1)}k`;
    return `SSP ${Math.round(n).toLocaleString()}`;
  };

  // Stock-outs — zero-stock lines per facility and network-wide rate.
  const stockoutsByHospital = new Map<string, number>();
  let zeroLines = 0;
  for (const line of data.inventory) {
    if (line.stockLevel === 0) {
      zeroLines += 1;
      stockoutsByHospital.set(line.hospitalId, (stockoutsByHospital.get(line.hospitalId) || 0) + 1);
    }
  }
  const stockoutRate = data.inventory.length ? (zeroLines / data.inventory.length) * 100 : 0;

  // Facility rows
  const activeByFacility = new Map<string, number>();
  for (const a of data.admissions) {
    if (a.status === 'admitted' || a.status === 'transferred') {
      activeByFacility.set(a.facilityId, (activeByFacility.get(a.facilityId) || 0) + 1);
    }
  }
  const TYPE_LABEL: Record<string, string> = {
    national_referral: 'National referral',
    state_hospital: 'State hospital',
    county_hospital: 'County hospital',
    phcc: 'Health centre',
    phcu: 'Health unit',
  };
  const ST: Record<string, { bg: string; c: string }> = {
    Healthy: { bg: '#E8F7F1', c: C.green },
    Strained: { bg: '#FFF4E9', c: C.amber },
    Critical: { bg: '#FFF0EF', c: C.red },
    Offline: { bg: '#EEF4F6', c: C.slate },
  };
  const facilities = data.hospitals.map(h => {
    const occupied = activeByFacility.get(h._id) || 0;
    const occupancyPct = h.totalBeds > 0 ? Math.round((occupied / h.totalBeds) * 100) : 0;
    const stockouts = stockoutsByHospital.get(h._id) || 0;
    const offline = h.syncStatus === 'offline' || h.operationalStatus === 'non_functional' || h.operationalStatus === 'closed';
    const status = offline ? 'Offline'
      : (occupancyPct >= 95 || stockouts >= 8) ? 'Critical'
      : (occupancyPct >= 85 || stockouts >= 4) ? 'Strained'
      : 'Healthy';
    const s = ST[status];
    return {
      id: h._id,
      name: h.name,
      type: `${TYPE_LABEL[h.facilityType] || h.facilityType}${h.county ? ` · ${h.county}` : h.town ? ` · ${h.town}` : ''}`,
      state: h.state || 'Unknown',
      patients: h.patientCount || 0,
      occupancyPct,
      occupancyColor: occupancyPct >= 95 ? C.red : occupancyPct >= 85 ? C.amber : C.blue,
      staff: (h.doctors || 0) + (h.clinicalOfficers || 0) + (h.nurses || 0),
      stockouts,
      stockColor: stockouts >= 8 ? C.red : stockouts >= 4 ? C.amber : C.text,
      status,
      stBg: s.bg,
      stColor: s.c,
      lastSync: h.lastSync,
      mohSubmitted: !!h.mohSubmission,
    };
  }).sort((a, b) => b.patients - a.patients);

  // States
  const totalPatients = facilities.reduce((s, f) => s + f.patients, 0);
  const stateMap = new Map<string, { facilities: number; total: number }>();
  for (const f of facilities) {
    const entry = stateMap.get(f.state) || { facilities: 0, total: 0 };
    entry.facilities += 1;
    entry.total += f.patients;
    stateMap.set(f.state, entry);
  }
  const maxState = Math.max(1, ...[...stateMap.values()].map(v => v.total));
  const states = [...stateMap.entries()]
    .map(([name, v]) => ({
      name,
      facilities: v.facilities,
      total: v.total,
      pct: Math.round((v.total / maxState) * 100),
      share: totalPatients ? Math.round((v.total / totalPatients) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Compliance
  const submitted = facilities.filter(f => f.mohSubmitted).length;
  const offline = facilities.filter(f => f.status === 'Offline').length;
  const pending = Math.max(0, facilities.length - submitted - offline);
  const compliance = [
    { label: 'Submitted to MoH', count: submitted, color: C.green },
    { label: 'Not yet submitted', count: pending, color: C.amber },
    { label: 'Offline', count: offline, color: C.red },
  ].filter(c => c.count > 0 || c.label === 'Submitted to MoH');
  const compliancePct = `${facilities.length ? Math.round((submitted / facilities.length) * 100) : 0}%`;

  // Alerts — derived, most severe first.
  const alerts: { title: string; detail: string; color: string; rank: number }[] = [];
  for (const f of facilities) {
    if (f.status === 'Offline') {
      alerts.push({
        title: `${f.name} is offline`,
        detail: f.lastSync ? `No sync since ${new Date(f.lastSync).toLocaleDateString()}.` : 'No sync recorded.',
        color: C.red, rank: 0,
      });
    } else if (f.occupancyPct >= 95) {
      alerts.push({
        title: `${f.name} at ${f.occupancyPct}% bed occupancy`,
        detail: 'Wards effectively full — consider diverting referrals.',
        color: C.red, rank: 1,
      });
    } else if (f.stockouts >= 4) {
      alerts.push({
        title: `${f.stockouts} stock-outs at ${f.name}`,
        detail: 'Medication lines at zero stock. Review reorder levels.',
        color: C.amber, rank: 2,
      });
    }
  }
  const notSubmitted = facilities.filter(f => !f.mohSubmitted && f.status !== 'Offline').length;
  if (notSubmitted > 0) {
    alerts.push({
      title: `${notSubmitted} ${notSubmitted === 1 ? 'facility has' : 'facilities have'} not submitted to MoH`,
      detail: `${monthLabel} facility reports outstanding in My Facility.`,
      color: C.amber, rank: 3,
    });
  }
  if (data.inactiveUsers > 0) {
    alerts.push({
      title: `${data.inactiveUsers} staff ${data.inactiveUsers === 1 ? 'account' : 'accounts'} inactive 7+ days`,
      detail: 'No recorded activity in the audit log for over a week.',
      color: C.blue, rank: 4,
    });
  }
  alerts.sort((a, b) => a.rank - b.rank);

  // Service mix
  const outpatient = data.records.filter(r => r.visitType === 'outpatient' || !r.visitType).length;
  const emergency = data.records.filter(r => r.visitType === 'emergency').length;
  const mix = [
    { label: 'Outpatient consultations', value: outpatient },
    { label: 'Antenatal & maternity', value: data.ancCount },
    { label: 'Immunisation (EPI)', value: data.immunizationCount },
    { label: 'Inpatient admissions', value: data.admissions.length },
    { label: 'Emergency presentations', value: emergency },
  ].sort((a, b) => b.value - a.value);
  const maxMix = Math.max(1, ...mix.map(m => m.value));
  const OPACITY = [1, 0.8, 0.62, 0.45, 0.3];
  const services = mix.map((m, i) => ({
    ...m,
    pct: Math.round((m.value / maxMix) * 100),
    opacity: OPACITY[Math.min(i, OPACITY.length - 1)],
  }));

  const dVisits = delta(visitsThis, visitsLast, true);
  const dPatients = delta(patientsThis, patientsLast, true);
  const dRevenue = delta(revenueThis, revenueLast, true, fmtSSP);

  const kpis = [
    {
      label: 'Facilities reporting',
      value: `${submitted} / ${facilities.length}`,
      delta: offline > 0 ? `${offline} offline` : '✓',
      deltaNote: offline > 0 ? '' : ' all facilities syncing',
      deltaColor: offline > 0 ? C.red : C.green,
      spark: null as number[] | null, sparkColor: C.blue,
    },
    {
      label: 'Attendance',
      value: visitsThis.toLocaleString(),
      delta: dVisits.text, deltaNote: dVisits.note, deltaColor: dVisits.color,
      spark: weeklyVisits, sparkColor: C.blue,
    },
    {
      label: 'New patients',
      value: patientsThis.toLocaleString(),
      delta: dPatients.text, deltaNote: dPatients.note, deltaColor: dPatients.color,
      spark: weeklyPatients.slice(5), sparkColor: C.blue,
    },
    {
      label: 'Stock-out rate',
      value: `${stockoutRate.toFixed(1)}%`,
      delta: `${zeroLines}`, deltaNote: ` of ${data.inventory.length} lines at zero`,
      deltaColor: stockoutRate >= 5 ? C.red : stockoutRate > 0 ? C.amber : C.green,
      spark: null, sparkColor: C.red,
    },
    {
      label: 'Revenue collected',
      value: fmtSSP(revenueThis),
      delta: dRevenue.text, deltaNote: dRevenue.note, deltaColor: dRevenue.color,
      spark: weeklyRevenue.slice(5), sparkColor: C.blue,
    },
  ];

  return {
    subtitle: `${facilities.length} ${facilities.length === 1 ? 'facility' : 'facilities'} · ${states.length} ${states.length === 1 ? 'state' : 'states'} · ${monthLabel}`,
    monthLabel,
    kpis,
    weeks,
    facilities,
    states,
    totalPatients,
    compliance,
    compliancePct,
    alerts: alerts.slice(0, 6),
    services,
  };
}
