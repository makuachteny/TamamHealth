'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { isImagingStudy } from '@/lib/clinical-flow/lab-catalog';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import Modal from '@/components/Modal';
import ChartCard, { tooltipStyle, axisTick } from '@/components/ChartCard';
import EmptyState from '@/components/EmptyState';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import type { LabResultDoc } from '@/lib/db-types';
import {
  CheckCircle2, AlertTriangle,
  Microscope,
  Loader2,
  X, Save, Table, List, BellOff, TrendingUp,
} from '@/components/icons/lucide';
import PatientName from '@/components/PatientName';

const ACCENT = 'var(--accent-primary)';

// ===== Lab Performance Analytics (turnaround-time + volume charts) =====
// Target order→result turnaround time. 24h is the standard routine-lab TAT
// benchmark (same order of magnitude as the routine result-review SLA used
// elsewhere in lab-service.ts) and gives a legible reference line without
// hardcoding per-test SLAs we don't otherwise track.
const LAB_TAT_TARGET_HOURS = 24;

const VOLUME_SERIES_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)',
  'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)',
];

// Collapses near-duplicate test names (e.g. "Blood Glucose (Fasting)" /
// "Blood Glucose (Random)") into one category for the grouped charts below.
function normalizeTestCategory(testName: string): string {
  const stripped = (testName || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || testName || 'Unknown';
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Monday-start week bucket for a given ISO date string.
function weekStartOf(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function dayKeyOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Turnaround time in hours from order to result, computed from `updatedAt`
// (guaranteed ISO everywhere lab-service.ts writes it — see updateLabResult /
// advanceLabOrder) rather than `completedAt`, which some code paths write via
// toLocaleString() and is therefore not reliably parseable.
function tatHours(r: LabResultDoc): number | null {
  if (r.status !== 'completed' || !r.orderedAt || !r.updatedAt) return null;
  const ordered = new Date(r.orderedAt).getTime();
  const updated = new Date(r.updatedAt).getTime();
  if (!Number.isFinite(ordered) || !Number.isFinite(updated)) return null;
  const hours = (updated - ordered) / 3_600_000;
  return hours >= 0 ? hours : null;
}

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

function labStatusLabel(status: 'pending' | 'in_progress' | 'completed'): string {
  if (status === 'completed') return 'Complete';
  if (status === 'in_progress') return 'Processing';
  return 'Pending';
}

type CompletedDiseaseRow = {
  id: string;
  lab: LabResultDoc;
  disease: string;
  detail: string;
  severity: 'normal' | 'abnormal' | 'critical';
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function diseasesForCompletedLab(lab: LabResultDoc): Omit<CompletedDiseaseRow, 'id' | 'lab'>[] {
  if (lab.status !== 'completed') return [];
  const text = `${lab.testName} ${lab.result} ${lab.clinicalNotes || ''}`.toLowerCase();
  const result = (lab.result || '').toLowerCase();
  const diseases: string[] = [];

  if (/malaria|p\.?\s*falciparum|plasmodium/.test(text) && /positive|detected|falciparum/.test(result)) diseases.push('Malaria');
  if (/\bhiv\b|aids/.test(text) && /positive|reactive|detected/.test(result) && !/non[-\s]?reactive|negative/.test(result)) diseases.push('HIV Disease');
  if (/sputum|afb|tuberculosis|\btb\b/.test(text) && /positive|detected|acid-fast/.test(result)) diseases.push('Tuberculosis');
  if (/glucose|diabetes|hba1c/.test(text) && lab.abnormal) diseases.push('Diabetes Mellitus');
  if (/hemoglobin|haemoglobin|\bhb\b|full blood count|cbc|fbc/.test(text) && /hb\s*[0-9]|hemoglobin|haemoglobin/.test(text) && lab.abnormal) diseases.push('Anaemia');
  if (/wbc|white blood|leucocyt|leukocyt|full blood count|cbc|fbc/.test(text) && /wbc|leucocyt|leukocyt/.test(text) && lab.abnormal) diseases.push('Infection / Leukocytosis');
  if (/creatinine|bun|renal|kidney/.test(text) && lab.abnormal) diseases.push('Renal Impairment');
  if (/urinalysis|urine|leucocytes|leukocytes|nitrite/.test(text) && /leucocytes|leukocytes|nitrite|bacteria/.test(text) && lab.abnormal) diseases.push('Urinary Tract Infection');
  if (/protein/.test(text) && /urine|urinalysis|proteinuria/.test(text) && lab.abnormal) diseases.push('Proteinuria');
  if (/liver|alt|ast|bilirubin|hepatitis/.test(text) && lab.abnormal) diseases.push('Liver Disease');

  return unique(diseases.length > 0 ? diseases : (lab.abnormal || lab.critical ? [`${lab.testName} Abnormality`] : []))
    .map(disease => ({
      disease,
      detail: `${lab.testName}${lab.result ? `: ${lab.result}` : ''}`,
      severity: lab.critical ? 'critical' : lab.abnormal ? 'abnormal' : 'normal',
    }));
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
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { results: allResults, loading, update } = useLabResults();
  // Imaging orders (specimen 'Imaging') belong to the radiology work queue —
  // keep the lab bench focused on specimen-based investigations.
  const results = useMemo(() => allResults.filter(r => !isImagingStudy(r)), [allResults]);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date()), []);
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
    const completed = results.filter(r => r.status === 'completed').length;
    const critical = results.filter(r => r.critical).length;
    const abnormal = results.filter(r => r.abnormal).length;
    const completedWithTimes = results.filter(r => r.status === 'completed' && r.completedAt && r.orderedAt);
    const avgTurnaround = completedWithTimes.length > 0
      ? Math.round(completedWithTimes.reduce((sum, r) => sum + (new Date(r.completedAt).getTime() - new Date(r.orderedAt).getTime()) / 3600000, 0) / completedWithTimes.length)
      : 0;
    const specimens = new Set(results.map(r => r.specimen)).size;
    const unacknowledgedCritical = criticalAlerts.filter(a => !a.acknowledged).length;
    return { pending, inProgress, completed, critical, abnormal, avgTurnaround, specimens, total: results.length, unacknowledgedCritical };
  }, [results, criticalAlerts]);

  // --- Lab Performance Analytics: chart data (real data only, see tatHours) ---

  // (a) Median TAT per week, across whatever completed-result history exists.
  const weeklyTatData = useMemo(() => {
    const buckets = new Map<string, { label: string; sortKey: number; hours: number[] }>();
    for (const r of results) {
      const hours = tatHours(r);
      if (hours === null) continue;
      const weekStart = weekStartOf(r.updatedAt);
      if (!weekStart) continue;
      const key = weekStart.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, {
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sortKey: weekStart.getTime(),
          hours: [],
        });
      }
      buckets.get(key)!.hours.push(hours);
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(b => ({ label: b.label, medianHours: Math.round(medianOf(b.hours) * 10) / 10 }));
  }, [results]);

  // (b) % of this month's completed results within the target TAT, by test type.
  const testTypeTargetData = useMemo(() => {
    const now = new Date();
    const buckets = new Map<string, { total: number; withinTarget: number }>();
    for (const r of results) {
      const hours = tatHours(r);
      if (hours === null) continue;
      const updated = new Date(r.updatedAt);
      if (updated.getFullYear() !== now.getFullYear() || updated.getMonth() !== now.getMonth()) continue;
      const category = normalizeTestCategory(r.testName);
      if (!buckets.has(category)) buckets.set(category, { total: 0, withinTarget: 0 });
      const b = buckets.get(category)!;
      b.total += 1;
      if (hours <= LAB_TAT_TARGET_HOURS) b.withinTarget += 1;
    }
    return Array.from(buckets.entries())
      .map(([testName, b]) => ({ testName, pct: Math.round((b.withinTarget / b.total) * 100), total: b.total }))
      .sort((a, b) => b.total - a.total);
  }, [results]);

  // (c) Test volume by type, stacked per day, for the most recent days present in the data.
  const volumeByDay = useMemo(() => {
    const dayKeys = Array.from(new Set(
      results.map(r => dayKeyOf(r.orderedAt)).filter((k): k is string => k !== null),
    )).sort();
    const recentDays = dayKeys.slice(-14);
    const recentDaySet = new Set(recentDays);

    const inWindow = results.filter(r => {
      const k = dayKeyOf(r.orderedAt);
      return k !== null && recentDaySet.has(k);
    });

    // Top 5 test categories by volume in this window; everything else -> "Other".
    const volumeByCategory = new Map<string, number>();
    for (const r of inWindow) {
      const cat = normalizeTestCategory(r.testName);
      volumeByCategory.set(cat, (volumeByCategory.get(cat) || 0) + 1);
    }
    const topCategories = Array.from(volumeByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    const hasOther = volumeByCategory.size > topCategories.length;
    const seriesKeys = hasOther ? [...topCategories, 'Other'] : topCategories;

    const rows = recentDays.map(dayKey => {
      const row: Record<string, string | number> = {
        label: new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      for (const key of seriesKeys) row[key] = 0;
      return row;
    });
    const rowIndexByDay = new Map(recentDays.map((d, i) => [d, i]));
    for (const r of inWindow) {
      const dayKey = dayKeyOf(r.orderedAt);
      if (dayKey === null) continue;
      const idx = rowIndexByDay.get(dayKey);
      if (idx === undefined) continue;
      const cat = normalizeTestCategory(r.testName);
      const seriesKey = topCategories.includes(cat) ? cat : 'Other';
      rows[idx][seriesKey] = (Number(rows[idx][seriesKey]) || 0) + 1;
    }
    return { rows, seriesKeys };
  }, [results]);

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
  const completedDiseaseRows = useMemo<CompletedDiseaseRow[]>(() => {
    return results
      .flatMap(lab => diseasesForCompletedLab(lab).map((disease, index) => ({
        ...disease,
        id: `${lab._id}-${index}`,
        lab,
      })))
      .sort((a, b) => a.disease.localeCompare(b.disease) || a.lab.patientName.localeCompare(b.lab.patientName));
  }, [results]);

  // Work queue rendered by the shared shell: filtered by the selected status
  // chip and the inline search query. Pending / in-progress orders sort first
  // so the most actionable work is at the top of the list.
  const visibleQueue = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    if (queueFilter === 'completed') {
      return results.filter(r => r.status === 'completed' && (
        !query ||
        (r.patientName || '').toLowerCase().includes(query) ||
        (r.testName || '').toLowerCase().includes(query) ||
        (r.result || '').toLowerCase().includes(query) ||
        (r.clinicalNotes || '').toLowerCase().includes(query)
      )).slice(0, 40);
    }
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
  const visibleCompletedDiseaseRows = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    return completedDiseaseRows.filter(row => {
      if (!query) return true;
      return (
        row.disease.toLowerCase().includes(query) ||
        row.lab.patientName.toLowerCase().includes(query) ||
        row.lab.testName.toLowerCase().includes(query) ||
        row.detail.toLowerCase().includes(query)
      );
    }).slice(0, 40);
  }, [completedDiseaseRows, queueSearch]);
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

  const startProcessingOrder = async (orderId: string) => {
    await update(orderId, { status: 'in_progress' as const });
  };

  const renderLabWorkflowPopup = (order: typeof visibleQueue[number]) => {
    const isPending = order.status === 'pending';
    const isProcessing = order.status === 'in_progress';
    const isComplete = order.status === 'completed';
    const steps = [
      { label: 'Test Ordered', note: order.orderedBy ? t('lab.orderedBy', { name: order.orderedBy }) : order.testName, done: true },
      { label: 'Specimen Received And Accessioned', note: `${order.specimen} specimen`, done: true, current: isPending },
      { label: 'Analysis In Progress', note: 'Run the test and record instrument/manual findings.', done: isProcessing || isComplete, current: isProcessing },
      { label: 'Result Entered And Quality Checked', note: order.result || 'Waiting for result entry and reference-range check.', done: isComplete },
      { label: order.critical ? 'Critical Result Communicated' : 'Result Reported To Clinician', note: isComplete ? 'Result available for interpretation and care decisions.' : 'Pending reporting.', done: isComplete },
      { label: 'Complete', note: isComplete ? 'Lab order closed.' : 'Close after reporting.', done: isComplete },
    ];

    return (
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Test</span><strong>{order.testName}</strong></div>
            <div><span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Specimen</span><strong>{order.specimen}</strong></div>
            <div><span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</span><strong>{labStatusLabel(order.status)}</strong></div>
            <div><span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Result</span><strong>{order.result || 'Not entered'}</strong></div>
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-start gap-3 rounded-xl p-3" style={{
              background: step.current ? 'var(--bg-card)' : 'var(--overlay-subtle)',
              border: `1px solid ${step.current ? 'var(--accent-primary)' : 'var(--border-light)'}`,
            }}>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{
                background: step.done ? 'var(--color-success)' : step.current ? 'var(--accent-primary)' : 'var(--overlay-medium)',
                color: step.done || step.current ? '#fff' : 'var(--text-muted)',
              }}>
                {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.note}</p>
              </div>
            </div>
          ))}
        </div>
        {isPending && (
          <button type="button" className="btn btn-primary w-full" onClick={() => startProcessingOrder(order._id)}>
            Accept specimen
          </button>
        )}
        {(isPending || isProcessing) && (
          <button type="button" className="btn btn-primary w-full" onClick={() => openResultForOrder(order._id)}>
            {t('lab.enterResult')}
          </button>
        )}
      </div>
    );
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
            { key: 'pending', label: 'Pending', count: kpis.pending },
            { key: 'in_progress', label: 'Processing', count: kpis.inProgress },
            { key: 'completed', label: 'Complete', count: completedDiseaseRows.length },
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
          ]}
          // Critical/abnormal results still count as "resulted" for the day chart —
          // statusTone flags severity, not completion, so chartSeries is set
          // explicitly from order.status rather than relying on the done→series1
          // default (which would otherwise misfile a flagged result as "awaiting").
          chartSeriesNames={['Awaiting', 'Resulted']}
          rows={queueFilter === 'completed' ? visibleCompletedDiseaseRows.map((row): EhrCareDashboardRow => {
            const lab = row.lab;
            const time = lab.completedAt ? new Date(lab.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined;
            return {
              id: row.id,
              title: row.disease,
              subtitle: `${lab.patientName} · ${row.detail}`,
              meta: `${lab.hospitalNumber || ''}${lab.orderedBy ? ` · ${t('lab.orderedBy', { name: lab.orderedBy })}` : ''}`.replace(/^ · /, ''),
              careTeam: lab.orderedBy,
              careTeamLabel: 'Ordered by',
              compactMeta: time,
              time,
              timeSecondary: lab.completedAt ? lab.completedAt.slice(0, 10) : 'Resulted',
              status: 'completed',
              statusLabel: 'Complete',
              statusSecondary: row.severity === 'critical' ? 'Critical' : row.severity === 'abnormal' ? 'Abnormal' : 'Normal',
              statusTone: row.severity === 'critical' ? 'danger' : row.severity === 'abnormal' ? 'warning' : 'done',
              location: lab.specimen || lab.testName || row.disease,
              locationSecondary: 'Specimen',
              chartSeries: 1,
              // A critical result is a true acuity — same RED pill the rest
              // of the app uses for "needs attention now", not free text.
              priority: row.severity === 'critical' ? 'RED' : undefined,
              popupDetail: renderLabWorkflowPopup(lab),
            };
          }) : visibleQueue.map((order): EhrCareDashboardRow => {
            const time = order.status === 'completed'
              ? (order.completedAt ? new Date(order.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined)
              : (order.orderedAt ? new Date(order.orderedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined);
            return {
              id: order._id,
              title: order.patientName,
              subtitle: `${order.testName} · ${order.specimen}`,
              meta: order.orderedBy ? t('lab.orderedBy', { name: order.orderedBy }) : undefined,
              careTeam: order.orderedBy,
              careTeamLabel: 'Ordered by',
              compactMeta: time,
              time,
              timeSecondary: order.status === 'completed'
                ? (order.completedAt ? order.completedAt.slice(0, 10) : 'Completed')
                : (order.orderedAt ? order.orderedAt.slice(0, 10) : 'Ordered'),
              status: order.status,
              statusLabel: labStatusLabel(order.status),
              statusSecondary: order.critical ? 'Critical' : order.abnormal ? 'Abnormal' : order.specimen,
              statusTone: order.critical ? 'danger' : order.abnormal ? 'warning' : order.status === 'completed' ? 'done' : order.status === 'in_progress' ? 'active' : 'scheduled',
              location: order.specimen,
              locationSecondary: order.testName,
              chartSeries: order.status === 'completed' ? 1 : 0,
              // A critical result is a true acuity — same RED pill the rest
              // of the app uses for "needs attention now", not free text.
              priority: order.critical ? 'RED' : undefined,
              popupDetail: renderLabWorkflowPopup(order),
            };
          })}
          metrics={[
            { label: t('lab.abnormalBadge'), value: completedDiseaseRows.filter(row => row.severity === 'abnormal').length, tone: 'warning' },
            { label: t('lab.critical'), value: completedDiseaseRows.filter(row => row.severity === 'critical').length, tone: 'danger' },
            { label: t('lab.criticalResult'), value: kpis.unacknowledgedCritical, tone: kpis.unacknowledgedCritical > 0 ? 'danger' : 'neutral', onClick: () => setQueueFilter('completed') },
          ]}
          metricsTitle={t('lab.laboratory')}
          emptyTitle={t('lab.noPendingOrders')}
        >
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

        {/* --- Lab Performance Analytics --- */}
        <div className="dash-card" style={{ padding: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-platform)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', letterSpacing: -0.2, marginBottom: 12 }}>
            Lab Performance Analytics
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Median Turnaround Time" subtitle="Order to result, by week" chartTypes={['line']} periods={[]}>
              {() => (
                weeklyTatData.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmptyState icon={TrendingUp} title="No data yet" message="No completed results with a turnaround time yet." />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={weeklyTatData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                      <Tooltip {...tooltipStyle} formatter={(v?: number) => [`${v ?? 0}h`, 'Median TAT']} />
                      <ReferenceLine
                        y={LAB_TAT_TARGET_HOURS}
                        stroke="#e34948"
                        strokeDasharray="4 4"
                        label={{ value: `Target ${LAB_TAT_TARGET_HOURS}h`, position: 'insideTopRight', fill: '#e34948', fontSize: 10 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="medianHours"
                        name="Median TAT (h)"
                        stroke="#2a78d6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#2a78d6' }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </ChartCard>

            <ChartCard title="% Within Target TAT" subtitle={`This month, by test type (≤${LAB_TAT_TARGET_HOURS}h)`} chartTypes={['bar']} periods={[]}>
              {() => (
                testTypeTargetData.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmptyState icon={TrendingUp} title="No data yet" message="No completed results this month." />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={testTypeTargetData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                      <XAxis
                        dataKey="testName"
                        tick={{ ...axisTick, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                      <Tooltip {...tooltipStyle} formatter={(v?: number, _name?: unknown, item?: { payload?: { total?: number } }) => [`${v ?? 0}% (n=${item?.payload?.total ?? '?'})`, 'Within target']} />
                      <Bar dataKey="pct" name="% within target" radius={[4, 4, 0, 0]}>
                        {testTypeTargetData.map((d) => (
                          <Cell key={d.testName} fill={d.pct >= 90 ? '#199e70' : d.pct >= 70 ? '#eda100' : '#e34948'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </ChartCard>

            <ChartCard title="Test Volume by Type" subtitle="Orders per day, most recent days" chartTypes={['bar']} periods={[]}>
              {() => (
                volumeByDay.rows.length === 0 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmptyState icon={TrendingUp} title="No data yet" message="No lab orders yet." />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={volumeByDay.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                      <Tooltip {...tooltipStyle} />
                      {volumeByDay.seriesKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          stackId="volume"
                          fill={VOLUME_SERIES_COLORS[i % VOLUME_SERIES_COLORS.length]}
                          radius={i === volumeByDay.seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </ChartCard>
          </div>
        </div>

        </EhrCareDashboard>
      </main>

      {/* ===== Feature 1 & 3: Result Entry Modal (Single + Batch) ===== */}
      {showResultModal && (
        <Modal
          onClose={() => { setShowResultModal(false); setEntryMode('single'); setSelectedOrderId(''); setResultValue(''); setBatchTestType(''); }}
          width={672}
        >
          <div className="dash-card w-full rounded-2xl overflow-hidden" style={{
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
        </Modal>
      )}
    </>
  );
}
