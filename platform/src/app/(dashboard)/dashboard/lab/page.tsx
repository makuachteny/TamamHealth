'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { isImagingStudy } from '@/lib/clinical-flow/lab-catalog';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import {
  FlaskConical, CheckCircle2, AlertTriangle, Activity,
  Radio, Microscope, Droplets, FileText,
  MessageSquare, Beaker, Thermometer, Loader2,
  X, Save, Table, List, BarChart3, Timer, BellOff, Users,
} from '@/components/icons/lucide';
import PatientName from '@/components/PatientName';

const ACCENT = 'var(--accent-primary)';

// ===== Reference Ranges for Auto-Flagging =====
interface ReferenceRange {
  test: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
  criticalLow?: number;
  criticalHigh?: number;
  qualitative?: string[]; // For qualitative tests like Malaria RDT, HIV
  referenceStr: string;
}

const REFERENCE_RANGES: ReferenceRange[] = [
  { test: 'Hemoglobin', unit: 'g/dL', normalMin: 12, normalMax: 17, criticalLow: 7, criticalHigh: 20, referenceStr: '12-17 g/dL' },
  { test: 'WBC', unit: '/μL', normalMin: 4000, normalMax: 11000, criticalLow: 2000, criticalHigh: 30000, referenceStr: '4000-11000 /μL' },
  { test: 'Platelets', unit: '/μL', normalMin: 150000, normalMax: 400000, criticalLow: 50000, referenceStr: '150000-400000 /μL' },
  { test: 'Blood Glucose', unit: 'mg/dL', normalMin: 70, normalMax: 140, criticalLow: 40, criticalHigh: 400, referenceStr: '70-140 mg/dL' },
  { test: 'Creatinine', unit: 'mg/dL', normalMin: 0.6, normalMax: 1.2, criticalHigh: 5, referenceStr: '0.6-1.2 mg/dL' },
  { test: 'Malaria RDT', unit: '', qualitative: ['Positive', 'Negative'], referenceStr: 'Negative' },
  { test: 'HIV', unit: '', qualitative: ['Reactive', 'Non-reactive'], referenceStr: 'Non-reactive' },
];

function getRefRange(testName: string): ReferenceRange | undefined {
  return REFERENCE_RANGES.find(r => testName.toLowerCase().includes(r.test.toLowerCase()));
}

function flagResult(testName: string, value: string): { flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL'; abnormal: boolean; critical: boolean } {
  const ref = getRefRange(testName);
  if (!ref) return { flag: 'NORMAL', abnormal: false, critical: false };

  // Qualitative tests
  if (ref.qualitative) {
    const normalValues = ['Negative', 'Non-reactive'];
    const isNormal = normalValues.some(n => value.toLowerCase() === n.toLowerCase());
    return isNormal
      ? { flag: 'NORMAL', abnormal: false, critical: false }
      : { flag: 'ABNORMAL', abnormal: true, critical: false };
  }

  // Numeric tests
  const num = parseFloat(value);
  if (isNaN(num)) return { flag: 'NORMAL', abnormal: false, critical: false };

  // Check critical first
  if (ref.criticalLow !== undefined && num < ref.criticalLow) return { flag: 'CRITICAL', abnormal: true, critical: true };
  if (ref.criticalHigh !== undefined && num > ref.criticalHigh) return { flag: 'CRITICAL', abnormal: true, critical: true };

  // Check abnormal
  if (ref.normalMin !== undefined && num < ref.normalMin) return { flag: 'ABNORMAL', abnormal: true, critical: false };
  if (ref.normalMax !== undefined && num > ref.normalMax) return { flag: 'ABNORMAL', abnormal: true, critical: false };

  return { flag: 'NORMAL', abnormal: false, critical: false };
}

const FLAG_COLORS = {
  NORMAL: { bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)', border: 'rgba(74,222,128,0.25)' },
  ABNORMAL: { bg: 'rgba(251,191,36,0.12)', color: 'var(--color-warning)', border: 'rgba(251,191,36,0.25)' },
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', border: 'rgba(239,68,68,0.25)' },
};

// ===== Existing Constants =====
// Live activity ticker is a demo flourish only — gated off in production.
const LAB_LIVE_FEED_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const LAB_EVENT_TYPES = [
  { label: 'Specimen Received', color: 'var(--color-brand-400)', icon: Droplets },
  { label: 'Centrifuge Started', color: '#A855F7', icon: Loader2 },
  { label: 'Malaria RDT Completed', color: 'var(--color-success)', icon: Microscope },
  { label: 'Critical Hemoglobin Flagged', color: '#F87171', icon: AlertTriangle },
  { label: 'CBC Analysis Running', color: 'var(--color-brand-500)', icon: Activity },
  { label: 'Urinalysis Complete', color: 'var(--color-warning)', icon: Beaker },
  { label: 'Blood Culture Incubated', color: '#EC4899', icon: Thermometer },
  { label: 'Result Validated', color: 'var(--accent-primary)', icon: CheckCircle2 },
  { label: 'Specimen Rejected - Hemolyzed', color: 'var(--color-danger)', icon: AlertTriangle },
  { label: 'Glucose Result Ready', color: 'var(--color-brand-500)', icon: FlaskConical },
];

