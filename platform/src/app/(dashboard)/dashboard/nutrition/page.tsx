'use client';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardActionsRow from '@/components/dashboard/DashboardActionsRow';
import SpotlightCard from '@/components/dashboard/SpotlightCard';
import DashboardGreetingHeader from '@/components/dashboard/DashboardGreetingHeader';

import { useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import DemoModeBanner from '@/components/DemoModeBanner';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { isPathAllowed } from '@/lib/role-routes';
import {
  AlertTriangle, CheckCircle2, TrendingDown,
  Baby, HeartPulse, BarChart3, Activity, Scale,
  Utensils, Droplets, Users, MessageSquare, Plus, X,
} from '@/components/icons/lucide';

// Use the platform accent token so this dashboard matches the reference
// Clinical Officer design instead of a one-off hardcoded hex.
const ACCENT = 'var(--accent-primary)';

const MUAC_THRESHOLDS = { severe: 11.5, moderate: 12.5, normal: 13.5 };

// MUAC threshold for pregnant/lactating women (ANC): <21.0cm = undernourished.
const ANC_MUAC_THRESHOLD = 21.0;

type Screening = {
  id: string; name: string; age: string; sex: string;
  muac: number; weight: number; height: number; edema: boolean;
  status: string; date: string;
};

/** WHO-aligned classification from MUAC + bilateral pitting edema.
 *  Children (6–59m): edema or MUAC <11.5 = SAM; <12.5 = MAM; <13.5 = At Risk.
 *  ANC mothers: MUAC <21.0 = Underweight. */
function classifyScreening(muac: number, edema: boolean, isAnc: boolean): string {
  if (isAnc) return muac < ANC_MUAC_THRESHOLD ? 'Underweight' : 'Normal';
  if (edema || muac < MUAC_THRESHOLDS.severe) return 'SAM';
  if (muac < MUAC_THRESHOLDS.moderate) return 'MAM';
  if (muac < MUAC_THRESHOLDS.normal) return 'At Risk';
  return 'Normal';
}

const EMPTY_FORM = { name: '', age: '', sex: 'F', muac: '', weight: '', height: '', edema: false, isAnc: false };

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
  const { t } = useTranslation();
  usePatients();

  // New screenings recorded in this session are prepended to the list.
  // (Backend persistence for nutrition docs isn't wired yet; this keeps the
  // workflow usable and the data flows into the on-screen stats.)
  const [localScreenings, setLocalScreenings] = useState<Screening[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const screenings = useMemo(
    () => [...localScreenings, ...(IS_DEMO ? SAMPLE_SCREENINGS : [])],
    [localScreenings],
  );
  // Supplies are adjustable in-session (+/− receipt and consumption) so the
  // card is recordable, not display-only. Status re-derives from thresholds.
  const [supplyLevels, setSupplyLevels] = useState<Record<string, number>>({});
  const supplies = useMemo(
    () =>
      (IS_DEMO ? SUPPLY_ITEMS : []).map(item => {
        const stock = supplyLevels[item.name] ?? item.stock;
        const status = stock <= item.threshold / 2 ? 'critical' : stock <= item.threshold ? 'low' : 'ok';
        return { ...item, stock, status };
      }),
    [supplyLevels],
  );

  const adjustSupply = (name: string, delta: number) => {
    setSupplyLevels(prev => {
      const item = SUPPLY_ITEMS.find(s => s.name === name);
      const current = prev[name] ?? item?.stock ?? 0;
      return { ...prev, [name]: Math.max(0, current + delta) };
    });
  };

  const submitScreening = () => {
    const muac = parseFloat(form.muac);
    const weight = parseFloat(form.weight);
    const height = parseFloat(form.height);
    if (!form.name.trim() || !form.age.trim()) { setFormError(t('nutrition.formErrorNameAge')); return; }
    if (!Number.isFinite(muac) || muac <= 0 || muac > 40) { setFormError(t('nutrition.formErrorMuac')); return; }
    const status = classifyScreening(muac, form.edema, form.isAnc);
    const entry: Screening = {
      id: `ns-local-${Date.now()}`,
      name: form.name.trim(),
      age: form.isAnc && !form.age.toUpperCase().includes('ANC') ? `${form.age.trim()} ANC` : form.age.trim(),
      sex: form.isAnc ? 'F' : form.sex,
      muac,
      weight: Number.isFinite(weight) ? weight : 0,
      height: Number.isFinite(height) ? height : 0,
      edema: form.edema,
      status,
      date: new Date().toISOString().slice(0, 10),
    };
    setLocalScreenings(prev => [entry, ...prev]);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(false);
  };

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
      <TopBar title={t('nutrition.title')} />
      <main className="page-container page-enter">

        <DashboardGreetingHeader />

        <DashboardHero
          className="mb-5"
          stats={[
            { label: 'Screenings', value: stats.total },
            { label: 'SAM', value: stats.sam },
            { label: 'MAM', value: stats.mam },
            { label: 'At Risk', value: stats.atRisk },
          ]}
        />

        <DashboardActionsRow
          className="mb-5"
          actions={[
            { label: 'All Patients', icon: Users, href: '/patients' },
            { label: 'ANC Visits', icon: HeartPulse, href: '/anc', color: '#EC4899' },
            { label: 'Reports', icon: BarChart3, href: '/reports', color: 'var(--accent-primary)' },
            { label: 'Messages', icon: MessageSquare, href: '/messages', color: '#0D9488' },
          ].filter(action => isPathAllowed(currentUser.role, action.href))}
          secondaryCard={<SpotlightCard title="Acute Malnutrition (SAM)" value={stats.sam} caption={`${stats.mam} MAM · ${stats.atRisk} at risk`} />}
        />

        {IS_DEMO && <DemoModeBanner />}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { label: t('nutrition.kpiScreenings'), value: stats.total, icon: Scale, color: ACCENT },
            { label: t('nutrition.kpiSamCases'), value: stats.sam, icon: AlertTriangle, color: 'var(--color-danger)' },
            { label: t('nutrition.kpiMamCases'), value: stats.mam, icon: TrendingDown, color: 'var(--color-warning)' },
            { label: t('nutrition.kpiAtRisk'), value: stats.atRisk, icon: Activity, color: 'var(--color-warning)' },
            { label: t('nutrition.kpiNormal'), value: stats.normal, icon: CheckCircle2, color: 'var(--color-success)' },
            { label: t('nutrition.kpiChildrenUnder5'), value: stats.children, icon: Baby, color: 'var(--accent-primary)' },
            { label: t('nutrition.kpiAncMothers'), value: stats.anc, icon: HeartPulse, color: '#EC4899' },
            { label: t('nutrition.kpiSupplyAlerts'), value: stats.criticalSupply, icon: Droplets, color: stats.criticalSupply > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
          ].map(k => (
            <div key={k.label} className="dash-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="icon-box-sm">
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                </div>
                <span className="kpi-card-title">{k.label}</span>
              </div>
              <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Screening list */}
          <div className="lg:col-span-2 dash-card">
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nutrition.screenings')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t('nutrition.totalCount', { count: stats.total })}</span>
                <button
                  onClick={() => { setShowForm(v => !v); setFormError(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: showForm ? 'var(--overlay-subtle)' : ACCENT, color: showForm ? 'var(--text-primary)' : '#fff', border: 'none', cursor: 'pointer' }}
                >
                  {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {showForm ? t('nutrition.formCancel') : t('nutrition.newScreening')}
                </button>
              </div>
            </div>

            {/* ── New screening entry form ── */}
            {showForm && (
              <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formName')}</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formAge')}</label>
                    <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formSex')}</label>
                    <select value={form.isAnc ? 'F' : form.sex} disabled={form.isAnc}
                      onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                      <option value="F">F</option>
                      <option value="M">M</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formMuac')}</label>
                    <input type="number" step="0.1" min="0" value={form.muac} onChange={e => setForm(f => ({ ...f, muac: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formWeight')}</label>
                    <input type="number" step="0.1" min="0" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nutrition.formHeight')}</label>
                    <input type="number" step="0.1" min="0" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md text-xs"
                      style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.edema} onChange={e => setForm(f => ({ ...f, edema: e.target.checked }))} />
                    {t('nutrition.formEdema')}
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.isAnc} onChange={e => setForm(f => ({ ...f, isAnc: e.target.checked }))} />
                    {t('nutrition.formAnc')}
                  </label>
                  {/* Live classification preview */}
                  {parseFloat(form.muac) > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${getStatusColor(classifyScreening(parseFloat(form.muac), form.edema, form.isAnc))}15`,
                        color: getStatusColor(classifyScreening(parseFloat(form.muac), form.edema, form.isAnc)),
                      }}>
                      {t('nutrition.formClassification')}: {classifyScreening(parseFloat(form.muac), form.edema, form.isAnc)}
                    </span>
                  )}
                </div>
                {formError && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--color-danger)' }}>{formError}</p>
                )}
                <button
                  onClick={submitScreening}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold mt-3"
                  style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  <CheckCircle2 className="w-3 h-3" /> {t('nutrition.formSave')}
                </button>
              </div>
            )}

            {screenings.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 text-center"
                style={{ padding: '40px 16px', color: 'var(--text-muted)' }}
              >
                <Scale className="w-6 h-6" style={{ opacity: 0.5 }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t('nutrition.noScreenings')}
                </p>
                <p className="text-xs">{t('nutrition.noScreeningsDesc')}</p>
              </div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    {[t('nutrition.colPatient'), t('nutrition.colAgeType'), t('nutrition.colMuac'), t('nutrition.colWeight'), t('nutrition.colHeight'), t('nutrition.colEdema'), t('nutrition.colStatus'), t('nutrition.colDate')].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screenings.map(s => (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--table-row-hover)]" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getStatusColor(s.status) }} />
                          <span className="text-xs font-semibold">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{s.age} &middot; {s.sex}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-bold" style={{ color: s.muac < MUAC_THRESHOLDS.severe ? 'var(--color-danger)' : s.muac < MUAC_THRESHOLDS.moderate ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                          {s.muac}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{s.weight}</td>
                      <td className="px-4 py-2.5 text-xs">{s.height}</td>
                      <td className="px-4 py-2.5">{s.edema ? <span className="text-[10px] font-bold" style={{ color: 'var(--color-danger)' }}>{t('nutrition.edemaYes')}</span> : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nutrition.edemaNo')}</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${getStatusColor(s.status)}15`, color: getStatusColor(s.status) }}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.date}</td>
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
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nutrition.classification')}</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: t('nutrition.classSam'), count: stats.sam, color: 'var(--color-danger)', desc: t('nutrition.classSamDesc') },
                  { label: t('nutrition.classMam'), count: stats.mam, color: 'var(--color-warning)', desc: t('nutrition.classMamDesc') },
                  { label: t('nutrition.classAtRisk'), count: stats.atRisk, color: 'var(--color-warning)', desc: t('nutrition.classAtRiskDesc') },
                  { label: t('nutrition.classNormal'), count: stats.normal, color: 'var(--color-success)', desc: t('nutrition.classNormalDesc') },
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
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nutrition.supplies')}</span>
              </div>
              <div className="p-3 space-y-1">
                {supplies.length === 0 && (
                  <p
                    className="text-xs text-center"
                    style={{ color: 'var(--text-muted)', padding: '16px 8px' }}
                  >
                    {t('nutrition.noSupplies')}
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => adjustSupply(item.name, -1)}
                        aria-label={`Decrease ${item.name}`}
                        className="flex items-center justify-center rounded"
                        style={{ width: 18, height: 18, background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                      >−</button>
                      <span className="text-xs font-bold" style={{
                        color: item.status === 'critical' ? 'var(--color-danger)' : item.status === 'low' ? 'var(--color-warning)' : 'var(--text-primary)',
                        minWidth: 64, textAlign: 'center',
                      }}>{item.stock} {item.unit}</span>
                      <button
                        onClick={() => adjustSupply(item.name, 1)}
                        aria-label={`Increase ${item.name}`}
                        className="flex items-center justify-center rounded"
                        style={{ width: 18, height: 18, background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                      >+</button>
                    </div>
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
