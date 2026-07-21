'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { usePharmacyInventory } from '@/lib/hooks/usePharmacyInventory';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { classifyStockStatus } from '@/lib/services/pharmacy-inventory-service';
import { checkNewPrescription, type DrugInteraction, type InteractionSeverity } from '@/lib/services/drug-interaction-service';
import { formatMoney } from '@/lib/format-utils';
import { isActivePharmacyStage, isFinanciallyCleared, pharmacyStage, pharmacyStageLabel, pharmacyStageTone } from '@/lib/pharmacy-workflow';
import type { PrescriptionDoc, PharmacyInventoryDoc, UserDoc } from '@/lib/db-types';
import type { PrescriptionStatus } from '@/lib/clinical-flow/order-lifecycles';
import EhrCareDashboard, {
  type EhrCareDashboardRow,
  type EhrCareDashboardAction,
  type EhrCareDashboardChecklistItem,
} from '@/components/ehr/EhrCareDashboard';
import {
  Pill, Package, ShieldCheck, ClipboardList,
  Activity, AlertTriangle, Clock, CheckCircle2, ChevronRight,
  AlertOctagon, X, Check, Plus, Users, BarChart3, Loader2,
} from '@/components/icons/lucide';

const ACCENT = 'var(--accent-primary)';
type WorkflowStepKey = 'received' | 'review' | 'checked' | 'payment' | 'dispensed' | 'counseled' | 'cleared';
type WorkflowStepAction = { label: string; onClick: () => void };
type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  note: string;
  done: boolean;
  action?: WorkflowStepAction;
};

// Interaction severities coming out of drug-interaction-service.checkInteractions().
const SEVERITY_STYLE: Record<InteractionSeverity, { bg: string; border: string; text: string; label: string }> = {
  contraindicated: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: 'var(--color-danger)', label: 'CONTRAINDICATED' },
  serious: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.22)', text: 'var(--color-danger)', label: 'SERIOUS' },
  moderate: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: 'var(--color-warning)', label: 'MODERATE' },
};

