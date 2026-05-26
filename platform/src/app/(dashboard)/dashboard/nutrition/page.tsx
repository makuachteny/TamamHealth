'use client';

import { useMemo } from 'react';
import TopBar from '@/components/TopBar';
import DemoModeBanner from '@/components/DemoModeBanner';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import {
  AlertTriangle, CheckCircle2, TrendingDown,
  Baby, HeartPulse, BarChart3, Activity, Scale,
  Utensils, Droplets,
} from '@/components/icons/lucide';

const ACCENT = '#EA580C';

const MUAC_THRESHOLDS = { severe: 11.5, moderate: 12.5, normal: 13.5 };

// Demo-only screenings + supply inventory. Gated on NEXT_PUBLIC_DEMO_MODE so
// production deploys render empty states instead of confusing staff with
// sample patient names.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const SAMPLE_SCREENINGS = [
  { id: 'ns-001', name: 'Akech Deng Mawien', age: '2y', sex: 'F', muac: 10.8, weight: 8.2, height: 78, edema: true, status: 'SAM', date: '2026-02-09' },
  { id: 'ns-002', name: 'Tut Chuol Both', age: '3y', sex: 'M', muac: 12.0, weight: 10.5, height: 88, edema: false, status: 'MAM', date: '2026-02-09' },
  { id: 'ns-003', name: 'Nyabol Koang Jal', age: '28w ANC', sex: 'F', muac: 21.5, weight: 52, height: 158, edema: false, status: 'Normal', date: '2026-02-09' },
  { id: 'ns-004', name: 'Deng Garang Majok', age: '18m', sex: 'M', muac: 11.2, weight: 7.1, height: 72, edema: false, status: 'SAM', date: '2026-02-08' },
  { id: 'ns-005', name: 'Achol Dut Machar', age: '4y', sex: 'F', muac: 13.0, weight: 13.8, height: 98, edema: false, status: 'At Risk', date: '2026-02-08' },
  { id: 'ns-006', name: 'Ajak Mading Kuol', age: '24w ANC', sex: 'F', muac: 19.8, weight: 48, height: 155, edema: false, status: 'Underweight', date: '2026-02-08' },
  { id: 'ns-007', name: 'Gatluak Puok Riek', age: '5y', sex: 'M', muac: 14.2, weight: 17, height: 108, edema: false, status: 'Normal', date: '2026-02-07' },
  { id: 'ns-008', name: 'Nyamal Gatdet Both', age: '11m', sex: 'F', muac: 12.3, weight: 6.8, height: 68, edema: false, status: 'MAM', date: '2026-02-07' },
];

const SUPPLY_ITEMS = [
  { name: 'RUTF (Plumpy\'Nut)', stock: 120, unit: 'sachets', threshold: 50, status: 'ok' },
  { name: 'F-75 Therapeutic Milk', stock: 8, unit: 'tins', threshold: 15, status: 'low' },
  { name: 'F-100 Therapeutic Milk', stock: 22, unit: 'tins', threshold: 10, status: 'ok' },
  { name: 'ReSoMal (ORS)', stock: 3, unit: 'packets', threshold: 10, status: 'critical' },
  { name: 'Vitamin A Capsules', stock: 200, unit: 'capsules', threshold: 50, status: 'ok' },
  { name: 'Iron/Folate Tabs', stock: 150, unit: 'tabs', threshold: 30, status: 'ok' },
  { name: 'MUAC Tapes', stock: 5, unit: 'tapes', threshold: 10, status: 'low' },
  { name: 'Weighing Scale', stock: 2, unit: 'units', threshold: 1, status: 'ok' },
];

