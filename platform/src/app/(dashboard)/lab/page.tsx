'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, Search, X, Plus, TrendingUp } from '@/components/icons/lucide';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';

interface ResultDraft {
  orderId: string;
  patientName: string;
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  critical: boolean;
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
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { globalSearch, currentUser } = useApp();
  const { results: labResults, update: updateLabResult, loading: labLoading, reload: reloadLabs } = useLabResults();
  const { patients } = usePatients();
  const { canEnterLabResults, canOrderLabs } = usePermissions();
  const { showToast } = useToast();
  const router = useRouter();
  const [resultDraft, setResultDraft] = useState<ResultDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      showToast('Please choose a patient', 'error');
      return;
    }
    if (orderTests.length === 0) {
      showToast('Select at least one test', 'error');
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
      showToast(`${orderTests.length} lab order(s) created`, 'success');
      setShowOrderModal(false);
      setOrderPatientId('');
      setLabOrderPatientSearch('');
      setOrderTests([]);
      setOrderNotes('');
      setOrderPriority('routine');
      await reloadLabs();
    } catch (err) {
      console.error(err);
      showToast('Failed to create lab order', 'error');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const filtered = labResults.filter(o => {
    const q = search || globalSearch;
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = !q || (o.patientName || '').toLowerCase().includes(q.toLowerCase()) || (o.testName || '').toLowerCase().includes(q.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pending = labResults.filter(o => o.status === 'pending').length;
  const inProgress = labResults.filter(o => o.status === 'in_progress').length;
  const completed = labResults.filter(o => o.status === 'completed').length;
  const abnormal = labResults.filter(o => o.abnormal).length;

  // Lab turnaround time analysis: parse orderedAt → completedAt, bucket
  // each completed result into a TAT band, and compute the median per
  // test type. Helps facility managers spot bottlenecks (e.g. cultures
  // that take 5+ days while RDTs return in <1h).
  const tatStats = useMemo(() => {
    const buckets = { '<1h': 0, '1-4h': 0, '4-24h': 0, '1-3d': 0, '>3d': 0 };
    const byTest: Record<string, number[]> = {};
    let totalCompleted = 0;
    let totalHours = 0;
    for (const r of labResults) {
      if (r.status !== 'completed' || !r.orderedAt || !r.completedAt) continue;
      const o = Date.parse(r.orderedAt);
      const c = Date.parse(r.completedAt);
      if (Number.isNaN(o) || Number.isNaN(c) || c < o) continue;
      const hours = (c - o) / 3600000;
      totalCompleted++;
      totalHours += hours;
      if (hours < 1) buckets['<1h']++;
      else if (hours < 4) buckets['1-4h']++;
      else if (hours < 24) buckets['4-24h']++;
      else if (hours < 72) buckets['1-3d']++;
      else buckets['>3d']++;
      if (!byTest[r.testName]) byTest[r.testName] = [];
      byTest[r.testName].push(hours);
    }
    const medianByTest = Object.entries(byTest).map(([name, hrs]) => {
      const sorted = [...hrs].sort((a, b) => a - b);
      let median = 0;
      if (sorted.length > 0) {
        const mid = Math.floor(sorted.length / 2);
        median = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      }
      return { name, median, count: hrs.length };
    }).sort((a, b) => b.median - a.median).slice(0, 6);
    return {
      buckets,
      totalCompleted,
      avgHours: totalCompleted > 0 ? totalHours / totalCompleted : 0,
      medianByTest,
    };
  }, [labResults]);

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
          showToast('Saved — but failed to notify doctor; please call them', 'error');
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
      <TopBar title="Laboratory" />
      <main className="page-container page-enter">
          <PageHeader
            icon={FlaskConical}
            title="Laboratory Information System"
            subtitle="Manage lab orders, track specimens, and view results"
            actions={canOrderLabs && (
              <button onClick={() => setShowOrderModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" /> New Order
              </button>
            )}
          />

          {labLoading && (
            <div className="card-elevated p-4 mb-4 flex items-center gap-3" style={{ background: 'var(--overlay-subtle)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading lab orders…</span>
            </div>
          )}

          {/* Stats */}
          <div className="kpi-grid mb-4">
            {[
              { label: 'Pending Orders', value: pending, icon: Clock, color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.10)' },
              { label: 'In Progress', value: inProgress, icon: FlaskConical, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.10)' },
              { label: 'Completed Today', value: completed, icon: CheckCircle2, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
              { label: 'Abnormal Results', value: abnormal, icon: AlertTriangle, color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.10)' },
            ].map(s => (
              <div key={s.label} className="kpi cursor-pointer" onClick={() => {
              const filterMap: Record<string, string> = { 'Pending Orders': 'pending', 'In Progress': 'in_progress', 'Completed Today': 'completed', 'Abnormal Results': 'completed' };
              setFilter(filterMap[s.label] || 'all');
            }}>
                <div className="kpi__icon" style={{ background: s.bg }}>
                  <s.icon style={{ color: s.color }} />
                </div>
                <div className="kpi__body">
                  <div className="kpi__value">{s.value}</div>
                  <div className="kpi__label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Turnaround Time Analysis */}
          {tatStats.totalCompleted > 0 && (
            <div className="card-elevated p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="font-semibold text-sm">Turnaround Time</h3>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Avg {tatStats.avgHours.toFixed(1)}h · n={tatStats.totalCompleted}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Distribution</p>
                  <div className="space-y-1.5">
                    {Object.entries(tatStats.buckets).map(([label, count]) => {
                      const pct = tatStats.totalCompleted > 0 ? Math.round((count / tatStats.totalCompleted) * 100) : 0;
                      const bg = label === '<1h' ? '#0D9488' : label === '1-4h' ? '#059669' : label === '4-24h' ? 'var(--accent-primary)' : label === '1-3d' ? 'var(--color-warning)' : 'var(--color-danger)';
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-[10px] w-12 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{label}</span>
                          <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--overlay-light)' }}>
                            <div className="h-full rounded flex items-center justify-end pr-1.5 transition-all duration-700"
                              style={{ width: `${Math.max(pct, 4)}%`, background: bg }}>
                              <span className="text-[9px] font-bold text-white">{count}</span>
                            </div>
                          </div>
                          <span className="text-[10px] w-9 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Slowest tests (median TAT)</p>
                  <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
                    {tatStats.medianByTest.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No completed tests yet.</p>
                    ) : tatStats.medianByTest.map(t => {
                      const hoursLabel = t.median < 1 ? `${Math.round(t.median * 60)}m` : t.median < 24 ? `${t.median.toFixed(1)}h` : `${(t.median / 24).toFixed(1)}d`;
                      const color = t.median < 4 ? '#0D9488' : t.median < 24 ? 'var(--color-warning)' : 'var(--color-danger)';
                      return (
                        <div key={t.name} className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded" style={{ background: 'var(--overlay-subtle)' }}>
                          <div className="icon-box-sm flex-shrink-0" style={{ background: `${color}15` }}>
                            <FlaskConical className="w-3 h-3" style={{ color }} />
                          </div>
                          <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>n={t.count}</span>
                          <span className="text-xs font-bold" style={{ color }}>{hoursLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card-elevated p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input type="search" placeholder="Search by patient or test name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 search-icon-input" style={{ background: 'var(--overlay-subtle)' }} />
              </div>
              <div className="flex gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'completed', label: 'Completed' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: filter === f.id ? 'var(--accent-primary)' : 'transparent',
                      color: filter === f.id ? 'white' : 'var(--text-secondary)',
                      border: filter === f.id ? 'none' : '1px solid var(--border-light)',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
                  title="Close"
                  disabled={submitting}
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                    <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Enter Lab Result</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{resultDraft.testName} · {resultDraft.patientName}</p>
                  </div>
                </div>

                <div className="space-y-3 mt-5">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Result *</label>
                    <input
                      type="text"
                      autoFocus
                      value={resultDraft.result}
                      onChange={(e) => setResultDraft({ ...resultDraft, result: e.target.value })}
                      placeholder="e.g. 12.4"
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
                      <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Unit</label>
                      <input
                        type="text"
                        value={resultDraft.unit}
                        onChange={(e) => setResultDraft({ ...resultDraft, unit: e.target.value })}
                        placeholder="e.g. mg/dL"
                        className="w-full p-2.5 rounded-lg outline-none text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Reference Range</label>
                      <input
                        type="text"
                        value={resultDraft.referenceRange}
                        onChange={(e) => setResultDraft({ ...resultDraft, referenceRange: e.target.value })}
                        placeholder="e.g. 7-10"
                        className="w-full p-2.5 rounded-lg outline-none text-sm"
                        style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={resultDraft.abnormal}
                        onChange={(e) => setResultDraft({ ...resultDraft, abnormal: e.target.checked, critical: e.target.checked ? resultDraft.critical : false })}
                      />
                      Abnormal
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)', opacity: resultDraft.abnormal ? 1 : 0.5 }}>
                      <input
                        type="checkbox"
                        checked={resultDraft.critical}
                        disabled={!resultDraft.abnormal}
                        onChange={(e) => setResultDraft({ ...resultDraft, critical: e.target.checked })}
                      />
                      Critical
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => setResultDraft(null)}
                    disabled={submitting}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitResult}
                    disabled={submitting || !resultDraft.result.trim()}
                    className="btn btn-primary btn-sm"
                    style={{ opacity: submitting || !resultDraft.result.trim() ? 0.6 : 1 }}
                  >
                    {submitting ? 'Saving…' : 'Save Result'}
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
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(229,46,66,0.12)' }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--color-danger)' }}>Confirm critical result</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Critical results trigger a high-priority alert to the ordering doctor. Please verify the values below before confirming.
                </p>
                <div className="rounded-lg p-3 space-y-1.5 mb-4" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>Patient</span><span className="font-medium">{resultDraft.patientName}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>Test</span><span className="font-medium">{resultDraft.testName}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>Value</span><span className="font-bold" style={{ color: 'var(--color-danger)' }}>{resultDraft.result}{resultDraft.unit ? ` ${resultDraft.unit}` : ''}</span></div>
                  <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-muted)' }}>Reference range</span><span className="font-medium">{resultDraft.referenceRange || '—'}</span></div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setCriticalConfirmOpen(false)}
                    disabled={submitting}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={persistResult}
                    disabled={submitting}
                    className="btn btn-sm"
                    style={{ background: 'var(--color-danger)', color: 'white', opacity: submitting ? 0.6 : 1 }}
                  >
                    {submitting ? 'Saving…' : 'Confirm critical result'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lab Orders Table */}
          <div className="card-elevated overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Test</th>
                  <th>Specimen</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>Ordered By</th>
                  <th>Time</th>
                  {canEnterLabResults && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order._id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => { if (order.patientId) router.push(`/patients/${order.patientId}`); }}>
                    <td>
                      <p className="font-medium text-sm">{order.patientName}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--accent-primary)' }}>{order.hospitalNumber}</p>
                    </td>
                    <td className="font-medium text-sm">{order.testName}</td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{order.specimen}</td>
                    <td>
                      <span className={`badge text-[10px] ${
                        order.status === 'pending' ? 'badge-warning' :
                        order.status === 'in_progress' ? 'badge-syncing' :
                        'badge-normal'
                      }`}>
                        {order.status === 'in_progress' ? 'Processing' : order.status === 'pending' ? 'Pending' : 'Completed'}
                      </span>
                    </td>
                    <td>
                      {order.result ? (
                        <div>
                          <p className="text-sm" style={{ color: order.abnormal ? 'var(--color-danger)' : 'inherit', fontWeight: order.abnormal ? 600 : 400 }}>{order.result}</p>
                          {order.abnormal && <span className="badge badge-emergency text-[9px] mt-0.5">Abnormal</span>}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{order.orderedBy}</td>
                    <td>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{order.orderedAt}</p>
                      {order.completedAt && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Done: {order.completedAt}</p>
                      )}
                    </td>
                    {canEnterLabResults && (
                      <td onClick={(e) => e.stopPropagation()}>
                        {order.status === 'pending' && (
                          <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                            onClick={() => updateLabResult(order._id, { status: 'in_progress' })}>Accept</button>
                        )}
                        {order.status === 'in_progress' && (
                          <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.75rem', background: 'var(--accent-primary)' }}
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
                            Enter Result
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* New Lab Order Modal */}
          {showOrderModal && (
            <div className="modal-backdrop" onClick={() => !orderSubmitting && setShowOrderModal(false)}>
              <div className="modal-content card-elevated p-6 max-w-xl w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <h3 className="text-base font-semibold">New Lab Order</h3>
                  </div>
                  <button onClick={() => setShowOrderModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Patient</label>
                    {(() => {
                      const selectedPatient = orderPatientId ? patients.find(p => p._id === orderPatientId) : null;
                      if (selectedPatient) {
                        return (
                          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              Selected: <span className="font-medium">{selectedPatient.firstName} {selectedPatient.surname}</span>
                              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({selectedPatient.hospitalNumber})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => { setOrderPatientId(''); setLabOrderPatientSearch(''); }}
                              className="text-xs underline"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              change
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
                            placeholder="Search by name, hospital number, or phone…"
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
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No patients match — try a different search.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Tests ({orderTests.length} selected)</label>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
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
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Priority</label>
                      <select value={orderPriority} onChange={e => setOrderPriority(e.target.value as 'routine' | 'urgent' | 'stat')}>
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT (immediate)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Clinical Notes</label>
                    <textarea rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Suspected diagnosis, relevant symptoms..." />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowOrderModal(false)} className="btn btn-secondary flex-1" disabled={orderSubmitting}>Cancel</button>
                  <button onClick={handleCreateOrders} className="btn btn-primary flex-1" disabled={orderSubmitting}>
                    {orderSubmitting ? 'Creating…' : `Order ${orderTests.length} Test${orderTests.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </>
  );
}
