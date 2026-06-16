'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import PatientName from '@/components/PatientName';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { FlaskConical, AlertTriangle, X, Plus } from '@/components/icons/lucide';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { FilterBar, SearchInput, FilterTabs } from '@/components/filters';
import type { LabOrderStatus } from '@/lib/clinical-flow/order-lifecycles';
import { useSettings } from '@/lib/settings/SettingsProvider';

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
  const { results: labResults, update: updateLabResult, advance: advanceLabOrder, loading: labLoading, reload: reloadLabs } = useLabResults();
  const { patients } = usePatients();
  const { canEnterLabResults, canOrderLabs } = usePermissions();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { resultReviewSLA } = useSettings();
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
    const q = search || globalSearch;
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = !q || (o.patientName || '').toLowerCase().includes(q.toLowerCase()) || (o.testName || '').toLowerCase().includes(q.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pending = labResults.filter(o => o.status === 'pending').length;
  const inProgress = labResults.filter(o => o.status === 'in_progress').length;
  const completed = labResults.filter(o => o.status === 'completed').length;

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
      <TopBar title={t('lab.laboratory')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <PageHeader
            icon={FlaskConical}
            title={t('lab.infoSystem')}
            subtitle={t('lab.infoSystemSubtitle')}
            actions={canOrderLabs && (
              <button onClick={() => setShowOrderModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" /> {t('lab.newOrder')}
              </button>
            )}
          />

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

          {/* Filters */}
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder={t('lab.searchByPatientOrTest')} />
            <FilterTabs
              ariaLabel={t('lab.title')}
              active={filter}
              onChange={setFilter}
              tabs={[
                { key: 'all', label: t('lab.filterAll'), count: labResults.length },
                { key: 'pending', label: t('lab.filterPending'), count: pending },
                { key: 'in_progress', label: t('lab.inProgress'), count: inProgress },
                { key: 'completed', label: t('referral.completed'), count: completed },
              ]}
            />
          </FilterBar>

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
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                    <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.enterLabResult')}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{resultDraft.testName} · {resultDraft.patientName}</p>
                  </div>
                </div>

                <div className="space-y-3 mt-5">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t('lab.resultRequired')}</label>
                    <input
                      type="text"
                      autoFocus
                      value={resultDraft.result}
                      onChange={(e) => setResultDraft({ ...resultDraft, result: e.target.value })}
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
                        onChange={(e) => setResultDraft({ ...resultDraft, critical: e.target.checked })}
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
                    disabled={submitting || !resultDraft.result.trim()}
                    className="btn btn-primary btn-sm"
                    style={{ opacity: submitting || !resultDraft.result.trim() ? 0.6 : 1 }}
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
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(229,46,66,0.12)' }}>
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
          <div className="card-elevated overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('lab.patient')}</th>
                  <th>{t('lab.testName')}</th>
                  <th>{t('lab.specimen')}</th>
                  <th>{t('lab.status')}</th>
                  <th>{t('lab.result')}</th>
                  <th>{t('lab.orderedByLabel')}</th>
                  <th>{t('lab.time')}</th>
                  {canEnterLabResults && <th>{t('lab.action')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order._id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => { if (order.patientId) router.push(`/patients/${order.patientId}`); }}>
                    <td>
                      <PatientName name={order.patientName} nameClassName="font-medium text-sm" />
                      <p className="text-xs font-mono" style={{ color: 'var(--accent-primary)' }}>{order.hospitalNumber}</p>
                    </td>
                    <td className="font-medium text-sm">
                      {order.testName}
                      {order.tier && (
                        <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded align-middle" style={{ background: order.tier === 'special' ? 'rgba(124,58,237,0.12)' : 'var(--overlay-medium)', color: order.tier === 'special' ? '#7C3AED' : 'var(--text-muted)' }}>{order.tier}</span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{order.specimen}</td>
                    <td>
                      <span className={`badge text-[10px] ${
                        order.status === 'pending' ? 'badge-warning' :
                        order.status === 'in_progress' ? 'badge-syncing' :
                        'badge-normal'
                      }`}>
                        {ORDER_STAGE_LABEL[effOrderStatus(order)]}
                      </span>
                    </td>
                    <td>
                      {order.result ? (
                        <div>
                          <p className="text-sm" style={{ color: order.abnormal ? 'var(--color-danger)' : 'inherit', fontWeight: order.abnormal ? 600 : 400 }}>{order.result}</p>
                          {order.abnormal && <span className="badge badge-emergency text-[9px] mt-0.5">{t('lab.abnormal')}</span>}
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
                          return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Awaiting clinician review</span>;
                        })()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

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
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>{t('lab.testsSelectedLabel', { count: orderTests.length })}</label>
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
