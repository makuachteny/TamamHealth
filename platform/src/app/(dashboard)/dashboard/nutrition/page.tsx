'use client';
import { useMemo, useState } from 'react';
import DemoModeBanner from '@/components/DemoModeBanner';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useNutritionScreenings } from '@/lib/hooks/useNutritionScreenings';
import { classifyScreening, MUAC_THRESHOLDS } from '@/lib/services/nutrition-screening-service';
import {
  AlertTriangle, CheckCircle2, TrendingDown,
  BarChart3, Utensils, Plus, X,
} from '@/components/icons/lucide';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import { formatDateTitle, toIsoDate } from '@/components/ehr/EhrMiniCalendar';

// Use the platform accent token so this dashboard matches the reference
// Clinical Officer design instead of a one-off hardcoded hex.
const ACCENT = 'var(--accent-primary)';

type Screening = {
  id: string; name: string; age: string; sex: string;
  muac: number; weight: number; height: number; edema: boolean;
  status: string; date: string;
};

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

// Worklist tab → screening-status predicate. The "At Risk" tab folds in the
// 'Underweight' status the same way the KPI/stat count does, so the tab count
// and the filtered rows stay in sync.
const matchesTab = (status: string, tab: string): boolean => {
  if (tab === 'all') return true;
  if (tab === 'sam') return status === 'SAM';
  if (tab === 'mam') return status === 'MAM';
  if (tab === 'at_risk') return status === 'At Risk' || status === 'Underweight';
  if (tab === 'normal') return status === 'Normal';
  return true;
};