function titleCaseDrug(name: string): string {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ===================== DISPENSE CONFIRMATION MODAL =====================
// Shows the patient/drug summary, any real drug-interaction warnings pulled
// from the patient's other active prescriptions, and — when the matched
// inventory item is a controlled/witnessed drug — a witness picker that
// gates the confirm button until a second staff member is selected.
function DispenseModal({
  rx, inv, qty, interactions, users, currentUserId, witnessId, onWitnessChange, onConfirm, onCancel, confirming,
}: {
  rx: PrescriptionDoc;
  inv: PharmacyInventoryDoc;
  qty: number;
  interactions: DrugInteraction[];
  users: UserDoc[];
  currentUserId?: string;
  witnessId: string;
  onWitnessChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  const { t } = useTranslation();
  const requiresWitness = !!(inv.controlledSchedule || inv.requiresWitness);
  const canConfirm = !confirming && (!requiresWitness || !!witnessId);

  return (
    <Modal onClose={onCancel} width={448}>
      <div className="dash-card rounded-2xl p-5 w-full" style={{
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        <div className="flex items-center gap-2 mb-4">
          <Pill className="w-5 h-5" style={{ color: ACCENT }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.confirmDispensing')}</h3>
        </div>

        {/* Interaction Warnings — real drug-interaction-service check against
            the patient's other active prescriptions. */}
        {interactions.length > 0 && (
          <div className="mb-4 space-y-2">
            {interactions.map((inter, i) => {
              const style = SEVERITY_STYLE[inter.severity];
              return (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{
                  background: style.bg, border: `1px solid ${style.border}`,
                }}>
                  <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: style.text }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: style.text }}>
                      {t('pharmacy.interactionLabel', { severity: style.label, drug1: titleCaseDrug(inter.drug1), drug2: titleCaseDrug(inter.drug2) })}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{inter.description}</p>
                    <p className="text-[10px] italic mt-0.5" style={{ color: 'var(--text-muted)' }}>{inter.clinicalAdvice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.patient')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.medication')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.medication}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.dose')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.dose} {rx.frequency}{rx.duration ? ` x ${rx.duration}` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.prescriber')}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.prescribedBy}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Quantity</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{qty} {inv.unit}</span>
          </div>
        </div>

        {requiresWitness && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>
                Controlled substance{inv.controlledSchedule ? ` (Schedule ${inv.controlledSchedule})` : ''} — witness required
              </span>
            </div>
            <select
              value={witnessId}
              onChange={(e) => onWitnessChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            >
              <option value="">Select witnessing staff…</option>
              {users.filter(u => u._id !== currentUserId).map(u => (
                <option key={u._id} value={u._id}>{u.name} — {u.role}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all" style={{
            background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)',
          }}>{t('action.cancel')}</button>
          <button
            onClick={() => canConfirm && onConfirm()}
            disabled={!canConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'var(--color-success)', opacity: canConfirm ? 1 : 0.6 }}
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('pharmacy.dispense')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== RECEIVE STOCK MODAL =====================
// Record a delivery of purchased drugs and add the received quantity to the
// matching inventory line ("on what you have"). New items can also be added.
function ReceiveStockModal({ items, onConfirm, onClose, saving }: {
  items: { name: string; stock: number; unit: string }[];
  onConfirm: (name: string, qty: number, unit: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const selected = items.find(i => i.name === name);
  const unit = selected?.unit || 'units';
  const qtyNum = parseInt(qty) || 0;
  const canSave = !saving && name.trim().length > 0 && qtyNum > 0;

  return (
    <Modal onClose={onClose} width={448}>
      <div className="dash-card rounded-2xl p-5 w-full" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('pharmacy.addToStock')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ===================== MAIN COMPONENT =====================

export default function PharmacyDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useApp();
  const { canDispense, canAccess } = usePermissions();
  const { showToast } = useToast();
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date()), []);

  // ── Real data sources ──
  const { prescriptions: rxQueue, loading: rxLoading, dispense, advance } = usePrescriptions();
  const { items: rawInventory, create: createInventory, update: updateInventory } = usePharmacyInventory();
  const { users } = useUsers();

  // Dispense confirmation modal (+ witness selection for controlled drugs)
  const [dispenseTarget, setDispenseTarget] = useState<{ rx: PrescriptionDoc; inv: PharmacyInventoryDoc; qty: number } | null>(null);
  const [witnessId, setWitnessId] = useState('');
  const [dispensing, setDispensing] = useState(false);
  // Receive stock modal (record purchased drugs arriving)
  const [showReceiveStock, setShowReceiveStock] = useState(false);
  const [receivingStock, setReceivingStock] = useState(false);
  // Prescription queue status filter
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'review' | 'payment' | 'ready' | 'dispensed' | 'controlled'>('all');
  // Which stat panel (header toggles) occupies the center instead of the Rx
  // queue; null = normal queue view.
  const [centerPanel, setCenterPanel] = useState<'pipeline' | 'stock' | null>(null);
  // Queue text search (bound to the shared shell's left-rail search).
  const [queueSearch, setQueueSearch] = useState('');
  const [balanceByPatient, setBalanceByPatient] = useState<Map<string, number>>(new Map());
  const deepLinkPatientId = searchParams?.get('patientId') || '';
  const deepLinkPatientName = searchParams?.get('patient') || '';
  const deepLinkRxId = searchParams?.get('rxId') || '';

  useEffect(() => {
    if (!deepLinkPatientId && !deepLinkPatientName && !deepLinkRxId) return;
    setCenterPanel(null);
    setQueueFilter('all');
    setQueueSearch('');
  }, [deepLinkPatientId, deepLinkPatientName, deepLinkRxId]);

  // Inventory augmented with a live status classification (same helper the
  // real /pharmacy page uses), so stock badges/percentages stay accurate as
  // stock drains or expiry dates pass.
  const inventory = useMemo(
    () => rawInventory.map(item => ({ ...item, status: classifyStockStatus(item) })),
    [rawInventory],
  );

  useEffect(() => {
    let cancelled = false;
    const patientIds = Array.from(new Set(rxQueue.map(rx => rx.patientId).filter(Boolean)));
    if (patientIds.length === 0) {
      setBalanceByPatient(new Map());
      return;
    }
    (async () => {
      const { getPatientBalance } = await import('@/lib/services/ledger-service');
      const balances = await Promise.all(patientIds.map(async patientId => [patientId, await getPatientBalance(patientId)] as const));
      if (!cancelled) setBalanceByPatient(new Map(balances));
    })().catch(() => {
      if (!cancelled) setBalanceByPatient(new Map());
    });
    return () => { cancelled = true; };
  }, [rxQueue]);

  const patientBalanceFor = useCallback((rx: PrescriptionDoc) =>
    rx.patientId ? balanceByPatient.get(rx.patientId) ?? 0 : 0,
  [balanceByPatient]);
  // Find the inventory row for a medication at the current facility (same
  // exact-name matching the real /pharmacy page uses for decrementStock).
  const findInventoryFor = useCallback((medication: string) =>
    inventory.find(i => i.medicationName === medication && (!currentUser?.hospitalId || i.hospitalId === currentUser.hospitalId)),
  [inventory, currentUser?.hospitalId]);

  const isControlled = useCallback((rx: PrescriptionDoc) => {
    const inv = findInventoryFor(rx.medication);
    return !!(inv?.controlledSchedule || inv?.requiresWitness);
  }, [findInventoryFor]);

  // Only the lines that need attention, worst first — shown in the Stock
  // Alerts panel (the full inventory list lives on /pharmacy).
  const stockAlerts = useMemo(
    () => inventory
      .filter(i => i.status !== 'adequate')
      .sort((a, b) => (a.stockLevel / Math.max(1, a.reorderLevel)) - (b.stockLevel / Math.max(1, b.reorderLevel))),
    [inventory],
  );

  const reviewStages: PrescriptionStatus[] = ['received_in_pharmacy_queue', 'under_review', 'held_awaiting_clarification', 'stockout_partial_referred', 'clinician_consultation_in_progress'];
  const pendingWorkflowCount = rxQueue.filter(r => r.status === 'pending').length;
  const reviewCount = rxQueue.filter(r => r.status === 'pending' && reviewStages.includes(pharmacyStage(r))).length;
  const paymentDueCount = rxQueue.filter(r => pharmacyStage(r) === 'cleared_for_dispensing' && !isFinanciallyCleared(patientBalanceFor(r))).length;
  const readyCount = rxQueue.filter(r => pharmacyStage(r) === 'cleared_for_dispensing' && isFinanciallyCleared(patientBalanceFor(r))).length;
  const dispensedCount = rxQueue.filter(r => ['dispensed', 'counseled', 'complete'].includes(pharmacyStage(r))).length;
  const pendingRx = pendingWorkflowCount;
  const lowStockCount = inventory.filter(i => i.status === 'low').length;
  const criticalCount = inventory.filter(i => i.status === 'critical').length;
  const expiredCount = inventory.filter(i => i.status === 'expired').length;
  const inStockCount = inventory.filter(i => i.status === 'adequate').length;
  const controlledCount = rxQueue.filter(isControlled).length;

  // Queue filtered by the selected status chip and the inline search query.
  const queueQuery = queueSearch.trim().toLowerCase();
  const visibleQueue = rxQueue.filter(rx => {
    const stage = pharmacyStage(rx);
    const balance = patientBalanceFor(rx);
    const deepLinkOk =
      deepLinkRxId ? rx._id === deepLinkRxId :
      deepLinkPatientId ? rx.patientId === deepLinkPatientId :
      deepLinkPatientName ? rx.patientName.toLowerCase() === deepLinkPatientName.toLowerCase() :
      true;
    if (!deepLinkOk) return false;
    const statusOk =
      queueFilter === 'all' ? true :
      queueFilter === 'controlled' ? isControlled(rx) :
      queueFilter === 'pending' ? rx.status === 'pending' :
      queueFilter === 'review' ? reviewStages.includes(stage) :
      queueFilter === 'payment' ? stage === 'cleared_for_dispensing' && !isFinanciallyCleared(balance) :
      queueFilter === 'ready' ? stage === 'cleared_for_dispensing' && isFinanciallyCleared(balance) :
      queueFilter === 'dispensed' ? ['dispensed', 'counseled', 'complete'].includes(stage) :
      true;
    if (!statusOk) return false;
    if (!queueQuery) return true;
    return (
      rx.patientName.toLowerCase().includes(queueQuery) ||
      rx.medication.toLowerCase().includes(queueQuery) ||
      (rx.prescribedBy || '').toLowerCase().includes(queueQuery)
    );
  });
  const autoOpenRxId = useMemo(() => {
    if (deepLinkRxId && visibleQueue.some(rx => rx._id === deepLinkRxId)) return deepLinkRxId;
    if (!deepLinkPatientId && !deepLinkPatientName) return null;
    const activeRx = visibleQueue.find(rx => isActivePharmacyStage(pharmacyStage(rx)) && rx.status !== 'discontinued');
    return (activeRx || visibleQueue[0])?._id || null;
  }, [deepLinkPatientId, deepLinkPatientName, deepLinkRxId, visibleQueue]);

  // Drug interaction check for the dispense modal — compare against the
  // patient's other active (non-discontinued) prescriptions in the real queue.
  const getInteractionsForRx = (rx: PrescriptionDoc): DrugInteraction[] => {
    const currentMeds = rxQueue
      .filter(r => r._id !== rx._id && r.status !== 'discontinued' &&
        (rx.patientId ? r.patientId === rx.patientId : r.patientName === rx.patientName))
      .map(r => r.medication);
    return checkNewPrescription(rx.medication, currentMeds).interactions;
  };

  const advanceRx = async (rx: PrescriptionDoc, to: PrescriptionStatus, successMessage: string) => {
    try {
      await advance(rx._id, to);
      showToast(successMessage, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update prescription workflow.', 'error');
    }
  };

  const handleStartReview = (rx: PrescriptionDoc) => {
    const stage = pharmacyStage(rx);
    const next: PrescriptionStatus = stage === 'prescribed' ? 'received_in_pharmacy_queue' : 'under_review';
    advanceRx(rx, next, `${rx.medication} moved to pharmacist review.`);
  };

  const handleClearForDispense = (rx: PrescriptionDoc) => {
    const qty = rx.quantityToDispense || 1;
    const inv = findInventoryFor(rx.medication);
    const interactions = getInteractionsForRx(rx);
    if (interactions.some(i => i.severity === 'contraindicated' || i.severity === 'serious')) {
      advanceRx(rx, 'held_awaiting_clarification', 'Held for prescriber clarification because of a serious interaction.');
      return;
    }
    if (!inv || inv.stockLevel < qty) {
      advanceRx(rx, 'stockout_partial_referred', `Stockout recorded: ${inv?.stockLevel ?? 0} ${inv?.unit || 'unit(s)'} available.`);
      return;
    }
    advanceRx(rx, 'cleared_for_dispensing', `${rx.medication} cleared. Send patient for payment if a balance remains.`);
  };

  const handlePaymentStep = (rx: PrescriptionDoc) => {
    if (canAccess('/payments') && rx.patientId) {
      router.push(`/payments?patientId=${rx.patientId}`);
      return;
    }
    showToast(`Payment due for ${rx.patientName}: ${formatMoney(patientBalanceFor(rx))}. Send the patient to cashier before dispensing.`, 'error');
  };

  const handleCounsel = (rx: PrescriptionDoc) =>
    advanceRx(rx, 'counseled', `Counseling recorded for ${rx.patientName}.`);

  const handleComplete = (rx: PrescriptionDoc) =>
    advanceRx(rx, 'complete', `${rx.medication} workflow completed.`);

  // Dispense handler — gates on real stock availability before opening the
  // confirm modal, exactly like the real /pharmacy page's handleDispense.
  const handleDispense = (rx: PrescriptionDoc) => {
    const stage = pharmacyStage(rx);
    if (stage !== 'cleared_for_dispensing') {
      showToast('Check and clear the medication order before dispensing.', 'error');
      return;
    }
    if (!isFinanciallyCleared(patientBalanceFor(rx))) {
      handlePaymentStep(rx);
      return;
    }
    const qty = rx.quantityToDispense || 1;
    const inv = findInventoryFor(rx.medication);
    if (!inv || inv.stockLevel < qty) {
      showToast(`Insufficient stock: ${inv?.stockLevel ?? 0} ${inv?.unit || 'unit(s)'} available, ${qty} needed for the full course.`, 'error');
      return;
    }
    setWitnessId('');
    setDispenseTarget({ rx, inv, qty });
  };

  // Perform the dispense: for controlled drugs record the witnessed movement
  // FIRST (it validates two distinct signatories and a non-negative balance),
  // then decrement real stock by the full course and mark the prescription
  // dispensed — mirrors doDispense() on the real /pharmacy page.
  const confirmDispense = async () => {
    if (!dispenseTarget) return;
    const { rx, inv, qty } = dispenseTarget;
    const requiresWitness = !!(inv.controlledSchedule || inv.requiresWitness);
    let witness: { id: string; name: string } | null = null;
    if (requiresWitness) {
      const w = users.find(u => u._id === witnessId);
      if (!w) {
        showToast('Select a witnessing staff member.', 'error');
        return;
      }
      witness = { id: w._id, name: w.name };
    }

    setDispensing(true);
    if (inv.controlledSchedule) {
      try {
        const { recordMovement } = await import('@/lib/services/controlled-substance-service');
        await recordMovement({
          inventoryId: inv._id,
          medicationName: inv.medicationName,
          schedule: inv.controlledSchedule,
          movement: 'dispense',
          quantity: qty,
          unit: inv.unit,
          beforeBalance: inv.stockLevel,
          patientId: rx.patientId,
          patientName: rx.patientName,
          prescriptionId: rx._id,
          operatorId: currentUser?._id || '',
          operatorName: currentUser?.name || '',
          witnessId: witness?.id || '',
          witnessName: witness?.name || '',
          facilityId: currentUser?.hospitalId || '',
          facilityName: currentUser?.hospitalName || '',
          orgId: currentUser?.orgId,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Controlled-substance log failed.', 'error');
        setDispensing(false);
        return;
      }
    }
    try {
      const { decrementStock } = await import('@/lib/services/pharmacy-inventory-service');
      await decrementStock(rx.medication, currentUser?.hospitalId, qty);
    } catch {
      showToast(t('pharmacy.outOfStockCannotDispense'), 'error');
      setDispensing(false);
      return;
    }
    try {
      await dispense(rx._id);
    } catch {
      showToast(t('pharmacy.dispenseMarkFailed'), 'error');
      setDispensing(false);
      return;
    }
    const { logAudit } = await import('@/lib/services/audit-service');
    logAudit('DISPENSE_PRESCRIPTION', currentUser?._id, currentUser?.username,
      `Dispensed ${qty} ${inv.unit} ${rx.medication} to ${rx.patientName} (${rx._id})`).catch(() => {});
    showToast(t('pharmacy.dispensedToast', { medication: rx.medication, patient: rx.patientName }), 'success');
    setDispensing(false);
    setDispenseTarget(null);
  };

  // Receive purchased stock: add the delivered quantity to a matching real
  // inventory line, or create a new line if it's a drug we don't carry yet.
  const handleReceiveStock = async (name: string, qty: number, unit: string) => {
    if (!currentUser?.hospitalId) {
      showToast(t('pharmacy.noFacilityAssigned'), 'error');
      return;
    }
    setReceivingStock(true);
    try {
      const existing = inventory.find(i => i.medicationName.toLowerCase() === name.toLowerCase() && i.hospitalId === currentUser.hospitalId);
      if (existing) {
        await updateInventory(existing._id, {
          stockLevel: existing.stockLevel + qty,
          lastReceived: new Date().toISOString(),
        });
      } else {
        const reorder = Math.max(qty, 50);
        await createInventory({
          hospitalId: currentUser.hospitalId,
          hospitalName: currentUser.hospitalName || '',
          medicationName: name,
          category: 'General',
          stockLevel: qty,
          unit,
          reorderLevel: reorder,
          batchNumber: `BN${Date.now().toString(36).toUpperCase()}`,
          expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          lastReceived: new Date().toISOString(),
          orgId: currentUser.orgId,
        });
      }
      showToast(t('pharmacy.stockedMedication', { medication: name }), 'success');
      setShowReceiveStock(false);
    } catch (err) {
      console.error(err);
      showToast(t('pharmacy.saveStockReceiptFailed'), 'error');
    } finally {
      setReceivingStock(false);
    }
  };

  const renderWorkflowPopup = (rx: PrescriptionDoc) => {
    const stage = pharmacyStage(rx);
    const balance = patientBalanceFor(rx);
    const inv = findInventoryFor(rx.medication);
    const qty = rx.quantityToDispense || 1;
    const stockOk = !!inv && inv.stockLevel >= qty;
    const paymentClear = isFinanciallyCleared(balance);
    const completed = {
      received: stage !== 'prescribed',
      review: !['prescribed', 'received_in_pharmacy_queue'].includes(stage),
      checked: ['cleared_for_dispensing', 'dispensed', 'counseled', 'complete'].includes(stage),
      payment: ['dispensed', 'counseled', 'complete'].includes(stage) || (stage === 'cleared_for_dispensing' && paymentClear),
      dispensed: ['dispensed', 'counseled', 'complete'].includes(stage),
      counseled: ['counseled', 'complete'].includes(stage),
      cleared: stage === 'complete',
    };
    const currentKey =
      !completed.received ? 'received' :
      !completed.review ? 'review' :
      !completed.checked ? 'checked' :
      !completed.payment ? 'payment' :
      !completed.dispensed ? 'dispensed' :
      !completed.counseled ? 'counseled' :
      !completed.cleared ? 'cleared' :
      '';
    const stepActions: Partial<Record<WorkflowStepKey, WorkflowStepAction>> = {
      received: { label: 'Receive order', onClick: () => handleStartReview(rx) },
      review: { label: 'Check order', onClick: () => handleStartReview(rx) },
      checked: { label: 'Clear stock and safety', onClick: () => handleClearForDispense(rx) },
      payment: { label: canAccess('/payments') ? 'Collect payment' : 'Send to cashier', onClick: () => handlePaymentStep(rx) },
      dispensed: { label: t('pharmacy.dispense'), onClick: () => handleDispense(rx) },
      counseled: { label: 'Record counseling', onClick: () => handleCounsel(rx) },
      cleared: { label: 'Complete pharmacy visit', onClick: () => handleComplete(rx) },
    };
    const steps: WorkflowStep[] = [
      { key: 'received', label: 'Medication order received', note: rx.prescribedBy ? `Ordered by ${rx.prescribedBy}` : 'Waiting in pharmacy queue', done: completed.received },
      { key: 'review', label: 'Check medication order', note: 'Confirm dose, frequency, patient, allergies and interactions.', done: completed.review },
      { key: 'checked', label: 'Stock and safety clearance', note: stockOk ? `${qty} ${inv?.unit || 'unit(s)'} available` : `Stock issue: ${inv?.stockLevel ?? 0} available, ${qty} needed`, done: completed.checked },
      { key: 'payment', label: 'Receive / confirm payment', note: paymentClear ? 'Payment clear or no charge' : `${formatMoney(balance)} outstanding`, done: completed.payment },
      { key: 'dispensed', label: 'Dispense medication', note: 'Issue the full course and update inventory.', done: completed.dispensed },
      { key: 'counseled', label: 'Counsel patient', note: 'Explain dose, timing, side effects and return precautions.', done: completed.counseled },
      { key: 'cleared', label: 'Clear patient from pharmacy', note: 'Medication workflow complete.', done: completed.cleared },
    ];
    const actionableSteps = steps.map(step => ({
      ...step,
      action: step.key === currentKey ? stepActions[step.key] : undefined,
    }));

    return (
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ordered</span>
              <strong style={{ color: 'var(--text-primary)' }}>{rx.medication}</strong>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Dose</span>
              <strong style={{ color: 'var(--text-primary)' }}>{rx.dose} {rx.frequency}{rx.duration ? ` x ${rx.duration}` : ''}</strong>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Payment</span>
              <strong style={{ color: paymentClear ? 'var(--color-success)' : 'var(--color-warning)' }}>{paymentClear ? 'Clear' : formatMoney(balance)}</strong>
            </div>
            <div>
              <span className="block font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Stage</span>
              <strong style={{ color: 'var(--text-primary)' }}>{pharmacyStageLabel(stage)}</strong>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {actionableSteps.map((step, index) => {
            const isCurrent = step.key === currentKey;
            return (
              <div key={step.key} className="flex items-start gap-3 rounded-xl p-3" style={{
                background: isCurrent ? 'var(--bg-card)' : 'var(--overlay-subtle)',
                border: `1px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--border-light)'}`,
              }}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{
                  background: step.done ? 'var(--color-success)' : isCurrent ? 'var(--accent-primary)' : 'var(--overlay-medium)',
                  color: step.done || isCurrent ? '#fff' : 'var(--text-muted)',
                }}>
                  {step.done ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                    {step.done && (
                      <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.note}</p>
                  {isCurrent && step.action && (
                    <button type="button" className="btn btn-primary btn-sm mt-3" onClick={step.action.onClick}>
                      {step.action.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const headerActions: EhrCareDashboardAction[] = [];
  if (canDispense) {
    headerActions.push({ label: t('pharmacy.receiveStock'), icon: Package, onClick: () => setShowReceiveStock(true), tone: 'primary' });
  }
  headerActions.push({ label: t('pharmacy.kpiControlled'), icon: ShieldCheck, onClick: () => router.push('/controlled-substances') });
  headerActions.push({ label: t('pharmacy.stockAlerts'), icon: AlertTriangle, onClick: () => setCenterPanel(p => (p === 'stock' ? null : 'stock')), active: centerPanel === 'stock', tone: centerPanel === 'stock' ? 'primary' : 'neutral' });

  const checklist: EhrCareDashboardChecklistItem[] = [];
  if (canDispense) {
    checklist.push({ label: t('pharmacy.receiveStock'), done: criticalCount === 0 && expiredCount === 0, onClick: () => setShowReceiveStock(true) });
  }

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title={t('pharmacy.operations')}
          eyebrow={t('nav.pharmacy')}
          greetingName={currentUser?.name}
          dateLabel={dateLabel}
          tabs={[
            { key: 'all', label: t('pharmacy.viewAll'), count: rxQueue.length },
            { key: 'pending', label: t('pharmacy.pending'), count: pendingRx },
            { key: 'dispensed', label: t('pharmacy.kpiDispensed'), count: dispensedCount },
            { key: 'controlled', label: t('pharmacy.kpiControlled'), count: controlledCount },
          ]}
          activeTab={queueFilter}
          onTabChange={(k) => setQueueFilter(k as typeof queueFilter)}
          searchValue={queueSearch}
          searchPlaceholder={t('topbar.searchPlaceholder')}
          onSearchChange={setQueueSearch}
          filters={[]}
          actions={headerActions}
          hideRowList={centerPanel !== null}
          // Rows already carry `time` (order.createdAt); the default done→series1
          // split matches this pipeline exactly (dispensed/counseled/complete are
          // 'done', everything still moving through review/payment is not).
          chartSeriesNames={['Pending', 'Dispensed']}
          rows={visibleQueue.map((rx): EhrCareDashboardRow => {
            const stage = pharmacyStage(rx);
            const balance = patientBalanceFor(rx);
            const paymentDue = stage === 'cleared_for_dispensing' && !isFinanciallyCleared(balance);
            return {
              id: rx._id,
              title: rx.patientName,
              subtitle: `${rx.medication} · ${rx.dose} ${rx.frequency}${rx.duration ? ` x ${rx.duration}` : ''}`,
              meta: `${rx.prescribedBy} · ${formatTime(rx.createdAt)} · ${isFinanciallyCleared(balance) ? 'Payment clear' : `Payment due ${formatMoney(balance)}`}`,
              compactMeta: formatTime(rx.createdAt),
              time: formatTime(rx.createdAt),
              careTeam: rx.prescribedBy,
              careTeamLabel: 'Prescriber',
              status: rx.status === 'discontinued' ? 'Discontinued' : paymentDue ? 'Payment due' : pharmacyStageLabel(stage),
              statusTone: paymentDue ? 'warning' : rx.status === 'discontinued' ? 'danger' : rx.urgency === 'immediate' ? 'warning' : pharmacyStageTone(stage),
              priority: paymentDue ? formatMoney(balance) : rx.urgency === 'immediate' ? t('pharmacy.urgent') : undefined,
              room: paymentDue ? 'Cashier' : undefined,
              popupDetail: renderWorkflowPopup(rx),
            };
          })}
          autoOpenRowId={autoOpenRxId}
          metrics={[
            { label: 'Payment due', value: paymentDueCount, tone: paymentDueCount > 0 ? 'warning' : 'neutral' },
            { label: 'Ready', value: readyCount, tone: 'success' },
            { label: t('pharmacy.kpiLowStock'), value: lowStockCount, tone: 'warning' },
            { label: 'Critical Stock', value: criticalCount + expiredCount, tone: 'danger' },
          ]}
          metricsTitle={t('pharmacy.operations')}
          checklist={checklist}
          checklistTitle={t('pharmacy.quickActions')}
          emptyTitle={rxLoading ? '' : t('pharmacy.noPrescriptionsFound')}
        >
          {/* Stat panels — opened from the header toggles; the active one
              replaces the Rx queue and occupies the whole center. */}
          {centerPanel === 'pipeline' && (
            <div className="dash-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: ACCENT }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.dispensingPipeline')}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.pendingBadge', { count: pendingRx })}</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <div className="flex items-center gap-1 min-w-[600px]">
                  {[
                    { key: 'stock', label: t('pharmacy.inStock'), icon: Package, color: ACCENT, count: inStockCount },
                    { key: 'received', label: t('pharmacy.stageReceived'), icon: ClipboardList, color: ACCENT, count: reviewCount },
                    { key: 'payment', label: 'Payment', icon: Clock, color: 'var(--color-warning)', count: paymentDueCount },
                    { key: 'ready', label: 'Ready', icon: CheckCircle2, color: 'var(--color-success)', count: readyCount },
                    { key: 'dispensed', label: t('pharmacy.kpiDispensed'), icon: CheckCircle2, color: 'var(--color-success)', count: dispensedCount },
                    { key: 'reorder', label: t('pharmacy.reorderNeeded'), icon: AlertTriangle, color: 'var(--color-danger)', count: criticalCount + lowStockCount + expiredCount },
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
          )}

          {centerPanel === 'stock' && (
            <div className="dash-card rounded-2xl overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.stockAlerts')}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>{t('pharmacy.criticalBadge', { count: criticalCount + expiredCount })}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>{lowStockCount} {t('pharmacy.kpiLowStock')}</span>
                </div>
                {canDispense && (
                  <button onClick={() => setShowReceiveStock(true)} className="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90" style={{ background: 'var(--color-success)' }}>
                    <Plus className="w-3 h-3" /> {t('pharmacy.receiveStock')}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {stockAlerts.length === 0 ? (
                  <p className="text-center text-[11px] py-6" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.allStockAdequate')}</p>
                ) : stockAlerts.map((item) => {
                  const isDanger = item.status === 'critical' || item.status === 'expired';
                  const pct = Math.min(100, Math.round((item.stockLevel / Math.max(1, item.reorderLevel)) * 100));
                  const statusLabel = item.status === 'expired' ? t('pharmacy.expired') : item.status === 'critical' ? t('pharmacy.stockStatus_critical') : t('pharmacy.stockStatus_low');
                  return (
                    <div key={item._id} className="p-2.5 rounded-lg transition-all" style={{
                      background: isDanger ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                      border: `1px solid ${isDanger ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
                    }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.medicationName}</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-1" style={{
                          background: isDanger ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                          color: isDanger ? 'var(--color-danger)' : 'var(--color-warning)',
                        }}>{statusLabel}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        <span>{item.stockLevel} / {item.reorderLevel} {item.unit}</span>
                        <span style={{ color: isDanger ? 'var(--color-danger)' : 'var(--color-warning)' }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--overlay-subtle)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: isDanger ? 'var(--color-danger)' : 'var(--color-warning)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </EhrCareDashboard>
      </main>

      {/* Modals */}
      {dispenseTarget && (
        <DispenseModal
          rx={dispenseTarget.rx}
          inv={dispenseTarget.inv}
          qty={dispenseTarget.qty}
          interactions={getInteractionsForRx(dispenseTarget.rx)}
          users={users}
          currentUserId={currentUser?._id}
          witnessId={witnessId}
          onWitnessChange={setWitnessId}
          onConfirm={confirmDispense}
          onCancel={() => setDispenseTarget(null)}
          confirming={dispensing}
        />
      )}
      {showReceiveStock && (
        <ReceiveStockModal
          items={inventory.map(i => ({ name: i.medicationName, stock: i.stockLevel, unit: i.unit }))}
          onConfirm={handleReceiveStock}
          onClose={() => setShowReceiveStock(false)}
          saving={receivingStock}
        />
      )}
    </>
  );
}
