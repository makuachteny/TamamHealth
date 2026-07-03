'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useMessagingDock } from '@/lib/messaging-dock-context';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import {
  Pill, AlertTriangle, Package, Clock, ShieldCheck,
  MessageSquare, Activity, Radio, ChevronRight,
  ClipboardList, Send, CheckCircle2, XCircle,
  AlertOctagon, X, Check, Plus, Users, BarChart3,
} from '@/components/icons/lucide';

const ACCENT = 'var(--accent-primary)';

// Live activity ticker is a demo flourish only — gated off in production so
// users do not see invented prescriptions / dispense events.
const PHARMACY_LIVE_FEED_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const EVENT_TYPES = [
  { type: 'rx_received', label: 'Prescription Received', color: 'var(--color-brand-500)', icon: ClipboardList },
  { type: 'dispensed', label: 'Medication Dispensed', color: 'var(--color-success)', icon: CheckCircle2 },
  { type: 'stock_alert', label: 'Stock Alert Triggered', color: '#F87171', icon: AlertTriangle },
  { type: 'controlled', label: 'Controlled Substance Logged', color: '#A855F7', icon: ShieldCheck },
  { type: 'expired', label: 'Expired Item Flagged', color: 'var(--color-danger)', icon: XCircle },
  { type: 'pickup', label: 'Awaiting Patient Pickup', color: ACCENT, icon: Clock },
  { type: 'restock', label: 'Restock Order Placed', color: 'var(--color-brand-500)', icon: Package },
  { type: 'message', label: 'Pharmacist Message', color: '#EC4899', icon: MessageSquare },
];

const PATIENTS = [
  'Deng Mabior', 'Achol Mayen', 'Nyamal Koang', 'Gatluak Ruot', 'Ayen Dut',
  'Kuol Akot', 'Ladu Tombe', 'Rose Gbudue', 'Majok Chol', 'Nyandit Dut',
];

const MEDICATIONS = [
  'Artemether-Lumefantrine', 'Amoxicillin 500mg', 'Metformin 500mg', 'TDF/3TC/DTG',
  'Ferrous Sulfate', 'Paracetamol 1g', 'Ciprofloxacin 500mg', 'ORS Sachets',
  'Diazepam 5mg', 'Morphine 10mg', 'Insulin Glargine', 'Salbutamol Inhaler',
];

// ===================== DRUG INTERACTION DATA =====================
interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  risk: string;
}

const DRUG_INTERACTIONS: DrugInteraction[] = [
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'HIGH', risk: 'Increased bleeding risk' },
  { drug1: 'Metformin', drug2: 'Alcohol', severity: 'MODERATE', risk: 'Lactic acidosis risk' },
  { drug1: 'ACE Inhibitors', drug2: 'Potassium', severity: 'HIGH', risk: 'Hyperkalemia' },
  { drug1: 'Ciprofloxacin', drug2: 'Antacids', severity: 'MODERATE', risk: 'Reduced absorption' },
  { drug1: 'Methotrexate', drug2: 'NSAIDs', severity: 'HIGH', risk: 'Nephrotoxicity' },
  { drug1: 'SSRIs', drug2: 'MAOIs', severity: 'HIGH', risk: 'Serotonin syndrome' },
];

const INTERACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  HIGH: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: 'var(--color-danger)' },
  MODERATE: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: 'var(--color-warning)' },
  LOW: { bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', text: 'var(--color-brand-500)' },
};

function checkDrugInteractions(medication: string, patientMedications: string[]): DrugInteraction[] {
  const found: DrugInteraction[] = [];
  const medLower = medication.toLowerCase();
  for (const interaction of DRUG_INTERACTIONS) {
    const d1 = interaction.drug1.toLowerCase();
    const d2 = interaction.drug2.toLowerCase();
    const matchesDrug1 = medLower.includes(d1) || patientMedications.some(m => m.toLowerCase().includes(d1));
    const matchesDrug2 = medLower.includes(d2) || patientMedications.some(m => m.toLowerCase().includes(d2));
    const medMatchesDrug1 = medLower.includes(d1);
    const medMatchesDrug2 = medLower.includes(d2);
    if ((medMatchesDrug1 && patientMedications.some(m => m.toLowerCase().includes(d2))) ||
        (medMatchesDrug2 && patientMedications.some(m => m.toLowerCase().includes(d1))) ||
        (matchesDrug1 && matchesDrug2 && medLower.includes(d1) !== medLower.includes(d2))) {
      found.push(interaction);
    }
  }
  return found;
}