export default function NutritionDashboard() {
  const { currentUser } = useApp();
  usePatients();

  // Stable references so the stats memo below doesn't re-run every render.
  const screenings = useMemo(() => (IS_DEMO ? SAMPLE_SCREENINGS : []), []);
  const supplies = useMemo(() => (IS_DEMO ? SUPPLY_ITEMS : []), []);

  const stats = useMemo(() => {
    return {
      total: screenings.length,
      sam: screenings.filter(s => s.status === 'SAM').length,
      mam: screenings.filter(s => s.status === 'MAM').length,
      atRisk: screenings.filter(s => s.status === 'At Risk' || s.status === 'Underweight').length,
      normal: screenings.filter(s => s.status === 'Normal').length,
      children: screenings.filter(s => !s.age.includes('ANC')).length,
      anc: screenings.filter(s => s.age.includes('ANC')).length,
      criticalSupply: supplies.filter(s => s.status === 'critical').length,
    };
  }, [screenings, supplies]);

  const getStatusColor = (status: string) => {
    if (status === 'SAM') return 'var(--color-danger)';
    if (status === 'MAM') return 'var(--color-warning)';
    if (status === 'At Risk' || status === 'Underweight') return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  if (!currentUser) return null;

  return (
    <>
      <TopBar title="Nutrition Dashboard" />
      <main className="page-container page-enter">

        {IS_DEMO && <DemoModeBanner />}

        {/* KPI strip */}
        <div className="kpi-grid mb-4">
          {[
            { label: 'Screenings', value: stats.total, icon: Scale, color: ACCENT },
            { label: 'SAM Cases', value: stats.sam, icon: AlertTriangle, color: 'var(--color-danger)' },
            { label: 'MAM Cases', value: stats.mam, icon: TrendingDown, color: 'var(--color-warning)' },
            { label: 'At Risk', value: stats.atRisk, icon: Activity, color: 'var(--color-warning)' },
            { label: 'Normal', value: stats.normal, icon: CheckCircle2, color: 'var(--color-success)' },
            { label: 'Children <5', value: stats.children, icon: Baby, color: 'var(--accent-primary)' },
            { label: 'ANC Mothers', value: stats.anc, icon: HeartPulse, color: '#EC4899' },
            { label: 'Supply Alerts', value: stats.criticalSupply, icon: Droplets, color: stats.criticalSupply > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
          ].map(k => (
            <div key={k.label} className="kpi">
              <div className="kpi__icon" style={{ background: `${k.color}15` }}><k.icon style={{ color: k.color }} /></div>
              <div className="kpi__body">
                <div className="kpi__value">{k.value}</div>
                <div className="kpi__label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Screening list */}
          <div className="lg:col-span-2 dash-card">
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nutrition Screenings</span>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{stats.total} total</span>
            </div>
            {screenings.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 text-center"
                style={{ padding: '40px 16px', color: 'var(--text-muted)' }}
              >
                <Scale className="w-6 h-6" style={{ opacity: 0.5 }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  No nutrition screenings yet
                </p>
                <p className="text-xs">Screenings recorded by clinicians will appear here.</p>
              </div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Age/Type</th>
                    <th>MUAC (cm)</th>
                    <th>Weight (kg)</th>
                    <th>Height (cm)</th>
                    <th>Edema</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {screenings.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getStatusColor(s.status) }} />
                          <span className="text-xs font-semibold">{s.name}</span>
                        </div>
                      </td>
                      <td className="text-xs">{s.age} &middot; {s.sex}</td>
                      <td>
                        <span className="text-xs font-bold" style={{ color: s.muac < MUAC_THRESHOLDS.severe ? 'var(--color-danger)' : s.muac < MUAC_THRESHOLDS.moderate ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                          {s.muac}
                        </span>
                      </td>
                      <td className="text-xs">{s.weight}</td>
                      <td className="text-xs">{s.height}</td>
                      <td>{s.edema ? <span className="text-[10px] font-bold" style={{ color: 'var(--color-danger)' }}>Yes</span> : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No</span>}</td>
                      <td>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${getStatusColor(s.status)}15`, color: getStatusColor(s.status) }}>
                          {s.status}
                        </span>
                      </td>
                      <td className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">

            {/* MUAC classification */}
            <div className="dash-card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <BarChart3 className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Classification</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Severe Acute Malnutrition (SAM)', count: stats.sam, color: 'var(--color-danger)', desc: 'MUAC < 11.5cm or edema' },
                  { label: 'Moderate Acute Malnutrition (MAM)', count: stats.mam, color: 'var(--color-warning)', desc: 'MUAC 11.5 - 12.5cm' },
                  { label: 'At Risk / Underweight', count: stats.atRisk, color: 'var(--color-warning)', desc: 'MUAC 12.5 - 13.5cm' },
                  { label: 'Normal', count: stats.normal, color: 'var(--color-success)', desc: 'MUAC > 13.5cm' },
                ].map(item => {
                  const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                        <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-medium)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Supply status */}
            <div className="dash-card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Utensils className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nutrition Supplies</span>
              </div>
              <div className="p-3 space-y-1">
                {supplies.length === 0 && (
                  <p
                    className="text-xs text-center"
                    style={{ color: 'var(--text-muted)', padding: '16px 8px' }}
                  >
                    No supply records yet.
                  </p>
                )}
                {supplies.map(item => (
                  <div key={item.name} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="flex items-center gap-2">
                      {item.status === 'critical' ? <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-danger)' }} /> :
                       item.status === 'low' ? <TrendingDown className="w-3 h-3" style={{ color: 'var(--color-warning)' }} /> :
                       <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-success)' }} />}
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <span className="text-xs font-bold" style={{
                      color: item.status === 'critical' ? 'var(--color-danger)' : item.status === 'low' ? 'var(--color-warning)' : 'var(--text-primary)',
                    }}>{item.stock} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
