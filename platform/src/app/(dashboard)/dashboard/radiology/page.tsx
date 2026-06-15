'use client';

import { useState, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import DemoModeBanner from '@/components/DemoModeBanner';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { usePatients } from '@/lib/hooks/usePatients';
import { useLabResults } from '@/lib/hooks/useLabResults';
import {
  Scan, Upload, CheckCircle2, Clock, AlertTriangle,
  FileText, BarChart3, TrendingUp, Eye,
  Image, Activity,
} from '@/components/icons/lucide';
import PatientName from '@/components/PatientName';

const ACCENT = '#7C3AED';

const MODALITIES = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Fluoroscopy', 'Mammography'];

// Demo data — only shown when NEXT_PUBLIC_DEMO_MODE !== 'false' AND no real
// studies exist yet. Production with the env var unset/false renders an
// empty-state instead so staff never mistake fake studies for real orders.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const SAMPLE_STUDIES = [
  { id: 'img-001', patientName: 'Deng Mabior Garang', modality: 'X-Ray', bodyPart: 'Chest PA', status: 'pending', priority: 'urgent', orderedBy: 'Dr. James Wani', date: '2026-02-09', notes: 'Suspected pneumonia, persistent cough 3 weeks' },
  { id: 'img-002', patientName: 'Nyabol Gatdet Koang', modality: 'Ultrasound', bodyPart: 'Obstetric', status: 'completed', priority: 'routine', orderedBy: 'Dr. Achol Mayen', date: '2026-02-09', notes: 'ANC scan, 28 weeks gestation', findings: 'Single viable fetus, cephalic presentation, AFI normal, EFW 1.2kg' },
  { id: 'img-003', patientName: 'Achol Mayen Deng', modality: 'X-Ray', bodyPart: 'Left Femur', status: 'completed', priority: 'emergency', orderedBy: 'Dr. Wani', date: '2026-02-08', notes: 'Trauma, fall from height', findings: 'Transverse fracture mid-shaft left femur, displacement present, no dislocation' },
  { id: 'img-004', patientName: 'Gatluak Ruot Nyuon', modality: 'Ultrasound', bodyPart: 'Abdomen', status: 'pending', priority: 'routine', orderedBy: 'CO Deng Mabior', date: '2026-02-09', notes: 'Abdominal pain, rule out hepatosplenomegaly' },
  { id: 'img-005', patientName: 'Rose Tombura Gbudue', modality: 'X-Ray', bodyPart: 'Chest PA/Lateral', status: 'in_progress', priority: 'urgent', orderedBy: 'Dr. TamamHealth Ladu', date: '2026-02-09', notes: 'TB screening, weight loss, night sweats' },
  { id: 'img-006', patientName: 'Kuol Akot Ajith', modality: 'Ultrasound', bodyPart: 'Renal', status: 'completed', priority: 'routine', orderedBy: 'Dr. Achol Mayen', date: '2026-02-08', notes: 'Elevated creatinine', findings: 'Bilateral mild hydronephrosis, cortical thinning right kidney' },
  { id: 'img-007', patientName: 'Majok Chol Wol', modality: 'X-Ray', bodyPart: 'Right Hand', status: 'pending', priority: 'routine', orderedBy: 'CO Stella', date: '2026-02-09', notes: 'Injury, swelling right hand' },
  { id: 'img-008', patientName: 'Ayen Dut Malual', modality: 'Ultrasound', bodyPart: 'Thyroid', status: 'completed', priority: 'routine', orderedBy: 'Dr. Wani', date: '2026-02-07', notes: 'Palpable thyroid nodule', findings: 'Solitary 1.8cm hypoechoic nodule right lobe, no calcifications, TIRADS 3' },
];