// ===================== PRESCRIPTION & STOCK DATA =====================

interface PrescriptionItem {
  id: string;
  patient: string;
  medication: string;
  dose: string;
  prescriber: string;
  time: string;
  status: 'pending' | 'dispensed' | 'awaiting_pickup';
  priority: 'urgent' | 'routine';
}

const INITIAL_PRESCRIPTION_QUEUE: PrescriptionItem[] = [
  { id: 'rx-001', patient: 'Deng Mabior Garang', medication: 'Artemether-Lumefantrine', dose: '80/480mg BD x 3d', prescriber: 'Dr. James Wani', time: '09:15', status: 'pending', priority: 'urgent' },
  { id: 'rx-002', patient: 'Nyamal Koang Gatdet', medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30d', prescriber: 'Dr. Achol Mayen', time: '09:30', status: 'pending', priority: 'routine' },
  { id: 'rx-003', patient: 'Gatluak Ruot Nyuon', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90d', prescriber: 'Dr. TamamHealth Ladu', time: '10:00', status: 'dispensed', priority: 'routine' },
  { id: 'rx-004', patient: 'Rose Tombura Gbudue', medication: 'Metformin', dose: '500mg BD x 30d', prescriber: 'CO Deng Mabior', time: '10:15', status: 'pending', priority: 'routine' },
  { id: 'rx-005', patient: 'Kuol Akot Ajith', medication: 'Morphine 10mg', dose: 'PRN q4h x 3d', prescriber: 'Dr. Nyamal Koang', time: '10:45', status: 'pending', priority: 'urgent' },
  { id: 'rx-006', patient: 'Achol Mayen Ring', medication: 'Amoxicillin', dose: '500mg TDS x 7d', prescriber: 'Dr. James Wani', time: '11:00', status: 'awaiting_pickup', priority: 'routine' },
  { id: 'rx-007', patient: 'Majok Chol Deng', medication: 'Insulin Glargine', dose: '20 IU OD', prescriber: 'Dr. TamamHealth Ladu', time: '11:20', status: 'pending', priority: 'urgent' },
];

interface StockItem {
  name: string;
  stock: number;
  reorder: number;
  unit: string;
  status: 'critical' | 'low' | 'adequate';
}

// Re-classify a stock line after its quantity changes (dispense out / receive in)
// so the status badge and progress bar stay in sync with the new level.
function computeStockStatus(stock: number, reorder: number): StockItem['status'] {
  if (stock === 0 || stock <= reorder * 0.25) return 'critical';
  if (stock <= reorder) return 'low';
  return 'adequate';
}

const INITIAL_STOCK: StockItem[] = [
  { name: 'Artemether-Lumefantrine', stock: 12, reorder: 100, unit: 'packs', status: 'critical' },
  { name: 'ORS Sachets', stock: 28, reorder: 200, unit: 'sachets', status: 'critical' },
  { name: 'Amoxicillin 250mg Susp', stock: 45, reorder: 80, unit: 'bottles', status: 'low' },
  { name: 'Diazepam 5mg', stock: 8, reorder: 30, unit: 'ampoules', status: 'critical' },
  { name: 'Ferrous Sulfate', stock: 67, reorder: 100, unit: 'tablets', status: 'low' },
  { name: 'Paracetamol Syrup', stock: 15, reorder: 50, unit: 'bottles', status: 'critical' },
];

interface LiveEvent {
  id: number;
  type: string;
  label: string;
  color: string;
  icon: typeof Activity;
  patient: string;
  medication: string;
  time: string;
  isNew: boolean;
}

// ===================== TOAST COMPONENT =====================
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg" style={{
      background: '#065F46', color: '#D1FAE5', border: '1px solid #1F9D6F',
    }}>
      <CheckCircle2 className="w-4 h-4" style={{ color: '#34D399' }} />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2" aria-label={t('action.close')}><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ===================== DISPENSE CONFIRMATION MODAL =====================