export default function NutritionDashboard() {
  const { currentUser } = useApp();
  const { t } = useTranslation();
  usePatients();

  // Real screenings persist to the synced nutrition_screenings store; demo
  // rows fill in behind them in demo mode only.
  const { screenings: savedScreenings, add: addScreening } = useNutritionScreenings();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [selectedScreening, setSelectedScreening] = useState<string | null>(null);

  const screenings = useMemo<Screening[]>(
    () => [
      ...savedScreenings.map(s => ({
        id: s._id,
        name: s.patientName,
        age: s.age,
        sex: s.sex,
        muac: s.muac,
        weight: s.weightKg ?? 0,
        height: s.heightCm ?? 0,
        edema: s.edema,
        status: s.status,
        date: s.screeningDate,
      })),
      ...(IS_DEMO ? SAMPLE_SCREENINGS : []),
    ],
    [savedScreenings],
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

  const submitScreening = async () => {
    const muac = parseFloat(form.muac);
    const weight = parseFloat(form.weight);
    const height = parseFloat(form.height);
    if (!form.name.trim() || !form.age.trim()) { setFormError(t('nutrition.formErrorNameAge')); return; }
    if (!Number.isFinite(muac) || muac <= 0 || muac > 40) { setFormError(t('nutrition.formErrorMuac')); return; }
    try {
      await addScreening({
        patientName: form.name.trim(),
        age: form.isAnc && !form.age.toUpperCase().includes('ANC') ? `${form.age.trim()} ANC` : form.age.trim(),
        sex: form.isAnc ? 'F' : form.sex,
        muac,
        weightKg: Number.isFinite(weight) ? weight : undefined,
        heightCm: Number.isFinite(height) ? height : undefined,
        edema: form.edema,
        isAnc: form.isAnc,
        screenedById: currentUser?._id,
        screenedByName: currentUser?.name,
        hospitalId: currentUser?.hospitalId,
        orgId: currentUser?.orgId,
      });
      setForm(EMPTY_FORM);
      setFormError('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
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

  // Worklist rows: apply the active status tab, then the free-text search over
  // name / age / status. Same shape as radiology's `filtered` memo.
  const filteredScreenings = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return screenings.filter(s => {
      if (!matchesTab(s.status, filterStatus)) return false;
      if (!q) return true;
      return [s.name, s.age, s.status].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [screenings, filterStatus, queueSearch]);

  const dateLabel = formatDateTitle(toIsoDate(new Date()));

  // Expandable per-screening detail (MUAC / anthropometry / edema / status /
  // date). Rendered inline beneath the row via EhrCareDashboard's `row.detail`
  // slot, mirroring radiology's `renderStudyDetail`.
  const renderScreeningDetail = (s: Screening) => (
    <div style={{ margin: '0 0 8px', padding: '12px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colPatient')}</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colAgeType')}</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.age} · {s.sex}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colStatus')}</span>
          <p><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${getStatusColor(s.status)}15`, color: getStatusColor(s.status) }}>{s.status}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colMuac')}</span>
          <p className="text-xs font-bold" style={{ color: s.muac < MUAC_THRESHOLDS.severe ? 'var(--color-danger)' : s.muac < MUAC_THRESHOLDS.moderate ? 'var(--color-warning)' : 'var(--text-primary)' }}>{s.muac}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colWeight')}</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.weight}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colHeight')}</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.height}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colEdema')}</span>
          <p className="text-xs font-semibold">{s.edema ? <span style={{ color: 'var(--color-danger)' }}>{t('nutrition.edemaYes')}</span> : <span style={{ color: 'var(--text-muted)' }}>{t('nutrition.edemaNo')}</span>}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('nutrition.colDate')}</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.date}</p>
        </div>
      </div>
    </div>
  );

  if (!currentUser) return null;

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {IS_DEMO && <DemoModeBanner />}

      <EhrCareDashboard
        title={t('nutrition.title')}
        greetingName={currentUser?.name}
        dateLabel={dateLabel}
        tabs={[]}
        activeTab={filterStatus}
        onTabChange={setFilterStatus}
        centerSubtitle={t('nutrition.totalCount', { count: stats.total })}
        searchValue={queueSearch}
        searchPlaceholder={t('topbar.searchPlaceholder')}
        onSearchChange={setQueueSearch}
        filters={[
          { label: t('nutrition.kpiScreenings'), value: stats.total, active: filterStatus === 'all', onClick: () => setFilterStatus('all') },
          { label: t('nutrition.kpiSamCases'), value: stats.sam, active: filterStatus === 'sam', onClick: () => setFilterStatus(filterStatus === 'sam' ? 'all' : 'sam') },
          { label: t('nutrition.kpiMamCases'), value: stats.mam, active: filterStatus === 'mam', onClick: () => setFilterStatus(filterStatus === 'mam' ? 'all' : 'mam') },
          { label: t('nutrition.kpiAtRisk'), value: stats.atRisk, active: filterStatus === 'at_risk', onClick: () => setFilterStatus(filterStatus === 'at_risk' ? 'all' : 'at_risk') },
          { label: t('nutrition.kpiNormal'), value: stats.normal, active: filterStatus === 'normal', onClick: () => setFilterStatus(filterStatus === 'normal' ? 'all' : 'normal') },
        ]}
        actions={[
          {
            label: showForm ? t('nutrition.formCancel') : t('nutrition.newScreening'),
            icon: showForm ? X : Plus,
            onClick: () => { setShowForm(v => !v); setFormError(''); },
            tone: showForm ? 'neutral' : 'primary',
          },
        ]}
        rows={filteredScreenings.map((s): EhrCareDashboardRow => {
          const isOpen = selectedScreening === s.id;
          return {
            id: s.id,
            title: s.name,
            subtitle: `${s.age} · ${s.sex}`,
            compactMeta: s.date,
            date: s.date,
            status: s.status,
            statusTone: s.status === 'SAM' ? 'danger'
              : s.status === 'MAM' ? 'warning'
              : (s.status === 'At Risk' || s.status === 'Underweight') ? 'warning'
              : 'done',
            onClick: () => setSelectedScreening(isOpen ? null : s.id),
            detail: isOpen ? renderScreeningDetail(s) : undefined,
          };
        })}
        metrics={[
          { label: t('nutrition.kpiScreenings'), value: stats.total, active: filterStatus === 'all', onClick: () => setFilterStatus('all') },
          { label: t('nutrition.kpiSamCases'), value: stats.sam, tone: 'danger', active: filterStatus === 'sam', onClick: () => setFilterStatus(filterStatus === 'sam' ? 'all' : 'sam') },
          { label: t('nutrition.kpiMamCases'), value: stats.mam, tone: 'warning', active: filterStatus === 'mam', onClick: () => setFilterStatus(filterStatus === 'mam' ? 'all' : 'mam') },
          { label: t('nutrition.kpiAtRisk'), value: stats.atRisk, tone: 'warning', active: filterStatus === 'at_risk', onClick: () => setFilterStatus(filterStatus === 'at_risk' ? 'all' : 'at_risk') },
          { label: t('nutrition.kpiNormal'), value: stats.normal, tone: 'success', active: filterStatus === 'normal', onClick: () => setFilterStatus(filterStatus === 'normal' ? 'all' : 'normal') },
          { label: t('nutrition.kpiChildrenUnder5'), value: stats.children },
          { label: t('nutrition.kpiAncMothers'), value: stats.anc },
          { label: t('nutrition.kpiSupplyAlerts'), value: stats.criticalSupply, tone: stats.criticalSupply > 0 ? 'danger' : 'success' },
        ]}
        metricsTitle={t('nutrition.title')}
        checklist={[
          { label: t('nutrition.newScreening'), done: stats.total > 0, onClick: () => { setShowForm(true); setFormError(''); } },
          { label: t('nutrition.kpiSamCases'), done: stats.sam === 0, onClick: () => setFilterStatus('sam') },
          { label: t('nutrition.kpiSupplyAlerts'), done: stats.criticalSupply === 0 },
        ]}
        checklistTitle={t('nutrition.screenings')}
        missionTitle={t('nutrition.title')}
        missionDescription={t('nutrition.noScreeningsDesc')}
        emptyTitle={t('nutrition.noScreenings')}
      >
        <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>

          {/* ── New screening entry form ── */}
          {showForm && (
            <div className="p-4 rounded-lg dash-card" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

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
      </EhrCareDashboard>
    </main>
  );
}