export default function RadiologyDashboard() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { results: labResults } = useLabResults();
  const [selectedStudy, setSelectedStudy] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [findings, setFindings] = useState('');
  // Local overrides so submitted demo findings persist for this session.
  // The radiology backend isn't wired yet, so we keep edits in memory
  // rather than letting the Submit button do nothing.
  const [submittedFindings, setSubmittedFindings] = useState<Record<string, string>>({});
  const [submitToast, setSubmitToast] = useState<string | null>(null);

  const studies = useMemo(
    () => (IS_DEMO ? SAMPLE_STUDIES : []).map(s => {
      const override = submittedFindings[s.id];
      return override ? { ...s, status: 'completed', findings: override } : s;
    }),
    [submittedFindings],
  );
  const filtered = filterStatus === 'all' ? studies : studies.filter(s => s.status === filterStatus);

  const handleSubmitReport = (studyId: string) => {
    if (!findings.trim()) return;
    setSubmittedFindings(prev => ({ ...prev, [studyId]: findings.trim() }));
    setFindings('');
    setSubmitToast(t('radiology.reportSubmittedFor', { id: studyId }));
    window.setTimeout(() => setSubmitToast(null), 3000);
  };

  const stats = useMemo(() => ({
    total: studies.length,
    pending: studies.filter(s => s.status === 'pending').length,
    inProgress: studies.filter(s => s.status === 'in_progress').length,
    completed: studies.filter(s => s.status === 'completed').length,
    urgent: studies.filter(s => s.priority === 'urgent' || s.priority === 'emergency').length,
    xray: studies.filter(s => s.modality === 'X-Ray').length,
    ultrasound: studies.filter(s => s.modality === 'Ultrasound').length,
    avgTAT: '45 min',
  }), [studies]);

  if (!currentUser) return null;

  return (
    <>
      <TopBar title={t('radiology.title')} />
      <main className="page-container page-enter">

        {IS_DEMO && <DemoModeBanner />}

        {submitToast && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold"
            style={{ background: 'rgba(5,150,105,0.10)', border: '1px solid rgba(5,150,105,0.25)', color: 'var(--color-success)' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {submitToast}
          </div>
        )}

        {/* KPI strip */}
        <div className="kpi-grid mb-4">
          {[
            { label: t('radiology.kpiTotalStudies'), value: stats.total, icon: Scan, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiPending'), value: stats.pending, icon: Clock, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiInProgress'), value: stats.inProgress, icon: Activity, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiCompleted'), value: stats.completed, icon: CheckCircle2, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiUrgentEmergency'), value: stats.urgent, icon: AlertTriangle, color: 'var(--color-danger)' },
            { label: t('radiology.kpiXrays'), value: stats.xray, icon: Image, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiUltrasounds'), value: stats.ultrasound, icon: Eye, color: 'var(--accent-primary)' },
            { label: t('radiology.kpiAvgTat'), value: stats.avgTAT, icon: TrendingUp, color: 'var(--accent-primary)' },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Study worklist */}
          <div className="lg:col-span-2 dash-card" style={{ padding: '16px', maxHeight: 'none', overflow: 'auto' }}>
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('radiology.imagingWorklist')}</span>
              </div>
              <div className="flex items-center gap-2">
                {['all', 'pending', 'in_progress', 'completed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: filterStatus === s ? ACCENT : 'var(--overlay-subtle)',
                    color: filterStatus === s ? '#fff' : 'var(--text-muted)',
                    border: filterStatus === s ? 'none' : '1px solid var(--border-medium)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}>{t(`radiology.filter_${s}`)}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center gap-2 text-center"
                  style={{ padding: '40px 16px', color: 'var(--text-muted)' }}
                >
                  <Scan className="w-6 h-6" style={{ opacity: 0.5 }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {t('radiology.noStudies')}
                  </p>
                  <p className="text-xs">{t('radiology.noStudiesDesc')}</p>
                </div>
              )}
              {filtered.map(study => (
                <div key={study.id} onClick={() => setSelectedStudy(selectedStudy === study.id ? null : study.id)}
                  className="cursor-pointer transition-colors" style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border-light)',
                    background: selectedStudy === study.id ? 'var(--accent-light)' : 'transparent',
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                      background: study.status === 'completed' ? '#05966915' : study.priority === 'emergency' ? '#DC262615' : study.priority === 'urgent' ? '#D9770615' : `${ACCENT}15`,
                    }}>
                      {study.status === 'completed' ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} /> :
                       study.priority === 'emergency' ? <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} /> :
                       <Scan className="w-4 h-4" style={{ color: study.priority === 'urgent' ? 'var(--color-warning)' : ACCENT }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PatientName name={study.patientName} nameClassName="text-sm font-semibold" />
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                          background: study.priority === 'emergency' ? '#DC262615' : study.priority === 'urgent' ? '#D9770615' : 'var(--overlay-subtle)',
                          color: study.priority === 'emergency' ? 'var(--color-danger)' : study.priority === 'urgent' ? 'var(--color-warning)' : 'var(--text-muted)',
                        }}>{t(`radiology.priority_${study.priority}`)}</span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {study.modality} &middot; {study.bodyPart} &middot; {study.date}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{
                      background: study.status === 'completed' ? '#05966915' : study.status === 'in_progress' ? '#3b82f615' : '#D9770615',
                      color: study.status === 'completed' ? 'var(--color-success)' : study.status === 'in_progress' ? 'var(--accent-primary)' : 'var(--color-warning)',
                    }}>{t(`radiology.status_${study.status}`)}</span>
                  </div>

                  {selectedStudy === study.id && (
                    <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div><span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('radiology.orderedBy')}</span><p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{study.orderedBy}</p></div>
                        <div><span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('radiology.modality')}</span><p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{study.modality}</p></div>
                      </div>
                      <div className="mb-3"><span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{t('radiology.clinicalNotes')}</span><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{study.notes}</p></div>

                      {study.findings && (
                        <div className="mb-3 p-3 rounded-lg" style={{ background: '#05966908', border: '1px solid #05966920' }}>
                          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-success)' }}>{t('radiology.findings')}</span>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-primary)' }}>{study.findings}</p>
                        </div>
                      )}

                      {study.status !== 'completed' && (
                        <div>
                          <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{t('radiology.enterFindings')}</label>
                          <textarea rows={3} value={findings} onChange={e => setFindings(e.target.value)}
                            placeholder={t('radiology.findingsPlaceholder')}
                            className="w-full p-3 rounded-lg text-xs" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', resize: 'vertical' }}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleSubmitReport(study.id)}
                              disabled={!findings.trim()}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold"
                              style={{
                                background: findings.trim() ? ACCENT : 'var(--overlay-subtle)',
                                color: findings.trim() ? '#fff' : 'var(--text-muted)',
                                border: 'none',
                                cursor: findings.trim() ? 'pointer' : 'not-allowed',
                                opacity: findings.trim() ? 1 : 0.7,
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" /> {t('radiology.submitReport')}
                            </button>
                            <button
                              disabled
                              title={t('radiology.attachImageTitle')}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold"
                              style={{
                                background: 'var(--overlay-subtle)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-medium)',
                                cursor: 'not-allowed',
                                opacity: 0.6,
                              }}
                            >
                              <Upload className="w-3 h-3" /> {t('radiology.attachImage')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right column - stats */}
          <div className="flex flex-col gap-3">

            {/* Modality breakdown */}
            <div className="dash-card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <BarChart3 className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('radiology.byModality')}</span>
              </div>
              <div className="p-4 space-y-3">
                {MODALITIES.map(mod => {
                  const count = studies.filter(s => s.modality === mod).length;
                  const pct = studies.length > 0 ? Math.round((count / studies.length) * 100) : 0;
                  return (
                    <div key={mod}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{mod}</span>
                        <span className="text-[11px] font-bold" style={{ color: count > 0 ? ACCENT : 'var(--text-muted)' }}>{count}</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-medium)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body parts studied */}
            <div className="dash-card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('radiology.bodyRegions')}</span>
              </div>
              <div className="p-4 space-y-1">
                {[...new Set(studies.map(s => s.bodyPart))].map(part => (
                  <div key={part} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{part}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{studies.filter(s => s.bodyPart === part).length}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="dash-card">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('radiology.performance')}</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: t('radiology.completionRate'), value: `${studies.length > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%` },
                  { label: t('radiology.kpiAvgTat'), value: stats.avgTAT },
                  { label: t('radiology.totalPatients'), value: patients.length },
                  { label: t('radiology.labCrossRefs'), value: labResults.length },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-md text-center" style={{ background: 'var(--overlay-subtle)' }}>
                    <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                    <div className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
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