function DispenseModal({ rx, onConfirm, onCancel, interactions }: {
  rx: PrescriptionItem;
  onConfirm: () => void;
  onCancel: () => void;
  interactions: DrugInteraction[];
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="dash-card rounded-2xl p-5 w-full max-w-md mx-4" style={{
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        <div className="flex items-center gap-2 mb-4">
          <Pill className="w-5 h-5" style={{ color: ACCENT }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.confirmDispensing')}</h3>
        </div>

        {/* Interaction Warnings */}
        {interactions.length > 0 && (
          <div className="mb-4 space-y-2">
            {interactions.map((inter, i) => {
              const colors = INTERACTION_COLORS[inter.severity];
              return (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{
                  background: colors.bg, border: `1px solid ${colors.border}`,
                }}>
                  <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.text }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: colors.text }}>
                      {t('pharmacy.interactionLabel', { severity: inter.severity, drug1: inter.drug1, drug2: inter.drug2 })}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{inter.risk}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 mb-5 p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.patient')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.patient}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.medication')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.medication}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.dose')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.dose}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.prescriber')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.prescriber}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all" style={{
            background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)',
          }}>{t('action.cancel')}</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5" style={{
            background: 'var(--color-success)',
          }}>
            <Check className="w-4 h-4" /> {t('pharmacy.dispense')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== RECEIVE STOCK MODAL =====================
// Record a delivery of purchased drugs and add the received quantity to the
// matching stock line ("on what you have"). New items can also be added.
function ReceiveStockModal({ items, onConfirm, onClose }: {
  items: StockItem[];
  onConfirm: (name: string, qty: number, unit: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const selected = items.find(i => i.name === name);
  const unit = selected?.unit || 'units';
  const qtyNum = parseInt(qty) || 0;
  const canSave = name.trim().length > 0 && qtyNum > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="dash-card rounded-2xl p-5 w-full max-w-md mx-4" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: ACCENT }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.receiveStock')}</h3>
          </div>
          <button onClick={onClose} aria-label={t('action.close')}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.medication')}</label>
            <input
              list="receive-stock-list"
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder={t('pharmacy.medication')}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            />
            <datalist id="receive-stock-list">
              {items.map(i => <option key={i.name} value={i.name}>{i.stock} {i.unit}</option>)}
            </datalist>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>
              {t('pharmacy.quantityReceived', { unit })}
            </label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            />
            {selected && qtyNum > 0 && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {selected.stock} → <strong style={{ color: 'var(--color-success)' }}>{selected.stock + qtyNum}</strong> {unit}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all" style={{
            background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)',
          }}>{t('action.cancel')}</button>
          <button
            onClick={() => canSave && onConfirm(name.trim(), qtyNum, unit)}
            disabled={!canSave}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5"
            style={{ background: canSave ? 'var(--color-success)' : 'var(--text-muted)', opacity: canSave ? 1 : 0.6 }}
          >
            <Plus className="w-4 h-4" /> {t('pharmacy.addToStock')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================

export default function PharmacyDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { openDock } = useMessagingDock();
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date()), []);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [eventCounter, setEventCounter] = useState(0);

  // State for prescription queue (mutable for dispense)
  const [prescriptionQueue, setPrescriptionQueue] = useState<PrescriptionItem[]>(INITIAL_PRESCRIPTION_QUEUE);
  // State for stock (mutable for dispense deduction)
  const [stockAlerts, setStockAlerts] = useState<StockItem[]>(INITIAL_STOCK);
  // Dispense modal
  const [dispenseTarget, setDispenseTarget] = useState<PrescriptionItem | null>(null);
  // Toast
  const [toast, setToast] = useState<string | null>(null);
  // Receive stock modal (record purchased drugs arriving)
  const [showReceiveStock, setShowReceiveStock] = useState(false);
  // Prescription queue status filter
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'dispensed' | 'awaiting_pickup' | 'controlled'>('all');
  // Queue text search (bound to the shared shell's left-rail search).
  const [queueSearch, setQueueSearch] = useState('');

  const generateEvent = useCallback((): LiveEvent => {
    const evtType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const now = new Date();
    return {
      id: Date.now() + Math.random(),
      ...evtType,
      patient: PATIENTS[Math.floor(Math.random() * PATIENTS.length)],
      medication: MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)],
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isNew: true,
    };
  }, []);

  useEffect(() => {
    if (!PHARMACY_LIVE_FEED_ENABLED) return;
    const initial: LiveEvent[] = [];
    for (let i = 0; i < 5; i++) {
      initial.push({ ...generateEvent(), isNew: false, id: i });
    }
    setLiveEvents(initial);

    const interval = setInterval(() => {
      setLiveEvents(prev => {
        const newEvent = generateEvent();
        return [newEvent, ...prev.slice(0, 9).map(e => ({ ...e, isNew: false }))];
      });
      setEventCounter(c => c + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [generateEvent]);

  // Computed values
  const pendingRx = prescriptionQueue.filter(r => r.status === 'pending').length;
  const dispensedToday = prescriptionQueue.filter(r => r.status === 'dispensed').length;
  const lowStockCount = stockAlerts.filter(a => a.status === 'low').length;
  const criticalCount = stockAlerts.filter(a => a.status === 'critical').length;
  const awaitingPickup = prescriptionQueue.filter(r => r.status === 'awaiting_pickup').length;
  const isControlled = (rx: PrescriptionItem) => rx.medication.includes('Morphine') || rx.medication.includes('Diazepam');
  const controlledCount = prescriptionQueue.filter(isControlled).length;

  // Queue filtered by the selected status chip and the inline search query.
  const queueQuery = queueSearch.trim().toLowerCase();
  const visibleQueue = prescriptionQueue.filter(rx => {
    const statusOk =
      queueFilter === 'all' ? true :
      queueFilter === 'controlled' ? isControlled(rx) :
      rx.status === queueFilter;
    if (!statusOk) return false;
    if (!queueQuery) return true;
    return (
      rx.patient.toLowerCase().includes(queueQuery) ||
      rx.medication.toLowerCase().includes(queueQuery) ||
      (rx.prescriber || '').toLowerCase().includes(queueQuery)
    );
  });

  // Dispense handler
  const handleDispense = (rx: PrescriptionItem) => {
    setDispenseTarget(rx);
  };

  const confirmDispense = () => {
    if (!dispenseTarget) return;
    setPrescriptionQueue(prev => prev.map(r =>
      r.id === dispenseTarget.id ? { ...r, status: 'dispensed' as const } : r
    ));
    // Deduct from stock if matching
    setStockAlerts(prev => prev.map(s => {
      if (dispenseTarget.medication.toLowerCase().includes(s.name.toLowerCase().split(' ')[0].toLowerCase())) {
        const newStock = Math.max(0, s.stock - 1);
        return { ...s, stock: newStock, status: computeStockStatus(newStock, s.reorder) };
      }
      return s;
    }));
    setToast(t('pharmacy.dispensedToast', { medication: dispenseTarget.medication, patient: dispenseTarget.patient }));
    setDispenseTarget(null);
  };

  // Undo a dispense recorded in this session: restore the prescription to
  // pending and return the deducted unit to stock. Local-state only (this
  // dashboard does not persist), so the reversal is exact.
  const handleUndoDispense = (rx: PrescriptionItem) => {
    setPrescriptionQueue(prev => prev.map(r =>
      r.id === rx.id ? { ...r, status: 'pending' as const } : r
    ));
    setStockAlerts(prev => prev.map(s => {
      if (rx.medication.toLowerCase().includes(s.name.toLowerCase().split(' ')[0].toLowerCase())) {
        const newStock = s.stock + 1;
        return { ...s, stock: newStock, status: computeStockStatus(newStock, s.reorder) };
      }
      return s;
    }));
    setToast(t('pharmacy.dispensedToast', { medication: rx.medication, patient: rx.patient }));
  };

  // Drug interaction check for dispense modal — compare against the patient's
  // other medications currently in the queue.
  const getInteractionsForRx = (rx: PrescriptionItem): DrugInteraction[] => {
    const currentMeds = prescriptionQueue
      .filter(r => r.patient === rx.patient && r.id !== rx.id)
      .map(r => r.medication);
    return checkDrugInteractions(rx.medication, currentMeds);
  };

  // Receive purchased stock: add the delivered quantity to a matching line, or
  // create a new line if it's a drug we don't carry yet.
  const handleReceiveStock = (name: string, qty: number, unit: string) => {
    setStockAlerts(prev => {
      const idx = prev.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
      if (idx === -1) {
        const reorder = Math.max(qty, 50);
        return [...prev, { name, stock: qty, reorder, unit, status: computeStockStatus(qty, reorder) }];
      }
      return prev.map((s, i) => {
        if (i !== idx) return s;
        const newStock = s.stock + qty;
        return { ...s, stock: newStock, status: computeStockStatus(newStock, s.reorder) };
      });
    });
    setToast(t('pharmacy.stockedMedication', { medication: name }));
    setShowReceiveStock(false);
  };

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title={t('pharmacy.operations')}
          eyebrow={t('nav.pharmacy')}
          greetingName={currentUser?.name}
          dateLabel={dateLabel}
          showCalendar={false}
          tabs={[
            { key: 'all', label: t('pharmacy.viewAll'), count: prescriptionQueue.length },
            { key: 'pending', label: t('pharmacy.pending'), count: pendingRx },
            { key: 'dispensed', label: t('pharmacy.kpiDispensed'), count: dispensedToday },
            { key: 'awaiting_pickup', label: t('pharmacy.kpiPickup'), count: awaitingPickup },
            { key: 'controlled', label: t('pharmacy.kpiControlled'), count: controlledCount },
          ]}
          activeTab={queueFilter}
          onTabChange={(k) => setQueueFilter(k as typeof queueFilter)}
          searchValue={queueSearch}
          searchPlaceholder={t('topbar.searchPlaceholder')}
          onSearchChange={setQueueSearch}
          filters={[]}
          actions={[
            { label: t('pharmacy.receiveStock'), icon: Package, onClick: () => setShowReceiveStock(true), tone: 'primary' },
            { label: t('pharmacy.kpiControlled'), icon: ShieldCheck, onClick: () => router.push('/controlled-substances') },
            { label: t('pharmacy.message'), icon: MessageSquare, onClick: () => openDock() },
          ]}
          actionStrip={[
            { label: t('pharmacy.inventory'), icon: Package, onClick: () => router.push('/pharmacy') },
            { label: t('pharmacy.checkStock'), icon: ClipboardList, onClick: () => router.push('/pharmacy') },
            { label: t('reports.title'), icon: BarChart3, onClick: () => router.push('/reports') },
            { label: t('nav.patients'), icon: Users, onClick: () => router.push('/patients') },
          ]}
          rows={visibleQueue.map((rx): EhrCareDashboardRow => ({
            id: rx.id,
            title: rx.patient,
            subtitle: `${rx.medication} · ${rx.dose}`,
            meta: `${rx.prescriber} · ${rx.time}`,
            compactMeta: rx.time,
            time: rx.time,
            status: rx.status === 'awaiting_pickup' ? t('pharmacy.statusPickup') : t(`pharmacy.status_${rx.status}`),
            statusTone: rx.status === 'dispensed' ? 'done' : rx.status === 'awaiting_pickup' ? 'ready' : rx.priority === 'urgent' ? 'warning' : 'scheduled',
            priority: rx.priority === 'urgent' ? t('pharmacy.urgent') : undefined,
            actionLabel: rx.status === 'pending' ? t('pharmacy.dispense') : rx.status === 'dispensed' ? t('action.undo') : undefined,
            onAction: rx.status === 'pending' ? () => handleDispense(rx) : rx.status === 'dispensed' ? () => handleUndoDispense(rx) : undefined,
          }))}
          metrics={[
            { label: t('pharmacy.kpiPendingRx'), value: pendingRx },
            { label: t('pharmacy.kpiDispensed'), value: dispensedToday },
            { label: t('pharmacy.kpiPickup'), value: awaitingPickup },
            { label: t('pharmacy.kpiLowStock'), value: lowStockCount, tone: 'warning' },
            { label: t('pharmacy.kpiControlled'), value: criticalCount, tone: 'danger' },
          ]}
          metricsTitle={t('pharmacy.operations')}
          checklist={[
            { label: t('pharmacy.pending'), done: pendingRx === 0, onClick: () => setQueueFilter('pending') },
            { label: t('pharmacy.kpiControlled'), done: controlledCount === 0, onClick: () => setQueueFilter('controlled') },
            { label: t('pharmacy.receiveStock'), done: criticalCount === 0, onClick: () => setShowReceiveStock(true) },
          ]}
          checklistTitle={t('pharmacy.quickActions')}
          missionTitle={t('pharmacy.operations')}
          missionDescription={t('pharmacy.dispensingPipeline')}
          emptyTitle={t('pharmacy.noPrescriptionsFound')}
        >
          <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>
            {/* Dispensing Pipeline */}
            <div className="dash-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: ACCENT }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.dispensingPipeline')}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.pendingBadge', { count: pendingRx })}</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <div className="flex items-center gap-1 min-w-[680px]">
                  {[
                    { key: 'stock', label: t('pharmacy.inStock'), icon: Package, color: ACCENT, count: stockAlerts.filter(s => s.status === 'adequate').length },
                    { key: 'received', label: t('pharmacy.stageReceived'), icon: ClipboardList, color: ACCENT, count: prescriptionQueue.length },
                    { key: 'pending', label: t('pharmacy.pending'), icon: Clock, color: 'var(--color-warning)', count: pendingRx },
                    { key: 'dispensed', label: t('pharmacy.kpiDispensed'), icon: CheckCircle2, color: 'var(--color-success)', count: dispensedToday },
                    { key: 'pickup', label: t('pharmacy.kpiPickup'), icon: Send, color: 'var(--color-brand-500)', count: awaitingPickup },
                    { key: 'reorder', label: t('pharmacy.reorderNeeded'), icon: AlertTriangle, color: 'var(--color-danger)', count: criticalCount + lowStockCount },
                  ].map((stage, idx, arr) => (
                    <div key={stage.key} className="flex items-center flex-1">
                      <div className="flex-1 p-2.5 rounded-xl transition-all" style={{
                        background: stage.count > 0 ? 'var(--overlay-subtle)' : 'transparent',
                        border: `1px solid ${stage.count > 0 ? 'var(--border-light)' : 'transparent'}`,
                        opacity: stage.count > 0 ? 1 : 0.5,
                      }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <stage.icon className="w-3.5 h-3.5" style={{ color: stage.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
                        </div>
                        <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stage.count}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="px-1 flex-shrink-0">
                          <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)', opacity: 0.45 }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Stock Alerts */}
              <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 260 }}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.stockAlerts')}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>{t('pharmacy.criticalBadge', { count: criticalCount })}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>{lowStockCount} {t('pharmacy.kpiLowStock')}</span>
                  </div>
                  <button onClick={() => setShowReceiveStock(true)} className="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90" style={{ background: 'var(--color-success)' }}>
                    <Plus className="w-3 h-3" /> {t('pharmacy.receiveStock')}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {stockAlerts.map((item, i) => {
                    const pct = Math.round((item.stock / item.reorder) * 100);
                    return (
                      <div key={i} className="p-2.5 rounded-lg transition-all" style={{
                        background: item.status === 'critical' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                        border: `1px solid ${item.status === 'critical' ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
                      }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-1" style={{
                            background: item.status === 'critical' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                            color: item.status === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)',
                          }}>{t(`pharmacy.stockStatus_${item.status}`)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          <span>{item.stock} / {item.reorder} {item.unit}</span>
                          <span style={{ color: item.status === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--overlay-subtle)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.status === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dispensing Activity Feed */}
              <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 260 }}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.activityFeed')}</span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.eventsCount', { count: eventCounter })}</span>
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
                          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'transparent' }}>
                            <Icon className="w-3 h-3" style={{ color: evt.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold truncate" style={{ color: evt.color }}>{t(`pharmacy.event_${evt.type}`)}</span>
                              {evt.isNew && (
                                <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: `${evt.color}20`, color: evt.color }}>{t('pharmacy.new')}</span>
                              )}
                            </div>
                            <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{evt.patient}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{evt.medication}</span>
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
        </EhrCareDashboard>
      </main>

      {/* Modals and Toasts */}
      {dispenseTarget && (
        <DispenseModal
          rx={dispenseTarget}
          interactions={getInteractionsForRx(dispenseTarget)}
          onConfirm={confirmDispense}
          onCancel={() => setDispenseTarget(null)}
        />
      )}
      {showReceiveStock && (
        <ReceiveStockModal
          items={stockAlerts}
          onConfirm={handleReceiveStock}
          onClose={() => setShowReceiveStock(false)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