interface LiveEvent {
  id: number;
  label: string;
  color: string;
  icon: typeof Activity;
  patient: string;
  time: string;
  isNew: boolean;
}

interface CriticalAlert {
  id: string;
  patientName: string;
  testName: string;
  value: string;
  unit: string;
  orderedBy: string;
  timestamp: string;
  acknowledged: boolean;
}

interface BatchEntry {
  orderId: string;
  patientId: string;
  patientName: string;
  specimen: string;
  resultValue: string;
  flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | '';
}

export default function LabDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { results: allResults, loading, update } = useLabResults();
  // Imaging orders (specimen 'Imaging') belong to the radiology work queue —
  // keep the lab bench focused on specimen-based investigations.
  const results = useMemo(() => allResults.filter(r => !isImagingStudy(r)), [allResults]);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date()), []);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [eventCounter, setEventCounter] = useState(0);
  // Work-queue status filter (shell tabs) + inline search bound to the shell's left rail.
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [queueSearch, setQueueSearch] = useState('');

  // Feature 1: Result Entry Modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [resultSaving, setResultSaving] = useState(false);

  // Feature 2: Critical Alerts
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);

  // Feature 3: Batch Entry
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');
  const [batchTestType, setBatchTestType] = useState('');
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);

  // --- Derived KPIs ---
  const kpis = useMemo(() => {
    const pending = results.filter(r => r.status === 'pending').length;
    const inProgress = results.filter(r => r.status === 'in_progress').length;
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = results.filter(r => r.status === 'completed' && r.completedAt?.startsWith(today)).length;
    const critical = results.filter(r => r.critical).length;
    const abnormal = results.filter(r => r.abnormal).length;
    const completed = results.filter(r => r.status === 'completed' && r.completedAt && r.orderedAt);
    const avgTurnaround = completed.length > 0
      ? Math.round(completed.reduce((sum, r) => sum + (new Date(r.completedAt).getTime() - new Date(r.orderedAt).getTime()) / 3600000, 0) / completed.length)
      : 0;
    const specimens = new Set(results.map(r => r.specimen)).size;
    const unacknowledgedCritical = criticalAlerts.filter(a => !a.acknowledged).length;
    return { pending, inProgress, completedToday, critical, abnormal, avgTurnaround, specimens, total: results.length, unacknowledgedCritical };
  }, [results, criticalAlerts]);

  // Feature 4: TAT Dashboard data
  const tatData = useMemo(() => {
    const completed = results.filter(r => r.status === 'completed' && r.completedAt && r.orderedAt);
    const today = new Date().toISOString().slice(0, 10);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString().slice(0, 10);

    // By test type
    const byTest: Record<string, { totalHrs: number; count: number; todayHrs: number; todayCount: number }> = {};
    completed.forEach(r => {
      const hrs = (new Date(r.completedAt).getTime() - new Date(r.orderedAt).getTime()) / 3600000;
      if (!byTest[r.testName]) byTest[r.testName] = { totalHrs: 0, count: 0, todayHrs: 0, todayCount: 0 };
      if (r.orderedAt >= oneWeekAgo) {
        byTest[r.testName].totalHrs += hrs;
        byTest[r.testName].count += 1;
      }
      if (r.completedAt.startsWith(today)) {
        byTest[r.testName].todayHrs += hrs;
        byTest[r.testName].todayCount += 1;
      }
    });

    const rows = Object.entries(byTest).map(([test, d]) => ({
      test,
      weeklyAvg: d.count > 0 ? d.totalHrs / d.count : 0,
      todayAvg: d.todayCount > 0 ? d.todayHrs / d.todayCount : 0,
      todayCount: d.todayCount,
    })).sort((a, b) => b.todayCount - a.todayCount).slice(0, 8);

    // Overall today average
    const todayCompleted = completed.filter(r => r.completedAt.startsWith(today));
    const overallTodayAvg = todayCompleted.length > 0
      ? todayCompleted.reduce((s, r) => s + (new Date(r.completedAt).getTime() - new Date(r.orderedAt).getTime()) / 3600000, 0) / todayCompleted.length
      : 0;

    const weekCompleted = completed.filter(r => r.orderedAt >= oneWeekAgo);
    const overallWeekAvg = weekCompleted.length > 0
      ? weekCompleted.reduce((s, r) => s + (new Date(r.completedAt).getTime() - new Date(r.orderedAt).getTime()) / 3600000, 0) / weekCompleted.length
      : 0;

    return { rows, overallTodayAvg, overallWeekAvg };
  }, [results]);

  // --- Simulated live events ---
  // Patient name pool is derived from the real lab orders so the live ticker
  // shows actual patients from your facility, not hardcoded sample names.
  const livePatientPool = useMemo(() => {
    const names = results
      .map(r => r.patientName)
      .filter((n): n is string => Boolean(n && n.trim()));
    return names.length > 0 ? Array.from(new Set(names)) : ['New patient'];
  }, [results]);

  const generateEvent = useCallback((): LiveEvent => {
    const evt = LAB_EVENT_TYPES[Math.floor(Math.random() * LAB_EVENT_TYPES.length)];
    const now = new Date();
    return {
      id: Date.now() + Math.random(),
      ...evt,
      patient: livePatientPool[Math.floor(Math.random() * livePatientPool.length)],
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isNew: true,
    };
  }, [livePatientPool]);

  useEffect(() => {
    if (!LAB_LIVE_FEED_ENABLED) return;
    const initial: LiveEvent[] = [];
    for (let i = 0; i < 5; i++) initial.push({ ...generateEvent(), isNew: false, id: i });
    setLiveEvents(initial);

    const interval = setInterval(() => {
      setLiveEvents(prev => [generateEvent(), ...prev.slice(0, 8).map(e => ({ ...e, isNew: false }))]);
      setEventCounter(c => c + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [generateEvent]);

  // Initialize critical alerts from existing results
  useEffect(() => {
    const criticalResults = results.filter(r => r.critical && r.status === 'completed');
    setCriticalAlerts(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newAlerts = criticalResults
        .filter(r => !existingIds.has(r._id))
        .map(r => ({
          id: r._id,
          patientName: r.patientName,
          testName: r.testName,
          value: r.result,
          unit: r.unit,
          orderedBy: r.orderedBy,
          timestamp: r.completedAt || r.updatedAt,
          acknowledged: false,
        }));
      if (newAlerts.length === 0) return prev;
      return [...newAlerts, ...prev];
    });
  }, [results]);

  // --- Categorized results ---
  const allPendingOrders = useMemo(() => results.filter(r => r.status === 'pending' || r.status === 'in_progress'), [results]);
  const recentCompleted = useMemo(() => results.filter(r => r.status === 'completed').slice(0, 6), [results]);

  // Work queue rendered by the shared shell: filtered by the selected status
  // chip and the inline search query. Pending / in-progress orders sort first
  // so the most actionable work is at the top of the list.
  const visibleQueue = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    return results.filter(r => {
      const statusOk = queueFilter === 'all' ? true : r.status === queueFilter;
      if (!statusOk) return false;
      if (!query) return true;
      return (
        (r.patientName || '').toLowerCase().includes(query) ||
        (r.testName || '').toLowerCase().includes(query) ||
        (r.specimen || '').toLowerCase().includes(query) ||
        (r.orderedBy || '').toLowerCase().includes(query)
      );
    }).slice(0, 40);
  }, [results, queueFilter, queueSearch]);
  const specimenCounts = useMemo(() => {
    const map: Record<string, number> = {};
    results.forEach(r => { map[r.specimen] = (map[r.specimen] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [results]);

  // Unique test types for batch mode
  const pendingTestTypes = useMemo(() => {
    const types = new Set(allPendingOrders.map(o => o.testName));
    return Array.from(types).sort();
  }, [allPendingOrders]);

  // Batch mode: populate entries when test type changes
  useEffect(() => {
    if (batchTestType && entryMode === 'batch') {
      const orders = allPendingOrders.filter(o => o.testName === batchTestType);
      setBatchEntries(orders.map(o => ({
        orderId: o._id,
        patientId: o.patientId,
        patientName: o.patientName,
        specimen: o.specimen,
        resultValue: '',
        flag: '',
      })));
    }
  }, [batchTestType, entryMode, allPendingOrders]);

  // Selected order details for modal
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return allPendingOrders.find(o => o._id === selectedOrderId) || null;
  }, [selectedOrderId, allPendingOrders]);

  const currentRefRange = useMemo(() => {
    if (!selectedOrder) return null;
    return getRefRange(selectedOrder.testName);
  }, [selectedOrder]);

  const currentFlag = useMemo(() => {
    if (!selectedOrder || !resultValue) return null;
    return flagResult(selectedOrder.testName, resultValue);
  }, [selectedOrder, resultValue]);

  // --- Handlers ---
  const handleSaveResult = async () => {
    if (!selectedOrder || !resultValue) return;
    setResultSaving(true);
    try {
      const flags = flagResult(selectedOrder.testName, resultValue);
      const ref = getRefRange(selectedOrder.testName);
      await update(selectedOrder._id, {
        status: 'completed' as const,
        result: resultValue,
        unit: ref?.unit || selectedOrder.unit,
        referenceRange: ref?.referenceStr || selectedOrder.referenceRange,
        abnormal: flags.abnormal,
        critical: flags.critical,
        completedAt: new Date().toISOString(),
      });

      // If critical, add alert
      if (flags.critical) {
        setCriticalAlerts(prev => [{
          id: selectedOrder._id,
          patientName: selectedOrder.patientName,
          testName: selectedOrder.testName,
          value: resultValue,
          unit: ref?.unit || selectedOrder.unit,
          orderedBy: selectedOrder.orderedBy,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        }, ...prev]);
      }

      setShowResultModal(false);
      setSelectedOrderId('');
      setResultValue('');
    } catch (err) {
      console.error('Failed to save result:', err);
    } finally {
      setResultSaving(false);
    }
  };

  const handleBatchSave = async () => {
    const filled = batchEntries.filter(e => e.resultValue.trim() !== '');
    if (filled.length === 0) return;
    setBatchSaving(true);
    try {
      const newCriticals: CriticalAlert[] = [];
      for (const entry of filled) {
        const order = allPendingOrders.find(o => o._id === entry.orderId);
        if (!order) continue;
        const flags = flagResult(order.testName, entry.resultValue);
        const ref = getRefRange(order.testName);
        await update(order._id, {
          status: 'completed' as const,
          result: entry.resultValue,
          unit: ref?.unit || order.unit,
          referenceRange: ref?.referenceStr || order.referenceRange,
          abnormal: flags.abnormal,
          critical: flags.critical,
          completedAt: new Date().toISOString(),
        });
        if (flags.critical) {
          newCriticals.push({
            id: order._id,
            patientName: order.patientName,
            testName: order.testName,
            value: entry.resultValue,
            unit: ref?.unit || order.unit,
            orderedBy: order.orderedBy,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          });
        }
      }
      if (newCriticals.length > 0) {
        setCriticalAlerts(prev => [...newCriticals, ...prev]);
      }
      setBatchTestType('');
      setBatchEntries([]);
    } catch (err) {
      console.error('Failed to batch save:', err);
    } finally {
      setBatchSaving(false);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setCriticalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
  };

  // Drop a patient row from the current batch-entry draft before saving. Only
  // removes it from this in-progress batch; the order itself is untouched.
  const handleRemoveBatchEntry = (orderId: string) => {
    setBatchEntries(prev => prev.filter(e => e.orderId !== orderId));
  };

  const handleBatchEntryChange = (orderId: string, value: string) => {
    setBatchEntries(prev => prev.map(e => {
      if (e.orderId !== orderId) return e;
      const order = allPendingOrders.find(o => o._id === orderId);
      const flagRes = order && value ? flagResult(order.testName, value) : null;
      return { ...e, resultValue: value, flag: flagRes ? flagRes.flag : '' };
    }));
  };

  const getTATColor = (hrs: number) => {
    if (hrs < 2) return 'var(--color-success)';
    if (hrs < 4) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getTATLabel = (hrs: number) => {
    if (hrs < 2) return t('lab.tatOnTime');
    if (hrs < 4) return t('lab.tatWarning');
    return t('lab.tatOverdue');
  };

  if (loading) {
    return (
      <main className="page-container page-enter flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
      </main>
    );
  }

  const unackAlerts = criticalAlerts.filter(a => !a.acknowledged);

  // Open the single-entry result modal pre-selected on a specific pending order.
  const openResultForOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setResultValue('');
    setEntryMode('single');
    setShowResultModal(true);
  };

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title={t('lab.laboratory')}
          eyebrow={t('nav.lab')}
          greetingName={currentUser?.name}
          dateLabel={dateLabel}
          tabs={[
            { key: 'all', label: t('lab.viewAll'), count: results.length },
            { key: 'pending', label: t('lab.pending'), count: kpis.pending },
            { key: 'in_progress', label: t('lab.processing'), count: kpis.inProgress },
            { key: 'completed', label: t('lab.completedToday'), count: kpis.completedToday },
          ]}
          activeTab={queueFilter}
          onTabChange={(k) => setQueueFilter(k as typeof queueFilter)}
          searchValue={queueSearch}
          searchPlaceholder={t('topbar.searchPlaceholder')}
          onSearchChange={setQueueSearch}
          filters={[]}
          actions={[
            { label: t('lab.enterResult'), icon: Microscope, onClick: () => setShowResultModal(true), tone: 'primary' },
            { label: t('lab.batchEntry'), icon: Table, onClick: () => { setEntryMode('batch'); setShowResultModal(true); } },
            { label: t('lab.message'), icon: MessageSquare, onClick: () => router.push('/messages') },
          ]}
          actionStrip={[
            { label: t('nav.patients'), icon: Users, onClick: () => router.push('/patients') },
            { label: t('lab.acceptOrder'), icon: FileText, onClick: () => router.push('/lab') },
            { label: t('nav.reports'), icon: BarChart3, onClick: () => router.push('/reports') },
            { label: t('lab.message'), icon: MessageSquare, onClick: () => router.push('/messages') },
          ]}
          rows={visibleQueue.map((order): EhrCareDashboardRow => {
            const time = order.status === 'completed'
              ? (order.completedAt ? new Date(order.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined)
              : (order.orderedAt ? new Date(order.orderedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined);
            const isOpen = order.status === 'pending' || order.status === 'in_progress';
            return {
              id: order._id,
              title: order.patientName,
              subtitle: `${order.testName} · ${order.specimen}`,
              meta: order.orderedBy ? t('lab.orderedBy', { name: order.orderedBy }) : undefined,
              compactMeta: time,
              time,
              status: order.critical ? t('lab.critical') : order.status === 'in_progress' ? t('lab.processing') : order.status === 'completed' ? t('lab.completedToday') : t('lab.pending'),
              statusTone: order.critical ? 'danger' : order.abnormal ? 'warning' : order.status === 'completed' ? 'done' : order.status === 'in_progress' ? 'active' : 'scheduled',
              priority: order.critical ? t('lab.critical') : undefined,
              actionLabel: isOpen ? t('lab.enterResult') : undefined,
              onAction: isOpen ? () => openResultForOrder(order._id) : undefined,
            };
          })}
          metrics={[
            { label: t('lab.pending'), value: kpis.pending },
            { label: t('lab.processing'), value: kpis.inProgress },
            { label: t('lab.completedToday'), value: kpis.completedToday },
            { label: t('lab.abnormalBadge'), value: kpis.abnormal, tone: 'warning' },
            { label: t('lab.critical'), value: kpis.critical, tone: 'danger' },
          ]}
          metricsTitle={t('lab.laboratory')}
          checklist={[
            { label: t('lab.enterResult'), done: kpis.pending === 0, onClick: () => setShowResultModal(true) },
            { label: t('lab.batchEntry'), done: kpis.inProgress === 0, onClick: () => { setEntryMode('batch'); setShowResultModal(true); } },
            { label: t('lab.criticalResult'), done: kpis.unacknowledgedCritical === 0, onClick: () => setQueueFilter('completed') },
          ]}
          checklistTitle={t('lab.quickActions')}
          missionTitle={t('lab.laboratory')}
          missionDescription={t('lab.ordersQueue')}
          emptyTitle={t('lab.noPendingOrders')}
        >
          <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>

        {/* --- Feature 2: Critical Result Alert Banner --- */}
        {unackAlerts.length > 0 && (
          <div className="space-y-2">
            {unackAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{
                background: 'rgba(239,68,68,0.08)',
                border: '2px solid rgba(239,68,68,0.35)',
                boxShadow: '0 0 12px rgba(239,68,68,0.15)',
              }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'transparent' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)' }}>{t('lab.criticalResult')}</span>
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {alert.patientName} &mdash; {alert.testName}: <span style={{ color: 'var(--color-danger)' }}>{alert.value} {alert.unit}</span>
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {t('lab.orderedBy', { name: alert.orderedBy })} &middot; {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <BellOff className="w-3 h-3" />
                  {t('lab.acknowledge')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* --- Specimen Pipeline + Live Feed --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Specimen Pipeline - 1 column */}
          <div className="dash-card rounded-2xl overflow-hidden">
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4" style={{ color: '#EC4899' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.specimenPipeline')}</span>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {specimenCounts.length > 0 ? specimenCounts.map(([specimen, count]) => {
                const pct = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0;
                return (
                  <div key={specimen} className="p-2.5 rounded-xl transition-all" style={{
                    background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
                  }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{specimen}</span>
                      <span className="text-[10px] font-bold" style={{ color: ACCENT }}>{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${pct}%`, background: ACCENT,
                      }} />
                    </div>
                    <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('lab.percentOfTotal', { pct })}</p>
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Droplets className="w-6 h-6 mb-1" style={{ color: 'var(--text-muted)', opacity: 0.15 }} />
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('lab.noSpecimenData')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Feed + Quick Actions - 1 column */}
          <div className="space-y-4 flex flex-col">
            {/* Live Feed */}
            <div className="dash-card rounded-2xl overflow-hidden flex-1 flex flex-col" style={{ maxHeight: '260px' }}>
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.liveFeed')}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t('lab.eventsCount', { count: eventCounter })}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {liveEvents.map(evt => {
                  const Icon = evt.icon;
                  return (
                    <div key={evt.id} className="p-2 rounded-lg transition-all" style={{
                      background: evt.isNew ? `${evt.color}08` : 'transparent',
                      border: evt.isNew ? `1px solid ${evt.color}20` : '1px solid transparent',
                      animation: evt.isNew ? 'fadeIn 0.3s ease-out' : undefined,
                    }}>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'transparent' }}>
                          <Icon className="w-2.5 h-2.5" style={{ color: evt.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold truncate" style={{ color: evt.color }}>{evt.label}</span>
                            {evt.isNew && (
                              <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: `${evt.color}20`, color: evt.color }}>{t('lab.new')}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{evt.patient}</span>
                            <span className="text-[9px] font-mono flex-shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>{evt.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* --- Bottom: Recent Completed Results --- */}
        <div className="dash-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.recentCompletedResults')}</span>
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t('lab.resultsCount', { count: recentCompleted.length })}</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recentCompleted.length > 0 ? recentCompleted.map(r => (
                <div key={r._id} className="p-3 rounded-xl transition-all cursor-pointer" style={{
                  background: 'var(--overlay-subtle)',
                  border: `1px solid ${r.critical ? 'rgba(239,68,68,0.25)' : r.abnormal ? 'rgba(251,146,60,0.25)' : 'var(--border-light)'}`,
                }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.testName}</span>
                    {r.critical ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>{t('lab.critical')}</span>
                    ) : r.abnormal ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(251,146,60,0.12)', color: '#FB923C' }}>{t('lab.abnormalBadge')}</span>
                    ) : (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--color-success)' }}>{t('lab.normalBadge')}</span>
                    )}
                  </div>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{r.patientName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold stat-value" style={{
                      color: r.critical ? 'var(--color-danger)' : r.abnormal ? '#FB923C' : ACCENT,
                    }}>{r.result} {r.unit}</span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{r.referenceRange}</span>
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{r.specimen} &middot; {r.completedAt ? new Date(r.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              )) : (
                <div className="col-span-2 sm:col-span-3 flex flex-col items-center justify-center py-8 text-center">
                  <Microscope className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)', opacity: 0.15 }} />
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('lab.noCompletedResults')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Feature 4: TAT (Turnaround Time) Dashboard --- */}
        <div className="dash-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4" style={{ color: 'var(--color-brand-500)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.tatDashboard')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>&lt;2h</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>2-4h</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-danger)' }} />
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>&gt;4h</span>
              </div>
            </div>
          </div>
          <div className="p-3">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('lab.todayAvgTat')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: getTATColor(tatData.overallTodayAvg) }}>
                    {tatData.overallTodayAvg > 0 ? tatData.overallTodayAvg.toFixed(1) : '--'}h
                  </span>
                  {tatData.overallTodayAvg > 0 && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: `${getTATColor(tatData.overallTodayAvg)}15`,
                      color: getTATColor(tatData.overallTodayAvg),
                    }}>{getTATLabel(tatData.overallTodayAvg)}</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('lab.weeklyAvgTat')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: getTATColor(tatData.overallWeekAvg) }}>
                    {tatData.overallWeekAvg > 0 ? tatData.overallWeekAvg.toFixed(1) : '--'}h
                  </span>
                  {tatData.overallWeekAvg > 0 && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: `${getTATColor(tatData.overallWeekAvg)}15`,
                      color: getTATColor(tatData.overallWeekAvg),
                    }}>{getTATLabel(tatData.overallWeekAvg)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* TAT by test type - bar chart style */}
            {tatData.rows.length > 0 ? (
              <div className="space-y-2">
                {tatData.rows.map(row => {
                  const maxHrs = 8;
                  const todayPct = Math.min((row.todayAvg / maxHrs) * 100, 100);
                  const weekPct = Math.min((row.weeklyAvg / maxHrs) * 100, 100);
                  return (
                    <div key={row.test} className="p-2.5 rounded-xl" style={{
                      background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
                    }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{row.test}</span>
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t('lab.countToday', { count: row.todayCount })}</span>
                      </div>
                      {/* Today bar */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] w-12 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('lab.today')}</span>
                        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${todayPct}%`,
                            background: getTATColor(row.todayAvg),
                          }} />
                        </div>
                        <span className="text-[10px] font-bold w-10 text-right flex-shrink-0" style={{ color: getTATColor(row.todayAvg) }}>
                          {row.todayAvg > 0 ? row.todayAvg.toFixed(1) : '--'}h
                        </span>
                      </div>
                      {/* Weekly bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] w-12 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('lab.week')}</span>
                        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${weekPct}%`,
                            background: getTATColor(row.weeklyAvg),
                            opacity: 0.6,
                          }} />
                        </div>
                        <span className="text-[10px] font-bold w-10 text-right flex-shrink-0" style={{ color: getTATColor(row.weeklyAvg) }}>
                          {row.weeklyAvg > 0 ? row.weeklyAvg.toFixed(1) : '--'}h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)', opacity: 0.15 }} />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('lab.noTurnaroundData')}</p>
              </div>
            )}
          </div>
        </div>

          </div>
        </EhrCareDashboard>
      </main>

      {/* ===== Feature 1 & 3: Result Entry Modal (Single + Batch) ===== */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="dash-card w-full max-w-2xl mx-4 rounded-2xl overflow-hidden" style={{
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Microscope className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.enterLabResult')}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Mode tabs */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => { setEntryMode('single'); setBatchTestType(''); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-all"
                    style={{
                      background: entryMode === 'single' ? ACCENT : 'transparent',
                      color: entryMode === 'single' ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    <List className="w-3 h-3" />
                    {t('lab.single')}
                  </button>
                  <button
                    onClick={() => { setEntryMode('batch'); setSelectedOrderId(''); setResultValue(''); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-all"
                    style={{
                      background: entryMode === 'batch' ? ACCENT : 'transparent',
                      color: entryMode === 'batch' ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    <Table className="w-3 h-3" />
                    {t('lab.batch')}
                  </button>
                </div>
                <button onClick={() => { setShowResultModal(false); setEntryMode('single'); setSelectedOrderId(''); setResultValue(''); setBatchTestType(''); }} className="p-1 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {entryMode === 'single' ? (
                /* ===== Single Entry Mode ===== */
                <div className="space-y-4">
                  {/* Order Selection */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                      {t('lab.selectPendingOrder')}
                    </label>
                    <select
                      value={selectedOrderId}
                      onChange={e => { setSelectedOrderId(e.target.value); setResultValue(''); }}
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none transition-all"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">{t('lab.selectAnOrder')}</option>
                      {allPendingOrders.map(o => (
                        <option key={o._id} value={o._id}>
                          {o.testName} - {o.patientName} ({o.specimen})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedOrder && (
                    <>
                      {/* Order Details */}
                      <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.patient')}</p>
                            <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{selectedOrder.patientName}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.testName')}</p>
                            <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{selectedOrder.testName}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.specimen')}</p>
                            <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{selectedOrder.specimen}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.orderedByLabel')}</p>
                            <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{selectedOrder.orderedBy}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reference Range Display */}
                      {currentRefRange && (
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(33, 145, 208, 0.06)', border: '1px solid var(--accent-border)' }}>
                          <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>{t('lab.referenceRange')}</p>
                          <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            {currentRefRange.referenceStr}
                          </p>
                          {currentRefRange.qualitative && (
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                              {t('lab.expectedValues', { values: currentRefRange.qualitative.join(', ') })}
                            </p>
                          )}
                          {currentRefRange.criticalLow !== undefined && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-danger)' }}>
                              {t('lab.criticalLabel')}: {currentRefRange.criticalLow !== undefined ? `<${currentRefRange.criticalLow}` : ''}{currentRefRange.criticalLow !== undefined && currentRefRange.criticalHigh !== undefined ? ' or ' : ''}{currentRefRange.criticalHigh !== undefined ? `>${currentRefRange.criticalHigh}` : ''}
                            </p>
                          )}
                          {currentRefRange.criticalLow === undefined && currentRefRange.criticalHigh !== undefined && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-danger)' }}>
                              {t('lab.criticalLabel')}: &gt;{currentRefRange.criticalHigh}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Result Input */}
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          {t('lab.resultValue')}
                        </label>
                        {currentRefRange?.qualitative ? (
                          <select
                            value={resultValue}
                            onChange={e => setResultValue(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-[12px] outline-none transition-all"
                            style={{
                              background: 'var(--overlay-subtle)',
                              border: '1px solid var(--border-light)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <option value="">{t('lab.selectResult')}</option>
                            {currentRefRange.qualitative.map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              value={resultValue}
                              onChange={e => setResultValue(e.target.value)}
                              placeholder={t('lab.enterValue')}
                              className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none transition-all"
                              style={{
                                background: 'var(--overlay-subtle)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {currentRefRange && (
                              <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {currentRefRange.unit}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Auto-Flag Indicator */}
                      {currentFlag && resultValue && (
                        <div className="p-3 rounded-xl flex items-center gap-3" style={{
                          background: FLAG_COLORS[currentFlag.flag].bg,
                          border: `1px solid ${FLAG_COLORS[currentFlag.flag].border}`,
                        }}>
                          {currentFlag.flag === 'CRITICAL' && <AlertTriangle className="w-5 h-5" style={{ color: FLAG_COLORS[currentFlag.flag].color }} />}
                          {currentFlag.flag === 'ABNORMAL' && <AlertTriangle className="w-5 h-5" style={{ color: FLAG_COLORS[currentFlag.flag].color }} />}
                          {currentFlag.flag === 'NORMAL' && <CheckCircle2 className="w-5 h-5" style={{ color: FLAG_COLORS[currentFlag.flag].color }} />}
                          <div>
                            <span className="text-[11px] font-bold" style={{ color: FLAG_COLORS[currentFlag.flag].color }}>
                              {currentFlag.flag}
                            </span>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {currentFlag.flag === 'CRITICAL' ? t('lab.flagCriticalMsg') :
                                currentFlag.flag === 'ABNORMAL' ? t('lab.flagAbnormalMsg') :
                                  t('lab.flagNormalMsg')}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ===== Batch Entry Mode ===== */
                <div className="space-y-4">
                  {/* Test Type Selection */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                      {t('lab.selectTestType')}
                    </label>
                    <select
                      value={batchTestType}
                      onChange={e => setBatchTestType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none transition-all"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">{t('lab.selectTestTypeOption')}</option>
                      {pendingTestTypes.map(tt => {
                        const count = allPendingOrders.filter(o => o.testName === tt).length;
                        return (
                          <option key={tt} value={tt}>{t('lab.testTypePending', { test: tt, count })}</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Reference range for selected test */}
                  {batchTestType && (() => {
                    const ref = getRefRange(batchTestType);
                    return ref ? (
                      <div className="p-2.5 rounded-xl" style={{ background: 'rgba(33, 145, 208, 0.06)', border: '1px solid var(--accent-border)' }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                          {t('lab.reference')}: {ref.referenceStr}
                          {ref.criticalLow !== undefined && ` | ${t('lab.criticalLabel')}: <${ref.criticalLow}`}
                          {ref.criticalHigh !== undefined && ` | ${t('lab.criticalLabel')}: >${ref.criticalHigh}`}
                        </p>
                      </div>
                    ) : null;
                  })()}

                  {/* Batch Table */}
                  {batchEntries.length > 0 ? (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
                      <div className="overflow-x-auto">
                      <table className="w-full" style={{ minWidth: 520 }}>
                        <thead>
                          <tr style={{ background: 'var(--overlay-subtle)' }}>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.patient')}</th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.specimen')}</th>
                            <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.result')}</th>
                            <th className="text-center px-3 py-2 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('lab.flag')}</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchEntries.map((entry) => {
                            const ref = getRefRange(batchTestType);
                            return (
                              <tr key={entry.orderId} style={{ borderTop: '1px solid var(--border-light)' }}>
                                <td className="px-3 py-2">
                                  <PatientName patientId={entry.patientId} name={entry.patientName} size={24} nameClassName="text-[11px] font-medium" />
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.specimen}</span>
                                </td>
                                <td className="px-3 py-2">
                                  {ref?.qualitative ? (
                                    <select
                                      value={entry.resultValue}
                                      onChange={e => handleBatchEntryChange(entry.orderId, e.target.value)}
                                      className="w-full px-2 py-1 rounded-lg text-[11px] outline-none"
                                      style={{
                                        background: 'var(--overlay-subtle)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      <option value="">--</option>
                                      {ref.qualitative.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="number"
                                      step="any"
                                      value={entry.resultValue}
                                      onChange={e => handleBatchEntryChange(entry.orderId, e.target.value)}
                                      placeholder={t('lab.valuePlaceholder')}
                                      className="w-full px-2 py-1 rounded-lg text-[11px] outline-none"
                                      style={{
                                        background: 'var(--overlay-subtle)',
                                        border: '1px solid var(--border-light)',
                                        color: 'var(--text-primary)',
                                      }}
                                    />
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {entry.flag ? (
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                                      background: FLAG_COLORS[entry.flag as keyof typeof FLAG_COLORS].bg,
                                      color: FLAG_COLORS[entry.flag as keyof typeof FLAG_COLORS].color,
                                    }}>{entry.flag}</span>
                                  ) : (
                                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>--</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleRemoveBatchEntry(entry.orderId)}
                                    title={t('action.remove')}
                                    aria-label={t('action.remove')}
                                    className="p-1 rounded-md transition-all hover:opacity-80"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ) : batchTestType ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Table className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)', opacity: 0.15 }} />
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('lab.noPendingForType')}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <button
                onClick={() => { setShowResultModal(false); setEntryMode('single'); setSelectedOrderId(''); setResultValue(''); setBatchTestType(''); }}
                className="px-4 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
              >
                {t('action.cancel')}
              </button>

              {entryMode === 'single' ? (
                <button
                  onClick={handleSaveResult}
                  disabled={!selectedOrder || !resultValue || resultSaving}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: selectedOrder && resultValue ? ACCENT : 'var(--border-light)',
                    color: selectedOrder && resultValue ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {resultSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t('lab.saveResult')}
                </button>
              ) : (
                <button
                  onClick={handleBatchSave}
                  disabled={batchEntries.filter(e => e.resultValue.trim() !== '').length === 0 || batchSaving}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: batchEntries.some(e => e.resultValue.trim()) ? ACCENT : 'var(--border-light)',
                    color: batchEntries.some(e => e.resultValue.trim()) ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {batchSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t('lab.saveAll', { count: batchEntries.filter(e => e.resultValue.trim() !== '').length })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
