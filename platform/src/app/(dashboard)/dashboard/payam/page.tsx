'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import {
  Users, AlertTriangle, TrendingUp, TrendingDown,
  ChevronRight, Stethoscope,
  Syringe, HeartPulse, Baby, FlaskConical,
  FileText, UserCheck, ArrowRightLeft,
  CheckCircle2, Building2, Eye, Flag, Clock, Home,
  Search, Check, MessageSquare, ThumbsUp,
} from '@/components/icons/lucide';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { usePatients } from '@/lib/hooks/usePatients';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { useBirths } from '@/lib/hooks/useBirths';
import { useHospitals } from '@/lib/hooks/useHospitals';
import type { BHWPerformance } from '@/lib/services/boma-visit-service';
import type { BomaVisitDoc } from '@/lib/db-types';
import type { ImmunizationDefaulter } from '@/lib/services/immunization-service';
import { formatCompactDateTime as formatAdmittedAt } from '@/lib/format-utils';

const DEPARTMENTS = ['OPD', 'Emergency', 'Maternity', 'Pediatrics', 'Surgery', 'Lab', 'Pharmacy', 'ICU'];
const DOCTORS = ['Dr. Wani James', 'Dr. Akol Deng', 'Dr. Ladu Morris', 'Dr. Achol Mabior', 'Dr. TamamHealth Philip'];
const NURSES = ['Nurse Ayen', 'Nurse Nyamal', 'Nurse Rose', 'Nurse Abuk', 'Nurse Dorothy'];
const ACCENT = 'var(--color-warning)';

// Suppress fabricated demo numbers (gender splits, week-by-week trends, fixed
// disease ratios) when the deployment opts out of demo mode.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="card-elevated p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', fontSize: '0.75rem', borderRadius: '12px' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const SATISFACTION_COLORS = ['var(--color-success)', '#5CB8A8', 'var(--color-warning)', '#F87171'];

