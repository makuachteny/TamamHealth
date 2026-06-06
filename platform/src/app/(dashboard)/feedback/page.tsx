'use client';

import { useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { ThumbsUp, Plus, X, Search, Star, AlertCircle } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { FeedbackCategory, PatientFeedbackDoc } from '@/lib/db-types-feedback';

const CATEGORIES: { id: FeedbackCategory; labelKey: string }[] = [
  { id: 'wait_time', labelKey: 'feedback.categoryWaitTime' },
  { id: 'staff_courtesy', labelKey: 'feedback.categoryStaffCourtesy' },
  { id: 'cleanliness', labelKey: 'feedback.categoryCleanliness' },
  { id: 'medication_availability', labelKey: 'feedback.categoryMedicationAvailability' },
  { id: 'cost', labelKey: 'feedback.categoryCost' },
  { id: 'clinical_quality', labelKey: 'feedback.categoryClinicalQuality' },
  { id: 'communication', labelKey: 'feedback.categoryCommunication' },
  { id: 'other', labelKey: 'feedback.categoryOther' },
];

const CHANNELS: { id: PatientFeedbackDoc['channel']; labelKey: string }[] = [
  { id: 'in_person', labelKey: 'feedback.channelInPerson' },
  { id: 'sms', labelKey: 'feedback.channelSms' },
  { id: 'whatsapp', labelKey: 'feedback.channelWhatsapp' },
  { id: 'phone', labelKey: 'feedback.channelPhone' },
  { id: 'kiosk', labelKey: 'feedback.channelKiosk' },
  { id: 'web', labelKey: 'feedback.channelWeb' },
];

export default function FeedbackPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { feedback, summary, submit, resolve } = useFeedback();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<'all' | 'pending' | 'positive' | 'negative'>('all');
  const [q, setQ] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [resolveFor, setResolveFor] = useState<PatientFeedbackDoc | null>(null);

  const facilityId = currentUser?.hospitalId || currentUser?.hospital?._id || '';
  const facilityName = currentUser?.hospital?.name || currentUser?.hospitalName || t('feedback.facilityFallback');

  const [form, setForm] = useState({
    patientId: '',
    rating: 4,
    npsScore: 8,
    category: 'staff_courtesy' as FeedbackCategory,
    comment: '',
    channel: 'in_person' as PatientFeedbackDoc['channel'],
    department: '',
  });

  const [resForm, setResForm] = useState({
    status: 'resolved' as NonNullable<PatientFeedbackDoc['followUpStatus']>,
    notes: '',
  });

  const filtered = useMemo(() => {
    return feedback.filter(f => {
      if (filter === 'pending' && !(f.followUpRequired && (f.followUpStatus === 'open' || f.followUpStatus === 'in_progress'))) return false;
      if (filter === 'positive' && f.sentiment !== 'positive') return false;
      if (filter === 'negative' && f.sentiment !== 'negative') return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !(f.patientName || '').toLowerCase().includes(needle) &&
          !(f.comment || '').toLowerCase().includes(needle) &&
          !(f.department || '').toLowerCase().includes(needle)
        ) return false;
      }
      return true;
    });
  }, [feedback, filter, q]);

  const handleSubmit = async () => {
    if (!facilityId) { showToast(t('feedback.toastNoFacility'), 'error'); return; }
    const patient = form.patientId ? patients.find(p => p._id === form.patientId) : null;
    try {
      await submit({
        patientId: patient?._id,
        patientName: patient ? `${patient.firstName} ${patient.surname}`.trim() : undefined,
        hospitalNumber: patient?.hospitalNumber,
        facilityId,
        facilityName,
        department: form.department || undefined,
        rating: form.rating,
        npsScore: form.npsScore,
        category: form.category,
        comment: form.comment.trim() || undefined,
        channel: form.channel,
        collectedBy: currentUser?._id || currentUser?.username,
        collectedByName: currentUser?.name,
      });
      showToast(t('feedback.toastRecorded'), 'success');
      setOpenModal(false);
      setForm({ patientId: '', rating: 4, npsScore: 8, category: 'staff_courtesy', comment: '', channel: 'in_person', department: '' });
    } catch (err) {
      console.error(err);
      showToast(t('feedback.toastRecordFailed'), 'error');
    }
  };

  const handleResolve = async () => {
    if (!resolveFor || !currentUser) return;
    try {
      await resolve(resolveFor._id, {
        status: resForm.status,
        notes: resForm.notes.trim() || undefined,
        resolvedBy: currentUser._id || currentUser.username || 'unknown',
        resolvedByName: currentUser.name,
      });
      showToast(t('feedback.toastResolved'), 'success');
      setResolveFor(null);
      setResForm({ status: 'resolved', notes: '' });
    } catch (err) {
      console.error(err);
      showToast(t('feedback.toastResolveFailed'), 'error');
    }
  };

  return (
    <>
      <TopBar title={t('feedback.title')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={ThumbsUp}
          title={t('feedback.title')}
          subtitle={t('feedback.subtitle', { facility: facilityName, count: summary?.total ?? 0 })}
          actions={
            <button onClick={() => setOpenModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('feedback.recordFeedback')}
            </button>
          }
        />

        {/* KPIs */}
        {summary && (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch' }}>
            {[
              { label: t('feedback.kpiAvgRating'), value: summary.total > 0 ? summary.averageRating.toFixed(1) : '—', accent: '#E4A84B', bg: 'rgba(228, 168, 75, 0.10)', border: 'rgba(228, 168, 75, 0.28)' },
              { label: t('feedback.kpiPositive'), value: summary.positive, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.26)' },
              { label: t('feedback.kpiNegative'), value: summary.negative, accent: '#C44536', bg: 'rgba(196, 69, 54, 0.10)', border: 'rgba(196, 69, 54, 0.28)' },
              { label: t('feedback.kpiOpenFollowUps'), value: summary.openFollowUps, accent: summary.openFollowUps > 0 ? '#C44536' : 'var(--accent-primary)', bg: summary.openFollowUps > 0 ? 'rgba(196, 69, 54, 0.10)' : 'rgba(59, 130, 246, 0.08)', border: summary.openFollowUps > 0 ? 'rgba(196, 69, 54, 0.28)' : 'rgba(59, 130, 246, 0.22)' },
            ].map(k => (
              <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills + search */}
        <div className="dash-card p-3 mb-3">
          <div className="flex gap-2 items-center flex-wrap">
            {(['all', 'pending', 'positive', 'negative'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`btn btn-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
              >
                {tab === 'pending' ? t('feedback.filterPendingFollowUp') : tab === 'all' ? t('feedback.filterAll') : tab === 'positive' ? t('feedback.filterPositive') : t('feedback.filterNegative')}
              </button>
            ))}
            <div className="relative flex-1 min-w-[200px] ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input className="pl-9 search-icon-input" placeholder={t('feedback.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} style={{ background: 'var(--overlay-subtle)' }} />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="dash-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <ThumbsUp className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              {t('feedback.emptyState')}
            </div>
          ) : (
            <div>
              {filtered.map(f => {
                const sentTokens = f.sentiment === 'positive'
                  ? { color: '#15795C', bg: 'rgba(27, 158, 119, 0.12)' }
                  : f.sentiment === 'negative'
                  ? { color: '#C44536', bg: 'rgba(196, 69, 54, 0.12)' }
                  : { color: '#5A7370', bg: 'rgba(90, 115, 112, 0.12)' };
                const followUpOpen = f.followUpRequired && (f.followUpStatus === 'open' || f.followUpStatus === 'in_progress');
                return (
                  <div key={f._id} className={`data-row ${f.sentiment === 'negative' ? 'data-row--danger' : ''}`}>
                    <div className="data-row__icon" style={{ background: sentTokens.bg, color: sentTokens.color }}>
                      <Star className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {f.patientName || t('feedback.anonymous')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: sentTokens.bg, color: sentTokens.color }}>
                          {f.rating}/5 · {(() => { const c = CATEGORIES.find(c => c.id === f.category); return c ? t(c.labelKey) : f.category; })()}
                        </span>
                        {f.department && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· {f.department}</span>}
                        <span className="text-[11px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>
                          {new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {f.channel.replace('_', ' ')}
                        </span>
                      </div>
                      {f.comment && (
                        <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>“{f.comment}”</p>
                      )}
                      {f.followUpStatus && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{
                            background: f.followUpStatus === 'resolved' ? 'rgba(59, 130, 246, 0.14)' : f.followUpStatus === 'wont_fix' ? 'rgba(90, 115, 112, 0.14)' : 'rgba(228, 168, 75, 0.14)',
                            color: f.followUpStatus === 'resolved' ? '#15795C' : f.followUpStatus === 'wont_fix' ? '#5A7370' : '#B8741C',
                          }}>
                            {f.followUpStatus.replace('_', ' ')}
                          </span>
                          {f.followUpNotes && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.followUpNotes}</span>}
                        </div>
                      )}
                    </div>
                    {followUpOpen && (
                      <button onClick={() => setResolveFor(f)} className="btn btn-secondary btn-sm">{t('feedback.resolve')}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit modal */}
        {openModal && (
          <div className="modal-backdrop" onClick={() => setOpenModal(false)}>
            <div className="modal-content card-elevated p-6 max-w-lg w-full" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('feedback.modalTitle')}</h3>
                <button onClick={() => setOpenModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.patientOptional')}</label>
                  <select value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })}>
                    <option value="">{t('feedback.anonymous')}</option>
                    {patients.slice(0, 200).map(p => (
                      <option key={p._id} value={p._id}>{p.firstName} {p.surname} · {p.hospitalNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.overallRating')}</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, rating: n })}
                        className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors"
                        style={{
                          background: form.rating === n ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                          color: form.rating === n ? '#fff' : 'var(--text-primary)',
                          border: '1px solid var(--border-light)',
                        }}
                      >{n} ★</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.category')}</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as FeedbackCategory })}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.channel')}</label>
                    <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value as PatientFeedbackDoc['channel'] })}>
                      {CHANNELS.map(c => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.department')}</label>
                    <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder={t('feedback.departmentPlaceholder')} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.nps')}</label>
                    <input type="number" min={0} max={10} value={form.npsScore} onChange={e => setForm({ ...form, npsScore: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.comment')}</label>
                  <textarea rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} placeholder={t('feedback.commentPlaceholder')} />
                </div>
                {form.rating <= 2 && (
                  <div className="text-[12px] flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(196, 69, 54, 0.08)', color: '#8B2E24', border: '1px solid rgba(196, 69, 54, 0.20)' }}>
                    <AlertCircle className="w-3.5 h-3.5" /> {t('feedback.negativeFlagNotice')}
                  </div>
                )}
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setOpenModal(false)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleSubmit} className="btn btn-primary flex-1">{t('action.submit')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Resolve modal */}
        {resolveFor && (
          <div className="modal-backdrop" onClick={() => setResolveFor(null)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('feedback.resolveFollowUp')}</h3>
                <button onClick={() => setResolveFor(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>
                  “{resolveFor.comment || t('feedback.noComment')}” — {resolveFor.patientName || t('feedback.anonymous')}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.outcome')}</label>
                  <select value={resForm.status} onChange={e => setResForm({ ...resForm, status: e.target.value as typeof resForm.status })}>
                    <option value="in_progress">{t('feedback.outcomeInProgress')}</option>
                    <option value="resolved">{t('feedback.outcomeResolved')}</option>
                    <option value="wont_fix">{t('feedback.outcomeWontFix')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('feedback.notes')}</label>
                  <textarea rows={3} value={resForm.notes} onChange={e => setResForm({ ...resForm, notes: e.target.value })} placeholder={t('feedback.notesPlaceholder')} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setResolveFor(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                <button onClick={handleResolve} className="btn btn-primary flex-1">{t('feedback.save')}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
