'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import PatientName from '@/components/PatientName';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { useRouter } from 'next/navigation';
import { FlaskConical, AlertTriangle, X, Plus, Radio, CheckCircle2, Filter, Download } from '@/components/icons/lucide';
import EhrListHeader, { EhrListHeaderButton, LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { evaluateCritical } from '@/lib/services/lab-critical-flag';
import { parseInstrumentPayload, type ParsedInstrumentResult } from '@/lib/services/instrument-intake-service';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { LabOrderStatus } from '@/lib/clinical-flow/order-lifecycles';
import { useSettings } from '@/lib/settings/SettingsProvider';
import PageInstructionCard from '@/components/PageInstructionCard';

// Human labels for the granular diagnostics lifecycle (Stage 6).
const ORDER_STAGE_LABEL: Record<LabOrderStatus, string> = {
  ordered: 'Ordered',
  specimen_collected: 'Specimen collected',
  received_at_lab: 'Received at lab',
  rejected_needs_recollection: 'Needs re-collection',
  in_process: 'In process',
  resulted: 'Resulted',
  reviewed_by_clinician: 'Reviewed',
  acted_upon: 'Acted upon',
  communicated_to_patient: 'Communicated',
};

// Derive the granular stage for an order, defaulting older orders from status.
function effOrderStatus(o: { orderStatus?: LabOrderStatus; status: 'pending' | 'in_progress' | 'completed' }): LabOrderStatus {
  if (o.orderStatus) return o.orderStatus;
  if (o.status === 'completed') return 'resulted';
  if (o.status === 'in_progress') return 'in_process';
  return 'ordered';
}

interface ResultDraft {
  orderId: string;
  patientName: string;
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  critical: boolean;
  /** Whether the tech has manually toggled the critical checkbox; once true we
   *  stop auto-deriving it from the QC critical-value table so the override sticks. */
  criticalManual?: boolean;
}

const LAB_TESTS_CATALOG = [
  { name: 'Malaria RDT', specimen: 'Blood' },
  { name: 'Full Blood Count', specimen: 'Blood' },
  { name: 'Blood Glucose', specimen: 'Blood' },
  { name: 'HIV Rapid Test', specimen: 'Blood' },
  { name: 'CD4 Count', specimen: 'Blood' },
  { name: 'Liver Function', specimen: 'Blood' },
  { name: 'Renal Function', specimen: 'Blood' },
  { name: 'Urinalysis', specimen: 'Urine' },
  { name: 'Stool Microscopy', specimen: 'Stool' },
  { name: 'Sputum AFB (TB)', specimen: 'Sputum' },
  { name: 'Hepatitis B Surface Antigen', specimen: 'Blood' },
  { name: 'Pregnancy Test (β-hCG)', specimen: 'Urine' },
  { name: 'Syphilis (RPR)', specimen: 'Blood' },
];

export default function LabPage() {
  // Per-column filters (replace the old search + status-tabs top bar).
  const searchParams = useSearchParams();
  const [colFilters, setColFilters] = useState({ patient: '', test: '', specimen: '', status: '', result: '', orderedBy: '' });
  // Deep link from a patient chart: /lab?patient=<name> pre-filters the queue.
  useEffect(() => {
    const patientParam = searchParams?.get('patient');
    if (patientParam) setColFilters(f => ({ ...f, patient: patientParam }));
  }, [searchParams]);
  const setColFilter = (k: string, v: string) => setColFilters(f => ({ ...f, [k]: v }));
  const anyColFilter = Object.values(colFilters).some(Boolean);
  // Quick free-text search box in the table toolbar (in addition to the
  // existing per-column filter funnels below).
  const [quickSearch, setQuickSearch] = useState('');
  const anyFilterActive = anyColFilter || !!quickSearch;
  const clearColFilters = () => { setColFilters({ patient: '', test: '', specimen: '', status: '', result: '', orderedBy: '' }); setQuickSearch(''); };
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!openFilter) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenFilter(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openFilter]);
  const { globalSearch, currentUser } = useApp();
  const { results: labResults, update: updateLabResult, advance: advanceLabOrder, loading: labLoading, reload: reloadLabs } = useLabResults();
  const { patients } = usePatients();
  const { canEnterLabResults, canOrderLabs } = usePermissions();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { resultReviewSLA } = useSettings();
  const [resultDraft, setResultDraft] = useState<ResultDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Analyzer import: paste a raw instrument payload (LIS-2A / HL7) and parse it
  // into structured results the tech can review before pre-filling an order.
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importParsed, setImportParsed] = useState<ParsedInstrumentResult[] | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importProtocol, setImportProtocol] = useState<'lis2a' | 'hl7' | 'unknown' | null>(null);

  const handleParseImport = () => {
    const out = parseInstrumentPayload(importRaw);
    setImportProtocol(out.protocol);
    setImportParsed(out.results);
    setImportWarnings(out.warnings);
  };

  const resetImport = () => {
    setShowImportModal(false);
    setImportRaw('');
    setImportParsed(null);
    setImportWarnings([]);
    setImportProtocol(null);
  };

  // Take one parsed analyzer result and open the standard result-entry modal
  // pre-filled for review. We try to match it to a pending order by test name;
  // otherwise the tech still reviews/edits before saving (never auto-saved).
  const prefillFromAnalyzer = (parsed: ParsedInstrumentResult) => {
    const value = parsed.numericValue != null ? String(parsed.numericValue) : (parsed.textValue || '');
    const matchOrder = labResults.find(o =>
      o.status !== 'completed' &&
      (o.testName || '').toLowerCase().includes((parsed.testName || '').toLowerCase().split(' (')[0])
    ) || labResults.find(o =>
      o.status !== 'completed' &&
      (parsed.testName || '').toLowerCase().includes((o.testName || '').toLowerCase())
    );
    const crit = evaluateCritical(parsed.testName, value);
    setResultDraft({
      orderId: matchOrder?._id || '',
      patientName: matchOrder?.patientName || '',
      testName: parsed.testName || parsed.testCode,
      result: value,
      unit: parsed.unit || matchOrder?.unit || '',
      referenceRange: parsed.referenceRange || matchOrder?.referenceRange || '',
      abnormal: !!parsed.abnormalFlag && parsed.abnormalFlag.toUpperCase() !== 'N',
      critical: crit.isCriticalValue,
      criticalManual: false,
    });
    resetImport();
  };

  // Update the draft's result value and auto-derive the critical flag from the
  // QC critical-value table — unless the tech has manually overridden it.
  const updateDraftResult = (value: string) => {
    setResultDraft(prev => {
      if (!prev) return prev;
      const crit = evaluateCritical(prev.testName, value);
      const critical = prev.criticalManual ? prev.critical : crit.isCriticalValue;
      return { ...prev, result: value, critical, abnormal: prev.abnormal || (critical && !prev.criticalManual ? true : prev.abnormal) };
    });
  };

  // Live QC verdict for the open draft (for the in-modal banner).
  const draftCritical = resultDraft ? evaluateCritical(resultDraft.testName, resultDraft.result) : { isCriticalValue: false };

  // Create-order modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [labOrderPatientSearch, setLabOrderPatientSearch] = useState('');
  const [orderTests, setOrderTests] = useState<string[]>([]);
  const [orderPriority, setOrderPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const handleCreateOrders = async () => {
    const patient = patients.find(p => p._id === orderPatientId);
    if (!patient) {
      showToast(t('lab.choosePatient'), 'error');
      return;
    }
    if (orderTests.length === 0) {
      showToast(t('lab.selectAtLeastOneTest'), 'error');
      return;
    }
    try {
      setOrderSubmitting(true);
      const { createLabResult } = await import('@/lib/services/lab-service');
      for (const testName of orderTests) {
        const catalog = LAB_TESTS_CATALOG.find(t => t.name === testName);
        await createLabResult({
          patientId: patient._id,
          patientName: `${patient.firstName} ${patient.surname}`,
          hospitalNumber: patient.hospitalNumber,
          testName,
          specimen: catalog?.specimen || 'Blood',
          status: orderPriority === 'stat' ? 'in_progress' : 'pending',
          result: '',
          unit: '',
          referenceRange: '',
          abnormal: false,
          critical: orderPriority === 'stat',
          orderedBy: currentUser?.name || 'Lab',
          orderedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          completedAt: '',
          hospitalId: currentUser?.hospitalId || patient.registrationHospital,
          hospitalName: currentUser?.hospitalName,
          orgId: currentUser?.orgId,
          clinicalNotes: orderNotes || undefined,
        });
      }
      const { logAudit } = await import('@/lib/services/audit-service');
      await logAudit('LAB_ORDER_CREATED', currentUser?._id, currentUser?.username,
        `Ordered ${orderTests.length} test(s) for ${patient.firstName} ${patient.surname}: ${orderTests.join(', ')}`
      ).catch(() => {});
      showToast(t('lab.ordersCreated', { count: orderTests.length }), 'success');
      setShowOrderModal(false);
      setOrderPatientId('');
      setLabOrderPatientSearch('');
      setOrderTests([]);
      setOrderNotes('');
      setOrderPriority('routine');
      await reloadLabs();
    } catch (err) {
      console.error(err);
      showToast(t('lab.createOrderFailed'), 'error');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const filtered = labResults.filter(o => {
    const f = colFilters;
    if (globalSearch && !((o.patientName || '').toLowerCase().includes(globalSearch.toLowerCase()) || (o.testName || '').toLowerCase().includes(globalSearch.toLowerCase()))) return false;
    if (quickSearch && !`${o.patientName || ''} ${o.hospitalNumber || ''} ${o.testName || ''} ${o.orderedBy || ''}`.toLowerCase().includes(quickSearch.toLowerCase())) return false;
    if (f.patient && !`${o.patientName || ''} ${o.hospitalNumber || ''}`.toLowerCase().includes(f.patient.toLowerCase())) return false;
    if (f.test && !(o.testName || '').toLowerCase().includes(f.test.toLowerCase())) return false;
    if (f.specimen && !(o.specimen || '').toLowerCase().includes(f.specimen.toLowerCase())) return false;
    if (f.status && o.status !== f.status) return false;
    if (f.result && !(o.result || '').toLowerCase().includes(f.result.toLowerCase())) return false;
    if (f.orderedBy && !(o.orderedBy || '').toLowerCase().includes(f.orderedBy.toLowerCase())) return false;
    return true;
  });

  // KPI stat cards — scoped to the full lab queue (not narrowed by the table's
  // own filters, so the header numbers stay a stable "whole queue" summary).
  const labStats = {
    total: labResults.length,
    pending: labResults.filter(o => o.status === 'pending').length,
    inProgress: labResults.filter(o => o.status === 'in_progress').length,
    completed: labResults.filter(o => o.status === 'completed').length,
    critical: labResults.filter(o => o.critical).length,
    awaiting: labResults.filter(o => o.status === 'pending' || o.status === 'in_progress').length,
  };

  // Distinct test names present in the queue, for the header's "test type" filter.
  const testTypeOptions = Array.from(new Set(labResults.map(o => o.testName).filter(Boolean))).sort();

  // Export the currently filtered/visible orders to CSV.
  const handleDownloadCsv = () => {
    const header = ['Patient', 'Hospital number', 'Test', 'Specimen', 'Status', 'Result', 'Ordered by', 'Ordered at', 'Completed at'];
    const rows = filtered.map(o => [
      o.patientName || '',
      o.hospitalNumber || '',
      o.testName || '',
      o.specimen || '',
      ORDER_STAGE_LABEL[effOrderStatus(o)],
      o.result || '',
      o.orderedBy || '',
      o.orderedAt || '',
      o.completedAt || '',
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lab-orders.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Per-column filter controls + column config (funnel dropdown per header).
  type ColFilter = { field: keyof typeof colFilters; node: React.ReactNode };
  const fieldStyle = { background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', padding: '5px 9px', borderRadius: 8, fontSize: 11, width: '100%', minWidth: 0 } as const;
  // Pill-shaped select matching EhrListHeaderButton, for filter dropdowns that
  // live in the shared header's actions row alongside pill buttons.
  const pillSelectStyle = { height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' } as const;
  const textFilter = (key: keyof typeof colFilters, label: string): ColFilter => ({
    field: key,
    node: <input type="text" autoFocus value={colFilters[key]} onChange={(e) => setColFilter(key, e.target.value)} placeholder={label} className="normal-case font-normal tracking-normal w-full" style={fieldStyle} />,
  });
  const selectFilter = (key: keyof typeof colFilters, opts: { v: string; l: string }[]): ColFilter => ({
    field: key,
    node: (
      <select value={colFilters[key]} onChange={(e) => setColFilter(key, e.target.value)} className="normal-case font-normal tracking-normal w-full" style={fieldStyle}>
        <option value="">{t('patients.all')}</option>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    ),
  });
  const labCols: { key: string; label: string; filter?: ColFilter }[] = [
    { key: 'patient', label: t('lab.patient'), filter: textFilter('patient', t('lab.patient')) },
    { key: 'test', label: t('lab.testName'), filter: textFilter('test', t('lab.testName')) },
    { key: 'specimen', label: t('lab.specimen'), filter: textFilter('specimen', t('lab.specimen')) },
    { key: 'status', label: t('lab.status'), filter: selectFilter('status', [{ v: 'pending', l: t('lab.filterPending') }, { v: 'in_progress', l: t('lab.inProgress') }, { v: 'completed', l: t('referral.completed') }]) },
    { key: 'result', label: t('lab.result'), filter: textFilter('result', t('lab.result')) },
    { key: 'orderedBy', label: t('lab.orderedByLabel'), filter: textFilter('orderedBy', t('lab.orderedByLabel')) },
    { key: 'time', label: t('lab.time') },
    ...(canEnterLabResults ? [{ key: 'action', label: t('lab.action') }] : []),
  ];

  // Results back but not yet reviewed by a clinician past their SLA
  // (24h critical / 7 days routine) — surfaced so they can't sit unseen.
  const overdueReviews = labResults.filter(o => {
    if (effOrderStatus(o) !== 'resulted') return false;
    const resultedAt = new Date(o.updatedAt || o.createdAt || '').getTime();
    if (!Number.isFinite(resultedAt)) return false;
    const slaHours = o.critical ? resultReviewSLA.criticalHours : resultReviewSLA.routineHours;
    return (Date.now() - resultedAt) / 3_600_000 > slaHours;
  });

  // When the user marks a result `critical`, we gate the submission through a
  // confirmation modal — typoing a Hb of 4 g/dL into a critical result is the
  // kind of mistake that triggers transfusions, so two-eyes confirmation
  // before persisting is worth the extra click.
  const [criticalConfirmOpen, setCriticalConfirmOpen] = useState(false);

  const persistResult = async () => {
    if (!resultDraft || !resultDraft.result.trim()) return;
    setSubmitting(true);
    try {
      await updateLabResult(resultDraft.orderId, {
        status: 'completed',
        orderStatus: 'resulted',
        result: resultDraft.result.trim(),
        unit: resultDraft.unit.trim(),
        referenceRange: resultDraft.referenceRange.trim(),
        abnormal: resultDraft.abnormal,
        critical: resultDraft.critical,
        completedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });

      // If critical, fire-and-forget a high-priority message to the ordering
      // doctor. We never block the lab worker on this — saving the result is
      // the priority — but if notification fails we toast a clear "please
      // call them" so the loop can still close manually.
      if (resultDraft.critical) {
        const order = labResults.find(r => r._id === resultDraft.orderId);
        try {
          const { createMessage } = await import('@/lib/services/message-service');
          await createMessage({
            recipientType: 'staff',
            patientId: order?.patientId || '',
            patientName: resultDraft.patientName,
            patientPhone: '',
            fromDoctorId: currentUser?._id || 'lab',
            fromDoctorName: currentUser?.name || 'Laboratory',
            fromHospitalName: currentUser?.hospitalName || order?.hospitalName || '',
            subject: `CRITICAL: ${resultDraft.testName} for ${resultDraft.patientName}`,
            body: `Critical lab result for ${resultDraft.patientName} — ${resultDraft.testName}: ${resultDraft.result.trim()}${resultDraft.unit.trim() ? ' ' + resultDraft.unit.trim() : ''}${resultDraft.referenceRange.trim() ? ` (reference range: ${resultDraft.referenceRange.trim()})` : ''}. Please review immediately.`,
            channel: 'app',
            sentAt: new Date().toISOString(),
            orgId: currentUser?.orgId || order?.orgId,
          });
        } catch (err) {
          console.error('[lab] failed to send critical-result alert', err);
          showToast(t('lab.savedNotifyFailed'), 'error');
        }
      }

      setResultDraft(null);
      setCriticalConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const submitResult = async () => {
    if (!resultDraft || !resultDraft.result.trim()) return;
    if (resultDraft.critical) {
      setCriticalConfirmOpen(true);
      return;
    }
    await persistResult();
  };

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <PageInstructionCard />

          {overdueReviews.length > 0 && (
            <div className="card-elevated p-3 mb-4 flex items-start gap-2" style={{ background: 'rgba(229,46,66,0.08)', border: '1px solid var(--color-danger)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                  {overdueReviews.length} result{overdueReviews.length === 1 ? '' : 's'} awaiting clinician review past SLA
                  {overdueReviews.some(o => o.critical) ? ` (${overdueReviews.filter(o => o.critical).length} critical)` : ''}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {overdueReviews.slice(0, 4).map(o => `${o.patientName} — ${o.testName}`).join('; ')}{overdueReviews.length > 4 ? '…' : ''}
                </p>
              </div>
            </div>
          )}

          {labLoading && (
            <div className="card-elevated p-4 mb-4 flex items-center gap-3" style={{ background: 'var(--overlay-subtle)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('lab.loadingOrders')}</span>
            </div>
          )}

          {/* Result Entry Modal */}
          {resultDraft && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', padding: 24 }}
              onClick={(e) => { if (e.target === e.currentTarget && !submitting) setResultDraft(null); }}
            >
              <div
                className="card-elevated"
                style={{
                  width: '100%', maxWidth: 520, padding: 28, borderRadius: 16,
                  background: 'var(--bg-card)', position: 'relative',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.1)',
                  maxHeight: '90vh', overflowY: 'auto',
                }}
              >
                <button
                  onClick={() => !submitting && setResultDraft(null)}
                  className="absolute"
                  style={{ top: 14, right: 14, width: 30, height: 30, borderRadius: 6, background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                  title={t('action.close')}
                  disabled={submitting}
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                    <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.enterLabResult')}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{resultDraft.testName}{resultDraft.patientName ? ` · ${resultDraft.patientName}` : ''}</p>
                  </div>
                </div>

                {!resultDraft.orderId && (
                  <div className="mt-3 p-2.5 rounded-lg flex items-start gap-2" style={{ background: 'rgba(228,168,75,0.1)', border: '1px solid rgba(228,168,75,0.3)' }}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#8F6823' }} />
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      This analyzer result could not be matched to a pending order. Review the values, then create or select the matching order to save against it.
                    </p>
                  </div>
                )}

                <div className="space-y-3 mt-5">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t('lab.resultRequired')}</label>
                    <input
                      type="text"
                      autoFocus
                      value={resultDraft.result}
                      onChange={(e) => updateDraftResult(e.target.value)}
                      placeholder={t('lab.resultExamplePlaceholder')}
                      className="w-full p-2.5 rounded-lg outline-none text-sm"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t('lab.unit')}</label>
                      <input
                        type="text"
                        value={resultDraft.unit}
                        onChange={(e) => setResultDraft({ ...resultDraft, unit: e.target.value })}
                        placeholder={t('lab.unitExamplePlaceholder')}
                        className="w-full p-2.5 rounded-lg outline-none text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t('lab.referenceRange')}</label>
                      <input
                        type="text"
                        value={resultDraft.referenceRange}
                        onChange={(e) => setResultDraft({ ...resultDraft, referenceRange: e.target.value })}
                        placeholder={t('lab.referenceExamplePlaceholder')}
                        className="w-full p-2.5 rounded-lg outline-none text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  {/* QC critical-value banner — auto-derived from the qc-service
                      DEFAULT_CRITICAL_VALUES table when the entered value breaches
                      a critical threshold. Manual override remains available below. */}
                  {draftCritical.isCriticalValue && draftCritical.rule ? (
                    <div className="p-3 rounded-lg flex items-start gap-2.5" style={{ background: 'rgba(229,46,66,0.08)', border: '1px solid var(--color-danger)' }}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-danger)' }}>Critical value</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {resultDraft.result} breaches the critical range for {draftCritical.rule.testName}
                          {draftCritical.rule.rationale ? ` — ${draftCritical.rule.rationale}.` : '.'} Flagged for urgent review.
                        </p>
                      </div>
                    </div>
                  ) : draftCritical.rule ? (
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                      <span>Within QC critical limits for {draftCritical.rule.testName}.</span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={resultDraft.abnormal}
                        onChange={(e) => setResultDraft({ ...resultDraft, abnormal: e.target.checked, critical: e.target.checked ? resultDraft.critical : false })}
                      />
                      {t('lab.abnormal')}
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)', opacity: resultDraft.abnormal ? 1 : 0.5 }}>
                      <input
                        type="checkbox"
                        checked={resultDraft.critical}
                        disabled={!resultDraft.abnormal}
                        onChange={(e) => setResultDraft({ ...resultDraft, critical: e.target.checked, criticalManual: true })}
                      />
                      {t('lab.criticalLabel')}
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => setResultDraft(null)}
                    disabled={submitting}
                    className="btn btn-secondary btn-sm"
                  >
                    {t('action.cancel')}
                  </button>
                  <button
                    onClick={submitResult}
                    disabled={submitting || !resultDraft.result.trim() || !resultDraft.orderId}
                    className="btn btn-primary btn-sm"
                    style={{ opacity: submitting || !resultDraft.result.trim() || !resultDraft.orderId ? 0.6 : 1 }}
                  >
                    {submitting ? t('lab.saving') : t('lab.saveResult')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Critical-Result Confirmation Modal */}
          {resultDraft && criticalConfirmOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.65)', padding: 24 }}
              onClick={(e) => { if (e.target === e.currentTarget && !submitting) setCriticalConfirmOpen(false); }}
            >
              <div
                className="card-elevated"
                style={{
                  width: '100%', maxWidth: 460, padding: 24, borderRadius: 16,
                  background: 'var(--bg-card)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                  border: '1px solid var(--color-danger)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--color-danger)' }}>{t('lab.confirmCriticalResult')}</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {t('lab.confirmCriticalResultDesc')}
                </p>
                <div className="rounded-lg p-3 space-y-1.5 mb-4" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>{t('lab.patient')}</span><span className="font-medium">{resultDraft.patientName}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>{t('lab.testName')}</span><span className="font-medium">{resultDraft.testName}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>{t('lab.value')}</span><span className="font-bold" style={{ color: 'var(--color-danger)' }}>{resultDraft.result}{resultDraft.unit ? ` ${resultDraft.unit}` : ''}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>{t('lab.referenceRange')}</span><span className="font-medium">{resultDraft.referenceRange || '—'}</span></div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setCriticalConfirmOpen(false)}
                    disabled={submitting}
                    className="btn btn-secondary btn-sm"
                  >
                    {t('action.cancel')}
                  </button>
                  <button
                    onClick={persistResult}
                    disabled={submitting}
                    className="btn btn-sm"
                    style={{ background: 'var(--color-danger)', color: 'white', opacity: submitting ? 0.6 : 1 }}
                  >
                    {submitting ? t('lab.saving') : t('lab.confirmCriticalResult')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lab Orders Table */}
          <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            <EhrListHeader
              title={t('lab.laboratory')}
              stats={[
                { label: 'Orders', value: labStats.total, color: LIST_STAT_COLORS.muted },
                { label: 'Pending', value: labStats.pending, color: LIST_STAT_COLORS.blue },
                { label: 'In progress', value: labStats.inProgress, color: LIST_STAT_COLORS.amber },
                { label: 'Completed', value: labStats.completed, color: LIST_STAT_COLORS.green },
                { label: 'Critical', value: labStats.critical, color: LIST_STAT_COLORS.bronze },
              ]}
              search={{ value: quickSearch, onChange: setQuickSearch, placeholder: 'Filter table', ariaLabel: 'Filter table' }}
              actions={
                <>
                  <select
                    value={colFilters.test}
                    onChange={e => setColFilter('test', e.target.value)}
                    aria-label="Filter lab orders by test type"
                    style={pillSelectStyle}
                  >
                    <option value="">Test type</option>
                    {testTypeOptions.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <select
                    value={colFilters.status}
                    onChange={e => setColFilter('status', e.target.value)}
                    aria-label="Filter lab orders by status"
                    style={pillSelectStyle}
                  >
                    <option value="">Status</option>
                    <option value="pending">{t('lab.filterPending')}</option>
                    <option value="in_progress">{t('lab.inProgress')}</option>
                    <option value="completed">{t('referral.completed')}</option>
                  </select>
                  {anyFilterActive && (
                    <EhrListHeaderButton onClick={clearColFilters} ariaLabel={t('nurse.clearAllFilters')}>
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('nurse.clearAllFilters')}</span>
                    </EhrListHeaderButton>
                  )}
                  <EhrListHeaderButton onClick={handleDownloadCsv}>
                    <Download size={15} /> Download
                  </EhrListHeaderButton>
                  {canEnterLabResults && (
                    <EhrListHeaderButton onClick={() => setShowImportModal(true)}>
                      <Radio className="w-3.5 h-3.5" /> Import from analyzer
                    </EhrListHeaderButton>
                  )}
                  {canOrderLabs && (
                    <button onClick={() => setShowOrderModal(true)} className="btn btn-primary" style={{ height: 38, whiteSpace: 'nowrap' }}>
                      <Plus className="w-4 h-4" /> {t('lab.newOrder')}
                    </button>
                  )}
                </>
              }
            />
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table className="data-table" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  {labCols.map(c => (
                    <th key={c.key}>
                      <div className="flex items-center gap-1.5">
                        <span className="whitespace-nowrap">{c.label}</span>
                        {c.filter && (
                          <span ref={openFilter === c.key ? filterRef : null} className="relative inline-flex items-center">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === c.key ? null : c.key); }}
                              className="inline-flex items-center justify-center w-4 h-4 rounded transition-colors hover:bg-[var(--overlay-subtle)]"
                              aria-label={`${c.label} filter`}
                            >
                              <Filter className="w-3 h-3" style={{ color: colFilters[c.filter.field] ? 'var(--accent-primary)' : 'var(--text-muted)', fill: colFilters[c.filter.field] ? 'var(--accent-primary)' : 'transparent' }} />
                            </button>
                            {openFilter === c.key && (
                              <div className="absolute top-full right-0 mt-2 normal-case rounded-xl overflow-hidden flex flex-col" style={{ zIndex: 50, width: 220, background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg)' }}>
                                <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                                  <button type="button" onClick={() => setOpenFilter(null)} className="p-0.5 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                                    <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                  </button>
                                </div>
                                <div className="p-2 flex flex-col gap-1.5">
                                  {c.filter.node}
                                  {colFilters[c.filter.field] && (
                                    <button type="button" onClick={() => setColFilter(c.filter!.field, '')} className="text-[11px] font-medium text-left px-1" style={{ color: 'var(--accent-primary)' }}>{t('nurse.filterClear')}</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order._id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => { if (order.patientId) router.push(`/patients/${order.patientId}?tab=labs&focus=${order._id}`); }}>
                    <td>
                      <PatientName patientId={order.patientId} name={order.patientName} nameClassName="font-medium text-sm" />
                      <p className="text-xs font-mono" style={{ color: 'var(--accent-primary)' }}>{order.hospitalNumber}</p>
                    </td>
                    <td className="font-medium text-sm">
                      {order.testName}
                      {order.tier && (
                        <Badge tone={order.tier === 'special' ? 'accent' : 'neutral'} uppercase className="ml-2 align-middle">{order.tier}</Badge>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{order.specimen}</td>
                    <td>
                      <Badge tone={order.status === 'pending' ? 'warning' : order.status === 'in_progress' ? 'info' : 'neutral'}>
                        {ORDER_STAGE_LABEL[effOrderStatus(order)]}
                      </Badge>
                    </td>
                    <td>
                      {order.result ? (
                        <div>
                          <p className="text-sm" style={{ color: order.abnormal ? 'var(--color-danger)' : 'inherit', fontWeight: order.abnormal ? 600 : 400 }}>{order.result}</p>
                          {order.abnormal && <Badge tone="danger" className="mt-0.5">{t('lab.abnormal')}</Badge>}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{order.orderedBy}</td>
                    <td>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{order.orderedAt}</p>
                      {order.completedAt && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('lab.donePrefix', { time: order.completedAt })}</p>
                      )}
                    </td>
                    {canEnterLabResults && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const stage = effOrderStatus(order);
                          const btn = { padding: '4px 12px', fontSize: '0.75rem' } as const;
                          if (stage === 'ordered') {
                            return (
                              <button className="btn btn-primary btn-sm" style={btn}
                                onClick={() => advanceLabOrder(order._id, 'specimen_collected')}>Collect specimen</button>
                            );
                          }
                          if (stage === 'specimen_collected' || stage === 'rejected_needs_recollection') {
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                <button className="btn btn-primary btn-sm" style={btn}
                                  onClick={() => advanceLabOrder(order._id, 'received_at_lab')}>Receive at lab</button>
                                {stage === 'specimen_collected' && (
                                  <button className="btn btn-secondary btn-sm" style={btn}
                                    onClick={() => advanceLabOrder(order._id, 'rejected_needs_recollection')}>Reject</button>
                                )}
                                {stage === 'rejected_needs_recollection' && (
                                  <button className="btn btn-secondary btn-sm" style={btn}
                                    onClick={() => advanceLabOrder(order._id, 'specimen_collected')}>Re-collect</button>
                                )}
                              </div>
                            );
                          }
                          if (stage === 'received_at_lab') {
                            return (
                              <button className="btn btn-primary btn-sm" style={btn}
                                onClick={() => advanceLabOrder(order._id, 'in_process')}>Start processing</button>
                            );
                          }
                          if (stage === 'in_process') {
                            return (
                              <button className="btn btn-primary btn-sm" style={{ ...btn, background: 'var(--accent-primary)' }}
                                onClick={() => setResultDraft({
                                  orderId: order._id,
                                  patientName: order.patientName || '',
                                  testName: order.testName || '',
                                  result: '',
                                  unit: order.unit || '',
                                  referenceRange: order.referenceRange || '',
                                  abnormal: false,
                                  critical: false,
                                })}
                              >
                                {t('lab.enterResult')}
                              </button>
                            );
                          }
                          // resulted and beyond — awaiting the clinician's review.
                          // Allow correcting the entered result value (saved via the
                          // raw update path, which does not advance the lifecycle).
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Awaiting clinician review</span>
                              <button className="btn btn-secondary btn-sm" style={btn}
                                onClick={() => setResultDraft({
                                  orderId: order._id,
                                  patientName: order.patientName || '',
                                  testName: order.testName || '',
                                  result: order.result || '',
                                  unit: order.unit || '',
                                  referenceRange: order.referenceRange || '',
                                  abnormal: !!order.abnormal,
                                  critical: !!order.critical,
                                  criticalManual: !!order.critical,
                                })}
                              >
                                {t('action.edit')}
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!labLoading && filtered.length === 0 && (
              <EmptyState
                icon={FlaskConical}
                title={t('lab.noPendingOrders')}
                message={anyFilterActive ? t('lab.noPatientsMatch') : t('lab.infoSystemSubtitle')}
              />
            )}
            </div>
          </div>

          {/* Import from Analyzer Modal */}
          {showImportModal && (
            <Modal onClose={resetImport}>
              <div className="modal-content card-elevated p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <h3 className="text-base font-semibold">Import from analyzer</h3>
                  </div>
                  <button onClick={resetImport} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Paste a raw instrument result message (LIS-2A / ASTM or HL7 ORU^R01). Parsed results are shown for review — nothing is saved automatically.
                </p>
                <textarea
                  rows={6}
                  value={importRaw}
                  onChange={e => setImportRaw(e.target.value)}
                  placeholder={'H|\\^&|||Sysmex^XN-330|...\nO|1|ACC-7788|...\nR|1|^^^HGB^Hemoglobin|9.8|g/dL|...'}
                  className="w-full p-2.5 rounded-lg outline-none text-xs font-mono"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={handleParseImport} className="btn btn-primary btn-sm" disabled={!importRaw.trim()} style={{ opacity: importRaw.trim() ? 1 : 0.5 }}>
                    Parse payload
                  </button>
                  {importProtocol && (
                    <span className="text-[11px] font-mono px-2 py-1 rounded" style={{
                      background: importProtocol === 'unknown' ? 'rgba(229,46,66,0.1)' : 'var(--accent-light)',
                      color: importProtocol === 'unknown' ? 'var(--color-danger)' : 'var(--accent-primary)',
                    }}>
                      protocol: {importProtocol}
                    </span>
                  )}
                </div>

                {importWarnings.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(229,46,66,0.06)', border: '1px solid var(--color-danger)' }}>
                    {importWarnings.map((w, i) => (
                      <p key={i} className="text-[11px]" style={{ color: 'var(--color-danger)' }}>{w}</p>
                    ))}
                  </div>
                )}

                {importParsed && importParsed.length > 0 && (
                  <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
                    <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th>Test</th>
                          <th>Value</th>
                          <th>Unit</th>
                          <th>Ref</th>
                          <th>Flag</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {importParsed.map((p, i) => {
                          const value = p.numericValue != null ? String(p.numericValue) : (p.textValue || '');
                          const crit = evaluateCritical(p.testName, value);
                          return (
                            <tr key={`${p.testCode}-${i}`}>
                              <td className="text-sm font-medium">{p.testName || p.testCode}</td>
                              <td className="text-sm" style={{ color: crit.isCriticalValue ? 'var(--color-danger)' : 'inherit', fontWeight: crit.isCriticalValue ? 600 : 400 }}>{value}</td>
                              <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.unit || '—'}</td>
                              <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.referenceRange || '—'}</td>
                              <td>
                                {crit.isCriticalValue ? (
                                  <Badge tone="danger" uppercase>CRITICAL</Badge>
                                ) : p.abnormalFlag && p.abnormalFlag.toUpperCase() !== 'N' ? (
                                  <Badge tone="warning">{p.abnormalFlag}</Badge>
                                ) : (
                                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                                  onClick={() => prefillFromAnalyzer(p)}>
                                  Review &amp; enter
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {importParsed && importParsed.length === 0 && importProtocol !== 'unknown' && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>No results found in the payload.</p>
                )}
              </div>
            </Modal>
          )}

          {/* New Lab Order Modal */}
          {showOrderModal && (
            <Modal onClose={() => !orderSubmitting && setShowOrderModal(false)}>
              <div className="modal-content card-elevated p-6 max-w-xl w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <h3 className="text-base font-semibold">{t('lab.newLabOrder')}</h3>
                  </div>
                  <button onClick={() => setShowOrderModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('lab.patient')}</label>
                    {(() => {
                      const selectedPatient = orderPatientId ? patients.find(p => p._id === orderPatientId) : null;
                      if (selectedPatient) {
                        return (
                          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {t('lab.selectedLabel')} <span className="font-medium">{selectedPatient.firstName} {selectedPatient.surname}</span>
                              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({selectedPatient.hospitalNumber})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => { setOrderPatientId(''); setLabOrderPatientSearch(''); }}
                              className="text-xs underline"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              {t('lab.change')}
                            </button>
                          </div>
                        );
                      }
                      const q = labOrderPatientSearch.trim().toLowerCase();
                      const matches = q.length >= 1
                        ? patients.filter(p => {
                            const name = `${p.firstName || ''} ${p.surname || ''}`.toLowerCase();
                            return name.includes(q)
                              || (p.hospitalNumber || '').toLowerCase().includes(q)
                              || (p.phone || '').toLowerCase().includes(q);
                          }).slice(0, 8)
                        : [];
                      return (
                        <div>
                          <input
                            type="search"
                            value={labOrderPatientSearch}
                            onChange={e => setLabOrderPatientSearch(e.target.value)}
                            placeholder={t('lab.searchPatientPlaceholder')}
                            className="w-full p-2.5 rounded-lg outline-none text-sm"
                            style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                          />
                          {matches.length > 0 && (
                            <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                              {matches.map(p => (
                                <button
                                  key={p._id}
                                  type="button"
                                  onClick={() => { setOrderPatientId(p._id); setLabOrderPatientSearch(''); }}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                                  style={{ borderBottom: '1px solid var(--border-light)' }}
                                >
                                  <span className="text-sm font-medium truncate">{p.firstName} {p.surname}</span>
                                  <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {q.length >= 1 && matches.length === 0 && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('lab.noPatientsMatch')}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('lab.testsSelectedLabel', { count: orderTests.length })}</label>
                      {orderTests.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOrderTests([])}
                          className="text-xs underline"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          {t('action.clear')}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 rounded-lg keep-cols" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                      {LAB_TESTS_CATALOG.map(t => {
                        const checked = orderTests.includes(t.name);
                        return (
                          <label key={t.name} className="flex items-center gap-2 p-2 rounded text-xs cursor-pointer" style={{ background: checked ? 'var(--accent-light)' : 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                if (e.target.checked) setOrderTests([...orderTests, t.name]);
                                else setOrderTests(orderTests.filter(n => n !== t.name));
                              }}
                            />
                            <span className="flex-1">
                              <span className="font-medium">{t.name}</span>
                              <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.specimen}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('lab.priority')}</label>
                      <select value={orderPriority} onChange={e => setOrderPriority(e.target.value as 'routine' | 'urgent' | 'stat')}>
                        <option value="routine">{t('appointments.priorityRoutine')}</option>
                        <option value="urgent">{t('appointments.priorityUrgent')}</option>
                        <option value="stat">{t('lab.priorityStat')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('referral.notes')}</label>
                    <textarea rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder={t('lab.clinicalNotesPlaceholder')} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowOrderModal(false)} className="btn btn-secondary flex-1" disabled={orderSubmitting}>{t('action.cancel')}</button>
                  <button onClick={handleCreateOrders} className="btn btn-primary flex-1" disabled={orderSubmitting}>
                    {orderSubmitting ? t('lab.creating') : t('dashboard.orderTests', { count: orderTests.length })}
                  </button>
                </div>
              </div>
            </Modal>
          )}
      </main>
    </>
  );
}