export default function PayamSupervisorDashboard() {
  const router = useRouter();
  const { currentUser, globalSearch } = useApp();
  const { patients } = usePatients();
  const { referrals, accept } = useReferrals();
  const { alerts: diseaseAlerts } = useSurveillance();
  const { stats: immStats } = useImmunizations();
  const { stats: ancStats } = useANC();
  const { stats: birthStats } = useBirths();
  const { hospitals } = useHospitals();
  const [activeTab, setActiveTab] = useState('satisfaction');

  // BHW supervision data
  const [bhwPerformance, setBhwPerformance] = useState<BHWPerformance[]>([]);
  const [reviewQueue, setReviewQueue] = useState<BomaVisitDoc[]>([]);
  const [reviewStats, setReviewStats] = useState({ pending: 0, reviewed: 0, flagged: 0, total: 0 });
  const [defaulters, setDefaulters] = useState<ImmunizationDefaulter[]>([]);
  const [defaulterStats, setDefaulterStats] = useState({ totalDefaulters: 0, uniqueChildren: 0, critical: 0, high: 0, medium: 0, byVaccine: {} as Record<string, number> });
  const [supervisionTab, setSupervisionTab] = useState<'bhw' | 'review' | 'defaulters'>('bhw');
  const [reviewSearchQ, setReviewSearchQ] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedVisits, setSelectedVisits] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // Feedback types
  type FeedbackType = 'good' | 'needs_improvement' | 'urgent';
  interface BHWFeedback { workerId: string; type: FeedbackType; note: string; timestamp: string; }
  const [feedbackMap, setFeedbackMap] = useState<Record<string, BHWFeedback>>({});
  const [feedbackWorkerId, setFeedbackWorkerId] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');

  const loadBHWData = useCallback(async () => {
    try {
      const { getBHWPerformance, getVisitsForReview, getReviewStats } = await import('@/lib/services/boma-visit-service');
      const { getDefaulters, getDefaulterStats } = await import('@/lib/services/immunization-service');
      const [perf, queue, rStats, defs, dStats] = await Promise.all([
        getBHWPerformance(), getVisitsForReview(), getReviewStats(), getDefaulters(), getDefaulterStats(),
      ]);
      setBhwPerformance(perf); setReviewQueue(queue); setReviewStats(rStats);
      setDefaulters(defs); setDefaulterStats(dStats);
      try { const saved = localStorage.getItem('payam_bhw_feedback'); if (saved) setFeedbackMap(JSON.parse(saved)); } catch { /* ignore */ }
    } catch (err) {
      console.error('Failed to load BHW data:', err);
    }
  }, []);

  useEffect(() => { loadBHWData(); }, [loadBHWData]);

  const handleReview = useCallback(async (visitId: string, status: 'reviewed' | 'flagged') => {
    if (!currentUser) return;
    const { reviewVisit } = await import('@/lib/services/boma-visit-service');
    await reviewVisit(visitId, currentUser._id, currentUser.name, status, reviewNotes);
    setReviewingId(null); setReviewNotes('');
    setSelectedVisits(prev => { const n = new Set(prev); n.delete(visitId); return n; });
    loadBHWData();
  }, [currentUser, reviewNotes, loadBHWData]);

  const handleBulkApprove = useCallback(async () => {
    if (!currentUser || selectedVisits.size === 0) return;
    setBulkApproving(true);
    try {
      const { reviewVisit } = await import('@/lib/services/boma-visit-service');
      for (const visitId of selectedVisits) { await reviewVisit(visitId, currentUser._id, currentUser.name, 'reviewed', 'Bulk approved'); }
      setSelectedVisits(new Set()); loadBHWData();
    } catch (err) { console.error('Bulk approve failed:', err); }
    finally { setBulkApproving(false); }
  }, [currentUser, selectedVisits, loadBHWData]);

  const toggleVisitSelection = useCallback((visitId: string) => {
    setSelectedVisits(prev => { const n = new Set(prev); if (n.has(visitId)) n.delete(visitId); else n.add(visitId); return n; });
  }, []);

  const saveFeedback = useCallback((workerId: string, type: FeedbackType) => {
    const fb: BHWFeedback = { workerId, type, note: feedbackNote, timestamp: new Date().toISOString() };
    setFeedbackMap(prev => { const u = { ...prev, [workerId]: fb }; try { localStorage.setItem('payam_bhw_feedback', JSON.stringify(u)); } catch { /* */ } return u; });
    setFeedbackWorkerId(null); setFeedbackNote('');
  }, [feedbackNote]);

  // Performance scoring
  const getPerformanceScore = useCallback((bhw: BHWPerformance) => {
    const visitsPct = Math.min(100, (bhw.thisWeekVisits / 20) * 100);
    const approvalRate = Math.max(0, 100 - bhw.referralRate);
    return Math.min(100, Math.max(0, Math.round((visitsPct * 0.4) + (bhw.followUpCompletionRate * 0.3) + (approvalRate * 0.3))));
  }, []);

  // Alert escalation badges
  const getBHWAlerts = useCallback((bhw: BHWPerformance) => {
    const alerts: { label: string; color: string; bg: string }[] = [];
    const days = bhw.lastActiveDate ? Math.floor((Date.now() - new Date(bhw.lastActiveDate).getTime()) / 86400000) : 999;
    if (days >= 3) alerts.push({ label: 'INACTIVE', color: 'var(--color-danger)', bg: '#EF444415' });
    if (bhw.referralRate > 50) alerts.push({ label: 'HIGH REFERRAL RATE', color: 'var(--color-warning)', bg: '#F59E0B15' });
    if (bhw.followUpCompletionRate < 50) alerts.push({ label: 'LOW FOLLOW-UP', color: 'var(--color-warning)', bg: '#F59E0B15' });
    return alerts;
  }, []);

  if (!currentUser) return null;

  const hospital = currentUser.hospital;
  const OUR_HOSPITAL_ID = currentUser.hospitalId || '';

  // Identify Boma-level (PHCU) facilities for incoming transfer filtering
  const phcuFacilityIds = hospitals
    .filter(h => h.facilityType === 'phcu')
    .map(h => h._id);

  // Incoming Boma transfers: referrals sent TO this facility FROM a PHCU
  const incomingBomaTransfers = referrals.filter(
    r => r.toHospitalId === OUR_HOSPITAL_ID &&
      phcuFacilityIds.includes(r.fromHospitalId) &&
      (r.status === 'sent' || r.status === 'received')
  );

  const recentPatients = [...patients]
    .sort((a, b) => {
      const ta = new Date(a.registeredAt || a.registrationDate || 0).getTime();
      const tb = new Date(b.registeredAt || b.registrationDate || 0).getTime();
      return tb - ta;
    })
    .filter(p =>
      !globalSearch ||
      `${p.firstName} ${p.surname}`.toLowerCase().includes(globalSearch.toLowerCase()) ||
      p.hospitalNumber.toLowerCase().includes(globalSearch.toLowerCase())
    )
    .slice(0, 6);
  const activeAlerts = diseaseAlerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning');
  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received');

  const bedOccupancy = hospital && IS_DEMO ? Math.round((hospital.totalBeds * 0.72)) : 0;
  const bedTotal = hospital?.totalBeds || 0;
  const maleCount = IS_DEMO ? Math.floor(patients.length * 0.55) : 0;
  const femaleCount = IS_DEMO ? patients.length - maleCount : 0;
  const waitingCount = IS_DEMO ? Math.floor(patients.length * 0.12) : 0;
  const dischargeCount = IS_DEMO ? Math.floor(patients.length * 0.15) : 0;
  const transferCount = IS_DEMO ? Math.floor(patients.length * 0.02) : 0;

  const totalDoctors = hospital?.doctors || 0;
  const totalNurses = hospital?.nurses || 0;

  const satisfactionData = IS_DEMO
    ? [
        { name: 'Excellent', value: 54, color: 'var(--color-success)' },
        { name: 'Good', value: 23, color: '#5CB8A8' },
        { name: 'Average', value: 20, color: 'var(--color-warning)' },
        { name: 'Poor', value: 3, color: '#F87171' },
      ]
    : [];
  const satisfactionRate = IS_DEMO ? 76 : 0;

  const admittedPatients = recentPatients.map((p, i) => ({
    _id: p._id,
    name: `${p.firstName} ${p.surname}`,
    age: p.estimatedAge || (p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : 25 + i * 3),
    gender: p.gender?.[0] || (IS_DEMO ? (i % 2 === 0 ? 'M' : 'F') : ''),
    id: p.hospitalNumber,
    admittedAt: p.registeredAt || p.registrationDate,
    ward: IS_DEMO ? DEPARTMENTS[i % DEPARTMENTS.length] + '-' + (Math.floor(Math.random() * 15) + 1) : '',
    doctor: IS_DEMO ? DOCTORS[i % DOCTORS.length] : '',
    nurse: IS_DEMO ? NURSES[i % NURSES.length] : '',
    division: IS_DEMO ? DEPARTMENTS[i % DEPARTMENTS.length] : '',
    critical: IS_DEMO && (i === 0 || i === 4),
  }));

  const bedChartData = [
    { status: 'ICU', beds: hospital?.icuBeds ?? (IS_DEMO ? 8 : 0), color: 'var(--color-danger)' },
    { status: 'Maternity', beds: hospital?.maternityBeds ?? (IS_DEMO ? 30 : 0), color: '#EC4899' },
    { status: 'Pediatric', beds: hospital?.pediatricBeds ?? (IS_DEMO ? 20 : 0), color: '#5CB8A8' },
    { status: 'General', beds: Math.max(0, bedTotal - (hospital?.icuBeds || 0) - (hospital?.maternityBeds || 0) - (hospital?.pediatricBeds || 0)), color: 'var(--color-success)' },
    { status: 'Available', beds: Math.max(0, bedTotal - bedOccupancy), color: 'var(--text-muted)' },
  ];

  const inOutData = IS_DEMO
    ? [
        { week: 'Week 1', 'In Patients': Math.floor(patients.length * 0.3), 'Out Patients': Math.floor(patients.length * 0.18) },
        { week: 'Week 2', 'In Patients': Math.floor(patients.length * 0.35), 'Out Patients': Math.floor(patients.length * 0.22) },
        { week: 'Week 3', 'In Patients': Math.floor(patients.length * 0.28), 'Out Patients': Math.floor(patients.length * 0.2) },
        { week: 'Week 4', 'In Patients': Math.floor(patients.length * 0.4), 'Out Patients': Math.floor(patients.length * 0.25) },
      ]
    : [
        { week: 'Week 1', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 2', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 3', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 4', 'In Patients': 0, 'Out Patients': 0 },
      ];

  const diseaseDistribution = IS_DEMO
    ? [
        { name: 'Malaria', value: Math.floor(patients.length * 0.35), color: 'var(--color-danger)' },
        { name: 'Respiratory', value: Math.floor(patients.length * 0.2), color: 'var(--color-warning)' },
        { name: 'Diarrheal', value: Math.floor(patients.length * 0.15), color: '#5CB8A8' },
        { name: 'Maternal', value: Math.floor(patients.length * 0.12), color: '#EC4899' },
        { name: 'Other', value: Math.floor(patients.length * 0.18), color: 'var(--text-muted)' },
      ]
    : [];
  const totalCases = diseaseDistribution.reduce((s, d) => s + d.value, 0);

  const TABS = ['satisfaction', 'equipment', 'department', 'avg-wait'];

  const activeBHWs = bhwPerformance.filter(b => b.isActive).length;
  const totalBHWs = bhwPerformance.length;

  const filteredReviewQueue = reviewQueue.filter(v =>
    !reviewSearchQ || v.patientName.toLowerCase().includes(reviewSearchQ.toLowerCase()) ||
    v.workerName.toLowerCase().includes(reviewSearchQ.toLowerCase())
  );

  const selectAllRoutine = () => {
    const routineIds = filteredReviewQueue.filter(v => v.action === 'treated' && !v.referredTo).map(v => v._id);
    setSelectedVisits(new Set(routineIds));
  };

  return (
    <>
      <TopBar title="Payam Dashboard" />
      <main className="page-container page-enter">

        {/* ═══ TOP ROW: KPI Cards + Satisfaction ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" style={{ gridAutoRows: '1fr' }}>

          {/* Total Admitted Patients */}
          <div className="dash-card p-4 flex flex-col">
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Total Admitted Patients</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{patients.length || 0}</span>
              <span className="text-[10px] font-semibold flex items-center gap-0.5 mb-0.5" style={{ color: 'var(--accent-primary)' }}>
                <TrendingUp className="w-3 h-3" /> 2%
              </span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)' }}>
                  <Users className="w-2 h-2" style={{ color: '#5CB8A8' }} />
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>{maleCount}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Male</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.15)' }}>
                  <Users className="w-2 h-2" style={{ color: '#EC4899' }} />
                </span>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>{femaleCount}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Female</span>
              </div>
            </div>
            <div className="border-t pt-2 mt-auto grid grid-cols-3 gap-1" style={{ borderColor: 'var(--border-light)' }}>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{waitingCount}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Waiting</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dischargeCount}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Discharge</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{transferCount}</p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Transfer</p>
              </div>
            </div>
          </div>

          {/* Total Active Staff */}
          <div className="dash-card p-4 flex flex-col">
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Total Active Staff</p>
            <span className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{totalDoctors + totalNurses}</span>
            <div className="mt-auto space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-3.5 h-3.5" style={{ color: '#5CB8A8' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Doctors</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{totalDoctors}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Nursing</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{totalNurses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Active BHWs</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{activeBHWs}/{totalBHWs}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats — includes incoming Boma referrals count */}
          <div className="dash-card p-4 flex flex-col">
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Quick Overview</p>
            <div className="mt-auto space-y-2">
              {[
                { Icon: ArrowRightLeft, label: 'Incoming Boma Transfers', value: incomingBomaTransfers.length, color: ACCENT },
                { Icon: FileText, label: 'Pending Referrals', value: pendingReferrals.length, color: 'var(--color-warning)' },
                { Icon: AlertTriangle, label: 'Active Alerts', value: activeAlerts.length, color: 'var(--color-danger)' },
                { Icon: Syringe, label: 'Immunizations', value: immStats?.totalVaccinations || 0, color: '#A855F7' },
                { Icon: Baby, label: 'ANC / Births', value: `${ancStats?.totalVisits || 0} / ${birthStats?.total || 0}`, color: '#EC4899' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                    }}
                  >
                    <item.Icon className="w-3 h-3" style={{ color: item.color }} />
                  </div>
                  <span className="text-[11px] flex-1" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Satisfaction Donut */}
          <div className="dash-card p-4 flex flex-col">
            <div className="flex gap-0 mb-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab ? '2px solid #1B9AAA' : '2px solid transparent',
                  }}
                >
                  {tab === 'satisfaction' ? 'Satisfaction' : tab === 'equipment' ? 'Equipment' : tab === 'department' ? 'Dept' : 'Avg Wait'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-shrink-0">
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={satisfactionData} dataKey="value" cx="50%" cy="50%" outerRadius={40} innerRadius={25} paddingAngle={2}>
                      {satisfactionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {satisfactionData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SATISFACTION_COLORS[i] }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                    <span className="font-bold ml-auto" style={{ color: 'var(--text-primary)' }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 p-1.5 rounded-lg text-center" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Patient Satisfaction Rate</span>
              <span className="text-xl font-bold ml-2" style={{ color: 'var(--accent-primary)' }}>{satisfactionRate}%</span>
            </div>
          </div>
        </div>

        {/* ═══ INCOMING BOMA TRANSFERS ═══ */}
        {incomingBomaTransfers.length > 0 && (
          <div className="dash-card mb-6 overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Incoming Boma Transfers</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>
                  {incomingBomaTransfers.length}
                </span>
              </div>
              <button onClick={() => router.push('/referrals')} className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                All Referrals <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    {['Patient', 'From Facility', 'Department', 'Urgency', 'Date', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incomingBomaTransfers.map(ref => (
                    <tr key={ref._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{ref.patientName}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{ref.fromHospital}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{ref.department}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge urgency-${ref.urgency} text-[10px]`}>
                          {ref.urgency === 'emergency' && <AlertTriangle className="w-3 h-3" />}
                          {ref.urgency.charAt(0).toUpperCase() + ref.urgency.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>{ref.referralDate}</td>
                      <td className="px-4 py-2.5">
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                          style={{ background: 'var(--color-success)' }}
                          onClick={async () => {
                            try {
                              await accept(ref._id);
                            } catch {
                              console.error('Failed to accept referral');
                            }
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Accept
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ RECENTLY ADMITTED PATIENTS TABLE ═══ */}
        <div className="dash-card mb-6 overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recently Admitted Patients</h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-danger)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Critical</span>
              </span>
              <button onClick={() => router.push('/patients')} className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                Details <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {['Patient Name', 'Patient ID', 'Admitted', 'Ward-Room No.', 'Assigned Doctor', 'Assigned Nurse', 'Division'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admittedPatients.map((p) => (
                  <tr
                    key={p._id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                    onClick={() => router.push(`/patients/${p._id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${p._id}`); } }}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    title="View patient record"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{p.age} Y, {p.gender}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.id}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                        {formatAdmittedAt(p.admittedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.ward}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.doctor}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.nurse}</td>
                    <td className="px-4 py-2.5">
                      {p.critical ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)' }}>
                          {p.division}
                        </span>
                      ) : (
                        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.division}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ BOTTOM ROW: Disease Distribution + Bed Occupancy + In/Out Patient Rate ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Disease Distribution Donut */}
          <div className="glass-section">
            <div className="glass-section-header">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Disease Distribution</span>
              <button onClick={() => router.push('/surveillance')} className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                Details <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={diseaseDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={32} paddingAngle={2}>
                      {diseaseDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{totalCases}</p>
                    <p className="text-[8px]" style={{ color: 'var(--text-muted)' }}>Patients</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {diseaseDistribution.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-2.5 h-2.5 rounded" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({totalCases > 0 ? Math.round((d.value / totalCases) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {activeAlerts.length > 0 && (
              <div className="mx-4 mb-4 p-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(229,46,66,0.06)', border: '1px solid rgba(229,46,66,0.12)' }}>
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-danger)' }}>{activeAlerts.length} active disease alert(s)</span>
              </div>
            )}
          </div>

          {/* Bed Occupancy Bar Chart */}
          <div className="glass-section">
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bed Occupancy</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>({bedOccupancy}/{bedTotal})</span>
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bedChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="beds" name="Beds" radius={[6, 6, 0, 0]} barSize={32}>
                    {bedChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* In Patient-Out Patient Rate Line Chart */}
          <div className="glass-section">
            <div className="glass-section-header">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>In Patient-Out Patient Rate</span>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={inOutData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '6px' }} />
                  <Line type="monotone" dataKey="In Patients" stroke="#E52E42" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-danger)' }} />
                  <Line type="monotone" dataKey="Out Patients" stroke="#FCD34D" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-warning)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="mt-6 dash-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Quick Actions</p>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {[
              { label: 'New Patient', icon: Users, href: '/patients/new', color: 'var(--accent-primary)' },
              { label: 'Consultation', icon: FileText, href: '/consultation', color: 'var(--accent-primary)' },
              { label: 'Referral', icon: ArrowRightLeft, href: '/referrals', color: ACCENT },
              { label: 'Immunization', icon: Syringe, href: '/immunizations', color: '#A855F7' },
              { label: 'ANC Visit', icon: HeartPulse, href: '/anc', color: '#EC4899' },
              { label: 'Birth Reg.', icon: Baby, href: '/births', color: 'var(--color-warning)' },
              { label: 'Lab Results', icon: FlaskConical, href: '/lab', color: '#5CB8A8' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-2 p-2.5 rounded-xl transition-all"
                style={{ background: `${action.color}08`, border: `1px solid ${action.color}15` }}
              >
                <action.icon className="w-4 h-4" style={{ color: action.color }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ BHW SUPERVISION SECTION ═══ */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" style={{ color: ACCENT }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>BHW Supervision</h2>
            </div>
            <div className="flex gap-3 text-xs font-medium">
              <span style={{ color: 'var(--text-muted)' }}>Reviews: <strong style={{ color: ACCENT }}>{reviewStats.pending}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>Defaulters: <strong style={{ color: '#8B5CF6' }}>{defaulterStats.uniqueChildren}</strong></span>
            </div>
          </div>

          {/* Supervision tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--overlay-subtle)' }}>
            {[
              { id: 'bhw' as const, label: 'BHW Performance', icon: Users },
              { id: 'review' as const, label: `Review Queue (${reviewStats.pending})`, icon: Eye },
              { id: 'defaulters' as const, label: `Defaulters (${defaulterStats.uniqueChildren})`, icon: Syringe },
            ].map(tab => (
              <button key={tab.id} onClick={() => setSupervisionTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: supervisionTab === tab.id ? 'var(--bg-card)' : 'transparent', color: supervisionTab === tab.id ? ACCENT : 'var(--text-muted)', boxShadow: supervisionTab === tab.id ? 'var(--card-shadow)' : 'none' }}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </button>
            ))}
          </div>

          {/* BHW Performance Tab */}
          {supervisionTab === 'bhw' && (
            <div className="space-y-3">
              {bhwPerformance.length === 0 && (<div className="text-center py-12"><Users className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>No BHW data available yet</p></div>)}
              {bhwPerformance.map(bhw => {
                const daysSinceActive = bhw.lastActiveDate ? Math.floor((Date.now() - new Date(bhw.lastActiveDate).getTime()) / 86400000) : 0;
                const perfScore = getPerformanceScore(bhw);
                const scoreColor = perfScore > 80 ? 'var(--color-success)' : perfScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
                const alerts = getBHWAlerts(bhw);
                const feedback = feedbackMap[bhw.workerId];
                return (
                  <div key={bhw.workerId} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: `1px solid ${bhw.isActive ? 'var(--border-light)' : 'rgba(239,68,68,0.2)'}`, boxShadow: 'var(--card-shadow)' }}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: bhw.isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>
                            {bhw.workerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{bhw.workerName}</p>
                            <div className="flex items-center gap-2"><Home className="w-3 h-3" style={{ color: 'var(--text-muted)' }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Boma: {bhw.boma}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Performance Score */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: `${scoreColor}10`, border: `1px solid ${scoreColor}20` }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: scoreColor }}>
                              <span className="text-xs font-bold text-white">{perfScore}</span>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold" style={{ color: scoreColor }}>SCORE</p>
                              <div className="flex items-center gap-0.5">
                                {perfScore >= 50 ? <TrendingUp className="w-2.5 h-2.5" style={{ color: scoreColor }} /> : <TrendingDown className="w-2.5 h-2.5" style={{ color: scoreColor }} />}
                                <span className="text-[8px] font-bold" style={{ color: scoreColor }}>/100</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: bhw.isActive ? '#05966915' : '#EF444415', color: bhw.isActive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {bhw.isActive ? 'ACTIVE' : `INACTIVE ${daysSinceActive}d`}
                          </span>
                        </div>
                      </div>

                      {/* Alert Escalation Badges */}
                      {alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {alerts.map(alert => (
                            <span key={alert.label} className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: alert.bg, color: alert.color }}>
                              <AlertTriangle className="w-2.5 h-2.5" />{alert.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'This Week', value: bhw.thisWeekVisits, color: '#1B9AAA' },
                          { label: 'Total Visits', value: bhw.totalVisits, color: 'var(--color-success)' },
                          { label: 'Treated', value: bhw.treated, color: 'var(--color-success)' },
                          { label: 'Referred', value: bhw.referred, color: 'var(--color-warning)' },
                          { label: 'Follow-Up %', value: `${bhw.followUpCompletionRate}%`, color: bhw.followUpCompletionRate >= 80 ? 'var(--color-success)' : 'var(--color-danger)' },
                        ].map(metric => (
                          <div key={metric.label} className="p-2 rounded-lg text-center" style={{ background: 'var(--overlay-subtle)' }}>
                            <p className="text-base font-bold" style={{ color: metric.color }}>{metric.value}</p>
                            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{metric.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Referral Rate:</span>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--overlay-subtle)' }}>
                          <div className="h-full rounded-full" style={{ width: `${bhw.referralRate}%`, background: bhw.referralRate > 40 ? 'var(--color-danger)' : bhw.referralRate > 20 ? 'var(--color-warning)' : 'var(--color-success)' }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{bhw.referralRate}%</span>
                      </div>

                      {bhw.pendingReviews > 0 && (
                        <div className="mt-2 flex items-center gap-1.5"><Clock className="w-3 h-3" style={{ color: ACCENT }} /><span className="text-[10px] font-medium" style={{ color: ACCENT }}>{bhw.pendingReviews} visits pending review</span></div>
                      )}

                      {/* Feedback indicator */}
                      {feedback && (
                        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: feedback.type === 'good' ? '#05966908' : feedback.type === 'urgent' ? '#EF444408' : '#F59E0B08' }}>
                          <MessageSquare className="w-3 h-3" style={{ color: feedback.type === 'good' ? 'var(--color-success)' : feedback.type === 'urgent' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
                          <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            Feedback: {feedback.type === 'good' ? 'Good Work' : feedback.type === 'urgent' ? 'Urgent Attention' : 'Needs Improvement'} ({new Date(feedback.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                          </span>
                        </div>
                      )}

                      {/* Supervisor Feedback */}
                      {feedbackWorkerId === bhw.workerId ? (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Send Feedback</p>
                          <div className="flex gap-2 mb-2">
                            <button onClick={() => saveFeedback(bhw.workerId, 'good')} className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95" style={{ background: '#05966915', color: 'var(--color-success)', border: '1px solid #05966920' }}><ThumbsUp className="w-3.5 h-3.5" /> Good Work</button>
                            <button onClick={() => saveFeedback(bhw.workerId, 'needs_improvement')} className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95" style={{ background: '#F59E0B15', color: 'var(--color-warning)', border: '1px solid #F59E0B20' }}><AlertTriangle className="w-3.5 h-3.5" /> Needs Work</button>
                            <button onClick={() => saveFeedback(bhw.workerId, 'urgent')} className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95" style={{ background: '#EF444415', color: 'var(--color-danger)', border: '1px solid #EF444420' }}><Flag className="w-3.5 h-3.5" /> Urgent</button>
                          </div>
                          <textarea value={feedbackNote} onChange={e => setFeedbackNote(e.target.value)} placeholder="Optional note..." className="w-full px-3 py-2 rounded-lg text-xs mb-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '50px' }} />
                          <button onClick={() => { setFeedbackWorkerId(null); setFeedbackNote(''); }} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setFeedbackWorkerId(bhw.workerId)} className="mt-2 w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]" style={{ background: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}20` }}>
                          <MessageSquare className="w-3.5 h-3.5" /> Send Feedback
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Review Queue Tab */}
          {supervisionTab === 'review' && (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input type="text" value={reviewSearchQ} onChange={e => setReviewSearchQ(e.target.value)} placeholder="Search by patient or BHW name..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>

              {/* Bulk Actions */}
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selectedVisits.size > 0 ? `${selectedVisits.size} selected` : 'Bulk Actions'}</span>
                  <button onClick={selectAllRoutine} className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95" style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}20` }}>Select All Routine</button>
                </div>
                {selectedVisits.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={handleBulkApprove} disabled={bulkApproving} className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg text-white transition-all active:scale-95" style={{ background: 'var(--color-success)', opacity: bulkApproving ? 0.7 : 1 }}>
                      <CheckCircle2 className="w-3 h-3" />{bulkApproving ? 'Approving...' : `Approve Selected (${selectedVisits.size})`}
                    </button>
                    <button onClick={() => setSelectedVisits(new Set())} className="text-[10px] font-medium px-2 py-1" style={{ color: 'var(--text-muted)' }}>Clear</button>
                  </div>
                )}
              </div>

              {filteredReviewQueue.length === 0 && (<div className="text-center py-12"><CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-success)', opacity: 0.3 }} /><p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>All visits reviewed!</p></div>)}

              <div className="space-y-2">
                {filteredReviewQueue.map(visit => (
                  <div key={visit._id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: reviewingId === visit._id ? `2px solid ${ACCENT}` : selectedVisits.has(visit._id) ? '2px solid #059669' : '1px solid var(--border-light)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleVisitSelection(visit._id)} className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all" style={{ background: selectedVisits.has(visit._id) ? 'var(--color-success)' : 'transparent', border: selectedVisits.has(visit._id) ? '2px solid #059669' : '2px solid var(--border-medium)' }}>
                            {selectedVisits.has(visit._id) && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: visit.action === 'treated' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {visit.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{visit.patientName}</p>
                            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{visit.geocodeId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: visit.action === 'treated' ? '#05966915' : '#EF444415', color: visit.action === 'treated' ? 'var(--color-success)' : 'var(--color-danger)' }}>{visit.action.toUpperCase()}</span>
                          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(visit.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}><p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Complaint</p><p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{visit.chiefComplaint}</p></div>
                        <div className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}><p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Condition</p><p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{visit.suspectedCondition}</p></div>
                        <div className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}><p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>BHW</p><p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{visit.workerName}</p></div>
                      </div>
                      {visit.treatmentGiven && <p className="text-xs mb-2 p-1.5 rounded-lg" style={{ background: '#05966908', color: 'var(--color-success)' }}>Treatment: {visit.treatmentGiven}</p>}
                      {visit.referredTo && <p className="text-xs mb-2 p-1.5 rounded-lg" style={{ background: '#EF444408', color: 'var(--color-danger)' }}>Referred to: {visit.referredTo}</p>}
                      {reviewingId === visit._id ? (
                        <div className="space-y-2 mt-2">
                          <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add review notes (optional)..." className="w-full px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '60px' }} />
                          <div className="flex gap-2">
                            <button onClick={() => handleReview(visit._id, 'reviewed')} className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--color-success)' }}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                            <button onClick={() => handleReview(visit._id, 'flagged')} className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: 'var(--color-danger)' }}><Flag className="w-3.5 h-3.5" /> Flag</button>
                            <button onClick={() => { setReviewingId(null); setReviewNotes(''); }} className="px-3 py-2.5 rounded-lg text-xs font-medium" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(visit._id)} className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 mt-1" style={{ background: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}20` }}><Eye className="w-3.5 h-3.5" /> Review This Visit</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defaulters Tab */}
          {supervisionTab === 'defaulters' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Total Overdue', value: defaulterStats.totalDefaulters, color: 'var(--color-danger)' },
                  { label: 'Children', value: defaulterStats.uniqueChildren, color: '#8B5CF6' },
                  { label: 'Critical (>30d)', value: defaulterStats.critical, color: 'var(--color-danger)' },
                  { label: 'High (>14d)', value: defaulterStats.high, color: 'var(--color-warning)' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-3" style={{ background: `${stat.color}08`, border: `1px solid ${stat.color}15` }}>
                    <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              {defaulters.length === 0 && (<div className="text-center py-12"><Syringe className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-success)', opacity: 0.3 }} /><p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No immunization defaulters!</p></div>)}
              <div className="space-y-2">
                {defaulters.map((d, i) => (
                  <div key={`${d.patientId}-${d.vaccine}-${i}`} className="rounded-2xl p-3" style={{ background: 'var(--bg-card)', border: `1px solid ${d.urgency === 'critical' ? 'rgba(239,68,68,0.3)' : d.urgency === 'high' ? 'rgba(245,158,11,0.2)' : 'var(--border-light)'}`, boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: d.urgency === 'critical' ? 'var(--color-danger)' : d.urgency === 'high' ? 'var(--color-warning)' : '#8B5CF6' }}>
                          {d.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{d.patientName}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.gender} &middot; {d.ageMonths} months &middot; {d.facilityName}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: d.urgency === 'critical' ? '#EF444415' : d.urgency === 'high' ? '#F59E0B15' : '#8B5CF615', color: d.urgency === 'critical' ? 'var(--color-danger)' : d.urgency === 'high' ? 'var(--color-warning)' : '#8B5CF6' }}>
                        {d.daysOverdue} DAYS OVERDUE
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#8B5CF610' }}>
                        <Syringe className="w-3 h-3" style={{ color: '#8B5CF6' }} /><span className="text-xs font-medium" style={{ color: '#8B5CF6' }}>{d.vaccine} Dose {d.doseNumber}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Due: {new Date(d.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
