'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '@/components/Modal';
import PatientName from '@/components/PatientName';
import { Pill, AlertTriangle, Loader2, Plus, X, Printer, Calendar, ChevronRight, AlertOctagon, Filter, Download } from '@/components/icons/lucide';
import EhrListHeader, { EhrListHeaderButton, LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { usePharmacyInventory } from '@/lib/hooks/usePharmacyInventory';
import { usePatients } from '@/lib/hooks/usePatients';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { medications } from '@/data/mock';
import { classifyStockStatus } from '@/lib/services/pharmacy-inventory-service';
import { useTranslation } from '@/lib/i18n/useTranslation';
import PageInstructionCard from '@/components/PageInstructionCard';

const UNITS = ['tablets', 'vials', 'bottles', 'sachets', 'tubes', 'ampoules', 'sachet', 'ml'];

type PharmacyTab = 'queue' | 'inventory' | 'reorder' | 'expiry' | 'overview' | 'patients';

export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState<PharmacyTab>('queue');
  // Per-column filters: queue table (q*) + inventory table (medication name).
  // Category / stock-status filtering now lives in the shared header + table
  // toolbar (categoryFilter / statusFilter below) rather than per-column funnels.
  const [colFilters, setColFilters] = useState({ qPatient: '', qMedication: '', qPrescribedBy: '', iMedication: '' });
  const setColFilter = (k: string, v: string) => setColFilters(f => ({ ...f, [k]: v }));
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
  // Patients tab — which patient's prescription view is open (patient _id)
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const { globalSearch, setGlobalSearch, currentUser } = useApp();
  const searchParams = useSearchParams();
  // Deep link from a patient chart: /pharmacy?patient=<name> pre-filters via
  // the shared global search (combined with the table's own search below).
  useEffect(() => {
    const patientParam = searchParams?.get('patient');
    if (patientParam) setGlobalSearch(patientParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const { canDispense } = usePermissions();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { prescriptions: rxQueue, loading: rxLoading, dispense } = usePrescriptions();
  const { items: rawInventory, create: createInventory, update: updateInventory } = usePharmacyInventory();
  const { patients } = usePatients();
  const { users } = useUsers();
  // Controlled-substance dispense awaiting a witness sign-off.
  const [dispenseTarget, setDispenseTarget] = useState<{ rx: typeof rxQueue[number]; inv: typeof rawInventory[number]; qty: number } | null>(null);
  const [witnessId, setWitnessId] = useState('');

  // ── Shared list-page toolbar state ──
  // Table search (the listpage-table-search input) takes priority over the
  // platform-wide global search, which mainly exists now for the ?patient=
  // deep link above.
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'adequate' | 'low' | 'critical' | 'expired'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const q = tableSearch || globalSearch;
  const anyColFilter = Object.values(colFilters).some(Boolean) || !!tableSearch || statusFilter !== 'all' || categoryFilter !== 'all';
  const clearColFilters = () => {
    setColFilters({ qPatient: '', qMedication: '', qPrescribedBy: '', iMedication: '' });
    setTableSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };
  // On the Patients tab, drop back to the search results whenever the query
  // changes (the table search drives the patient lookup now).
  useEffect(() => { setSelectedPatient(null); }, [tableSearch, globalSearch]);

  // Compact per-column filter controls (funnel dropdown in each header).
  const fieldStyle = { background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', padding: '5px 9px', borderRadius: 8, fontSize: 11, width: '100%', minWidth: 0 } as const;
  // Pill-shaped select matching EhrListHeaderButton, for filter dropdowns that
  // live in the shared header's actions row alongside pill buttons.
  const pillSelectStyle = { height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' } as const;
  const textNode = (key: keyof typeof colFilters, label: string) => (
    <input type="text" autoFocus value={colFilters[key]} onChange={(e) => setColFilter(key, e.target.value)} placeholder={label} className="normal-case font-normal tracking-normal w-full" style={fieldStyle} />
  );
  const FilterTh = (label: string, key: keyof typeof colFilters, node: React.ReactNode) => (
    <th>
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap">{label}</span>
        <span ref={openFilter === key ? filterRef : null} className="relative inline-flex items-center">
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === key ? null : key); }} className="inline-flex items-center justify-center w-4 h-4 rounded transition-colors hover:bg-[var(--overlay-subtle)]" aria-label={`${label} filter`}>
            <Filter className="w-3 h-3" style={{ color: colFilters[key] ? 'var(--accent-primary)' : 'var(--text-muted)', fill: colFilters[key] ? 'var(--accent-primary)' : 'transparent' }} />
          </button>
          {openFilter === key && (
            <div className="absolute top-full right-0 mt-2 normal-case rounded-xl overflow-hidden flex flex-col" style={{ zIndex: 50, width: 220, background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg)' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <button type="button" onClick={() => setOpenFilter(null)} className="p-0.5 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                  <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {node}
                {colFilters[key] && (
                  <button type="button" onClick={() => setColFilter(key, '')} className="text-[11px] font-medium text-left px-1" style={{ color: 'var(--accent-primary)' }}>{t('nurse.filterClear')}</button>
                )}
              </div>
            </div>
          )}
        </span>
      </div>
    </th>
  );

  // Stock-in modal state
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [stockForm, setStockForm] = useState({
    medicationName: '',
    category: 'General',
    stockLevel: 0,
    unit: 'tablets',
    reorderLevel: 50,
    batchNumber: '',
    expiryDate: '',
  });

  // Augment each inventory row with a live status classification (which
  // changes over time as stock drains or the expiry date passes).
  const inventory = useMemo(() =>
    rawInventory.map(item => ({ ...item, status: classifyStockStatus(item) })),
  [rawInventory]);

  // Distinct medication categories present in the current inventory, for the
  // header's "filter by category" select.
  const categories = useMemo(() => Array.from(new Set(inventory.map(i => i.category))).sort(), [inventory]);

  // Find the inventory row for a medication at the current facility.
  const findInventoryFor = (medication: string) =>
    inventory.find(i => i.medicationName === medication && (!currentUser?.hospitalId || i.hospitalId === currentUser.hospitalId));

  // Perform the dispense: for controlled drugs record the witnessed movement
  // FIRST (it validates two distinct signatories and a non-negative balance),
  // then decrement stock by the full course and mark the prescription dispensed.
  const doDispense = async (
    rx: typeof rxQueue[number],
    inv: typeof rawInventory[number],
    qty: number,
    witness: { id: string; name: string } | null,
  ): Promise<boolean> => {
    if (inv?.controlledSchedule) {
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
        return false;
      }
    }
    try {
      const { decrementStock } = await import('@/lib/services/pharmacy-inventory-service');
      await decrementStock(rx.medication, currentUser?.hospitalId, qty);
    } catch {
      showToast(t('pharmacy.outOfStockCannotDispense'), 'error');
      return false;
    }
    try {
      await dispense(rx._id);
    } catch {
      showToast(t('pharmacy.dispenseMarkFailed'), 'error');
      return false;
    }
    const { logAudit } = await import('@/lib/services/audit-service');
    logAudit('DISPENSE_PRESCRIPTION', currentUser?._id, currentUser?.username, `Dispensed ${qty} ${inv?.unit || 'unit(s)'} ${rx.medication} to ${rx.patientName} (${rx._id})`).catch(() => {});
    showToast(t('pharmacy.dispensedMedication', { medication: rx.medication }), 'success');
    return true;
  };

  const handleDispense = async (rxId: string) => {
    const rx = rxQueue.find(r => r._id === rxId);
    if (!rx) return;
    const qty = rx.quantityToDispense || 1;
    const inv = findInventoryFor(rx.medication);
    // Stock gate: never mark dispensed unless the full course is on the shelf.
    if (!inv || inv.stockLevel < qty) {
      showToast(`Insufficient stock: ${inv?.stockLevel ?? 0} ${inv?.unit || 'unit(s)'} available, ${qty} needed for the full course.`, 'error');
      return;
    }
    // Controlled substances require a witnessing staff member before dispensing.
    if (inv.controlledSchedule || inv.requiresWitness) {
      setWitnessId('');
      setDispenseTarget({ rx, inv, qty });
      return;
    }
    await doDispense(rx, inv, qty, null);
  };

  const confirmControlledDispense = async () => {
    if (!dispenseTarget) return;
    const witness = users.find(u => u._id === witnessId);
    if (!witness) {
      showToast('Select a witnessing staff member.', 'error');
      return;
    }
    const ok = await doDispense(dispenseTarget.rx, dispenseTarget.inv, dispenseTarget.qty, { id: witness._id, name: witness.name });
    if (ok) setDispenseTarget(null);
  };

  const handleStockIn = async () => {
    if (!stockForm.medicationName.trim() || stockForm.stockLevel <= 0) {
      showToast(t('pharmacy.medAndStockRequired'), 'error');
      return;
    }
    if (!currentUser?.hospitalId) {
      showToast(t('pharmacy.noFacilityAssigned'), 'error');
      return;
    }
    try {
      await createInventory({
        hospitalId: currentUser.hospitalId,
        hospitalName: currentUser.hospitalName || '',
        medicationName: stockForm.medicationName.trim(),
        category: stockForm.category,
        stockLevel: stockForm.stockLevel,
        unit: stockForm.unit,
        reorderLevel: stockForm.reorderLevel,
        batchNumber: stockForm.batchNumber.trim() || `BN${Date.now().toString(36).toUpperCase()}`,
        expiryDate: stockForm.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        lastReceived: new Date().toISOString(),
        orgId: currentUser.orgId,
      });
      showToast(t('pharmacy.stockedMedication', { medication: stockForm.medicationName }), 'success');
      setShowStockInModal(false);
      setStockForm({ medicationName: '', category: 'General', stockLevel: 0, unit: 'tablets', reorderLevel: 50, batchNumber: '', expiryDate: '' });
    } catch (err) {
      console.error(err);
      showToast(t('pharmacy.saveStockReceiptFailed'), 'error');
    }
  };

  // Restock modal state — replaces the prompt() shortcut so users can also
  // record batch + expiry on a top-up, not just the quantity.
  const [restockTarget, setRestockTarget] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [restockForm, setRestockForm] = useState({ qty: 0, batchNumber: '', expiryDate: '' });

  const openRestock = (itemId: string) => {
    const existing = inventory.find(i => i._id === itemId);
    if (!existing) return;
    setRestockTarget({ id: existing._id, name: existing.medicationName, unit: existing.unit });
    setRestockForm({ qty: 0, batchNumber: existing.batchNumber || '', expiryDate: existing.expiryDate || '' });
  };

  const handleRestock = async () => {
    if (!restockTarget || restockForm.qty <= 0) {
      showToast(t('pharmacy.enterQtyGreaterThanZero'), 'error');
      return;
    }
    const existing = inventory.find(i => i._id === restockTarget.id);
    if (!existing) { setRestockTarget(null); return; }
    try {
      await updateInventory(restockTarget.id, {
        stockLevel: existing.stockLevel + restockForm.qty,
        lastReceived: new Date().toISOString(),
        ...(restockForm.batchNumber.trim() ? { batchNumber: restockForm.batchNumber.trim() } : {}),
        ...(restockForm.expiryDate ? { expiryDate: restockForm.expiryDate } : {}),
      });
      showToast(t('pharmacy.addedToStockToast', { qty: restockForm.qty, unit: restockTarget.unit, name: restockTarget.name }), 'success');
      setRestockTarget(null);
    } catch (err) {
      console.error(err);
      showToast(t('pharmacy.updateStockFailed'), 'error');
    }
  };

  const pendingRx = rxQueue.filter(r => r.status === 'pending').length;
  const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'critical').length;
  const totalDispensedToday = inventory.reduce((sum, i) => sum + (i.dispensedToday || 0), 0);

  const filteredInventory = inventory.filter(i => {
    if (q && !(i.medicationName.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()))) return false;
    if (colFilters.iMedication && !i.medicationName.toLowerCase().includes(colFilters.iMedication.toLowerCase())) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  const filteredQueue = rxQueue.filter(rx => {
    if (rx.status !== 'pending') return false;
    if (q && !(rx.patientName.toLowerCase().includes(q.toLowerCase()) || rx.medication.toLowerCase().includes(q.toLowerCase()) || rx.prescribedBy.toLowerCase().includes(q.toLowerCase()))) return false;
    if (colFilters.qPatient && !rx.patientName.toLowerCase().includes(colFilters.qPatient.toLowerCase())) return false;
    if (colFilters.qMedication && !rx.medication.toLowerCase().includes(colFilters.qMedication.toLowerCase())) return false;
    if (colFilters.qPrescribedBy && !rx.prescribedBy.toLowerCase().includes(colFilters.qPrescribedBy.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    // Emergency/immediate meds (given before results) float to the top of the
    // pending queue so they're dispensed first.
    const rank = (r: typeof a) => (r.status === 'pending' && r.urgency === 'immediate' ? 0 : 1);
    return rank(a) - rank(b);
  });

  // ── Derived data for the Reorder / Expiry / Overview / Patients tabs ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const daysUntil = (date?: string) =>
    date ? Math.ceil((new Date(date).getTime() - new Date(todayStr).getTime()) / 86400000) : Infinity;

  // Reorder: anything at or below its reorder level (low or critical), neediest first.
  const reorderList = useMemo(() =>
    inventory
      .filter(i => i.status === 'low' || i.status === 'critical')
      .filter(i => !q || i.medicationName.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()))
      .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
      .filter(i => statusFilter === 'all' || i.status === statusFilter)
      .sort((a, b) => a.stockLevel - b.stockLevel),
  [inventory, q, categoryFilter, statusFilter]);

  // The order quantity a reorder line should request: enough to reach double
  // its reorder level, never less than the reorder level itself.
  const orderQtyFor = (item: typeof inventory[number]) => Math.max(item.reorderLevel * 2 - item.stockLevel, item.reorderLevel);

  // Expiry (FEFO): soonest-to-expire first.
  const expiryList = useMemo(() =>
    [...inventory]
      .filter(i => !q || i.medicationName.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()))
      .filter(i => categoryFilter === 'all' || i.category === categoryFilter)
      .filter(i => statusFilter === 'all' || i.status === statusFilter)
      .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || '')),
  [inventory, q, categoryFilter, statusFilter]);
  const expiredCount = inventory.filter(i => i.status === 'expired').length;
  const expiryStatusFor = (item: typeof inventory[number]) => {
    const days = daysUntil(item.expiryDate);
    const expired = item.status === 'expired' || days <= 0;
    const soon = !expired && days <= 90;
    return { days, expired, soon };
  };

  // Overview: aggregate item counts + stock by category.
  const categoryOverview = useMemo(() => {
    const map = new Map<string, { category: string; items: number; units: number; adequate: number; low: number; critical: number; expired: number }>();
    for (const i of inventory) {
      const c = map.get(i.category) || { category: i.category, items: 0, units: 0, adequate: 0, low: 0, critical: 0, expired: 0 };
      c.items += 1;
      c.units += i.stockLevel;
      c[i.status] += 1;
      map.set(i.category, c);
    }
    // Surface the categories that need attention first: most at-risk
    // (critical + expired + low) lines, then by units held.
    return [...map.values()]
      .filter(c => !q || c.category.toLowerCase().includes(q.toLowerCase()))
      .filter(c => categoryFilter === 'all' || c.category === categoryFilter)
      .sort((a, b) => {
        const riskA = a.critical + a.expired + a.low;
        const riskB = b.critical + b.expired + b.low;
        return riskB - riskA || b.units - a.units;
      });
  }, [inventory, q, categoryFilter]);
  const totalUnits = inventory.reduce((s, i) => s + i.stockLevel, 0);

  // Patients: search the real patient registry (name / hospital number / phone),
  // not just people who already have a prescription queued — so any patient is findable.
  const patientName = (p: typeof patients[number]) => [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ');
  const rxFor = (p: typeof patients[number]) =>
    rxQueue.filter(r => r.patientId === p._id || r.patientName === patientName(p));
  const patientResults = useMemo(() => {
    const query = q.trim().toLowerCase();
    return patients
      .filter(p => !query ||
        patientName(p).toLowerCase().includes(query) ||
        (p.hospitalNumber || '').toLowerCase().includes(query) ||
        (p.phone || '').toLowerCase().includes(query))
      .sort((a, b) => patientName(a).localeCompare(patientName(b)))
      .slice(0, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, q, rxQueue]);
  const activePatient = selectedPatient ? patients.find(p => p._id === selectedPatient) : null;
  const activeRxs = activePatient ? rxFor(activePatient) : [];

  // Print a reorder / purchase order from the items currently needing restock.
  const handlePrintReorder = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = reorderList.map(i =>
      `<tr><td>${i.medicationName}</td><td>${i.category}</td><td>${i.stockLevel} ${i.unit}</td><td>${i.reorderLevel}</td><td>${orderQtyFor(i)}</td></tr>`
    ).join('');
    w.document.write(`<html><head><title>${t('pharmacy.purchaseOrder')}</title><style>
      body{font-family:system-ui,sans-serif;padding:30px;} h1{font-size:18px;margin-bottom:4px;} h2{font-size:13px;color:#666;margin-bottom:18px;}
      table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px;} th{background:#f3f4f6;}
      .footer{margin-top:36px;font-size:12px;color:#888;}
    </style></head><body>
      <h1>${t('pharmacy.purchaseOrderRestock')}</h1>
      <h2>${currentUser?.hospitalName || ''} · ${new Date().toLocaleDateString('en-GB')}</h2>
      <table><thead><tr>
        <th>${t('pharmacy.medication')}</th><th>${t('pharmacy.category')}</th><th>${t('pharmacy.currentStock')}</th><th>${t('pharmacy.reorderLevel')}</th><th>${t('pharmacy.orderQty')}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">${t('pharmacy.authorizedBy')}: _____________________ &nbsp;&nbsp; ${t('pharmacy.dateLabel')}: _____________________</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  // Export the rows currently visible on the active tab to CSV — mirrors the
  // patients/appointments list-page "Download" toolbar action.
  const handleDownloadCsv = () => {
    let header: string[] = [];
    let rows: (string | number)[][] = [];
    switch (activeTab) {
      case 'queue':
        header = [t('pharmacy.patient'), t('pharmacy.medication'), t('pharmacy.dosage'), t('pharmacy.prescribedBy'), t('pharmacy.time'), t('pharmacy.statusLabel')];
        rows = filteredQueue.map(rx => [
          rx.patientName,
          rx.medication,
          `${rx.dose} ${rx.frequency}${rx.duration ? ` x ${rx.duration}` : ''}`,
          rx.prescribedBy,
          rx.createdAt ? new Date(rx.createdAt).toLocaleString('en-GB') : '',
          rx.status === 'pending' ? t('pharmacy.pending') : t('pharmacy.dispensed'),
        ]);
        break;
      case 'inventory':
        header = [t('pharmacy.medication'), t('pharmacy.category'), t('pharmacy.stockLabel'), t('pharmacy.reorderLevel'), t('pharmacy.statusLabel'), t('pharmacy.batchLabel'), t('pharmacy.expiry'), t('pharmacy.kpiDispensedToday')];
        rows = filteredInventory.map(i => [
          i.medicationName,
          i.category,
          `${i.stockLevel} ${i.unit}`,
          `${i.reorderLevel} ${i.unit}`,
          i.status === 'adequate' ? t('pharmacy.inStock') : t(`pharmacy.invStatus_${i.status}`),
          i.batchNumber,
          i.expiryDate,
          i.dispensedToday,
        ]);
        break;
      case 'reorder':
        header = [t('pharmacy.medication'), t('pharmacy.category'), t('pharmacy.stockLabel'), t('pharmacy.reorderLevel'), t('pharmacy.orderQty'), t('pharmacy.statusLabel')];
        rows = reorderList.map(i => [
          i.medicationName, i.category, `${i.stockLevel} ${i.unit}`, i.reorderLevel,
          `${orderQtyFor(i)} ${i.unit}`, t(`pharmacy.invStatus_${i.status}`),
        ]);
        break;
      case 'expiry':
        header = [t('pharmacy.medication'), t('pharmacy.batchLabel'), t('pharmacy.stockLabel'), t('pharmacy.expiry'), t('pharmacy.statusLabel')];
        rows = expiryList.map(i => {
          const { days, expired } = expiryStatusFor(i);
          return [
            i.medicationName, i.batchNumber, `${i.stockLevel} ${i.unit}`, i.expiryDate,
            expired ? t('pharmacy.expired') : t('pharmacy.daysLeft', { count: days }),
          ];
        });
        break;
      case 'overview':
        header = [t('pharmacy.category'), t('pharmacy.action'), t('pharmacy.stockLabel'), 'Adequate', 'Low', 'Critical', t('pharmacy.kpiExpired')];
        rows = categoryOverview.map(c => [c.category, c.items, c.units, c.adequate, c.low, c.critical, c.expired]);
        break;
      case 'patients':
        header = [t('pharmacy.patient'), t('patients.colHospitalNo'), 'Prescriptions on record', t('pharmacy.pending')];
        rows = patientResults.map(p => {
          const rxs = rxFor(p);
          return [patientName(p), p.hospitalNumber || '', rxs.length, rxs.filter(r => r.status === 'pending').length];
        });
        break;
    }
    const csv = [header, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmacy-${activeTab}-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabsConfig: { key: PharmacyTab; label: string }[] = [
    { key: 'queue', label: `${t('pharmacy.prescriptionQueue')} (${pendingRx})` },
    { key: 'overview', label: t('pharmacy.inventoryOverview') },
    { key: 'inventory', label: `${t('pharmacy.inventory')} (${inventory.length})${lowStock > 0 ? ` · ${lowStock} ${t('pharmacy.kpiLowStockItems')}` : ''}` },
    { key: 'reorder', label: `${t('pharmacy.reorderNeeded')} (${reorderList.length})` },
    { key: 'expiry', label: `${t('pharmacy.expiryTracker')}${expiredCount > 0 ? ` · ${expiredCount} ${t('pharmacy.kpiExpired')}` : ''}` },
    { key: 'patients', label: t('pharmacy.patientMedHistory') },
  ];

  const sectionTitles: Record<PharmacyTab, string> = {
    queue: t('pharmacy.prescriptionQueue'),
    overview: t('pharmacy.inventoryOverview'),
    inventory: t('pharmacy.medicationInventory'),
    reorder: t('pharmacy.reorderNeeded'),
    expiry: t('pharmacy.expiryTracker'),
    patients: t('pharmacy.patientMedHistory'),
  };

  return (
    <main className="page-container page-enter">
      <PageInstructionCard />

      {/* ═══ Table card ═══ */}
      <div className="dash-card overflow-hidden">
        <EhrListHeader
          title={sectionTitles[activeTab]}
          stats={[
            { label: t('pharmacy.prescriptionQueue'), value: rxQueue.length, color: LIST_STAT_COLORS.muted },
            { label: t('pharmacy.pending'), value: pendingRx, color: LIST_STAT_COLORS.blue },
            { label: t('pharmacy.kpiDispensedToday'), value: totalDispensedToday, color: LIST_STAT_COLORS.amber },
            { label: 'Low stock', value: lowStock, color: LIST_STAT_COLORS.green },
          ]}
          search={!(activeTab === 'patients' && activePatient) ? { value: tableSearch, onChange: setTableSearch, placeholder: 'Filter table', ariaLabel: 'Filter table' } : undefined}
          actions={
            <>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                aria-label="Filter by medication category"
                style={pillSelectStyle}
              >
                <option value="all">Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {!(activeTab === 'patients' && activePatient) && (activeTab === 'inventory' || activeTab === 'reorder' || activeTab === 'expiry') && (
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  aria-label="Filter by stock status"
                  style={pillSelectStyle}
                >
                  <option value="all">Status</option>
                  <option value="adequate">{t('pharmacy.inStock')}</option>
                  <option value="low">{t('pharmacy.invStatus_low')}</option>
                  <option value="critical">{t('pharmacy.invStatus_critical')}</option>
                  <option value="expired">{t('pharmacy.invStatus_expired')}</option>
                </select>
              )}
              {anyColFilter && (
                <EhrListHeaderButton onClick={clearColFilters} ariaLabel={t('nurse.clearAllFilters')}>
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('nurse.clearAllFilters')}</span>
                </EhrListHeaderButton>
              )}
              {!(activeTab === 'patients' && activePatient) && activeTab === 'reorder' && canDispense && reorderList.length > 0 && (
                <button type="button" onClick={handlePrintReorder} className="btn btn-primary btn-sm" style={{ gap: 6, height: 38 }}>
                  <Printer size={15} /> {t('pharmacy.generateOrder')}
                </button>
              )}
              {!(activeTab === 'patients' && activePatient) && (
                <EhrListHeaderButton onClick={handleDownloadCsv}>
                  <Download size={15} /> Download
                </EhrListHeaderButton>
              )}
              {canDispense && (
                <button onClick={() => setShowStockInModal(true)} className="btn btn-primary" style={{ height: 38, whiteSpace: 'nowrap' }}>
                  <Plus className="w-4 h-4" /> {t('pharmacy.receiveStock')}
                </button>
              )}
            </>
          }
        />
        <div className="flex gap-0 border-b overflow-x-auto" style={{ borderColor: 'var(--border-light)' }}>
          {tabsConfig.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeTab === tab.key ? 'tab-active' : ''}`}
              style={{ color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'queue' && (
          rxLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table" style={{ minWidth: 840 }}>
                <thead>
                  <tr>
                    {FilterTh(t('pharmacy.patient'), 'qPatient', textNode('qPatient', t('pharmacy.patient')))}
                    {FilterTh(t('pharmacy.medication'), 'qMedication', textNode('qMedication', t('pharmacy.medication')))}
                    <th>{t('pharmacy.dosage')}</th>
                    {FilterTh(t('pharmacy.prescribedBy'), 'qPrescribedBy', textNode('qPrescribedBy', t('pharmacy.prescribedBy')))}
                    <th>{t('pharmacy.time')}</th>
                    <th>{t('pharmacy.statusLabel')}</th>
                    <th>{t('pharmacy.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t('pharmacy.noPrescriptionsFound')}
                      </td>
                    </tr>
                  ) : filteredQueue.map(rx => (
                    <tr key={rx._id} className="cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => { if (rx.patientId) router.push(`/patients/${rx.patientId}`); }}>
                      <td><PatientName patientId={rx.patientId} name={rx.patientName} nameClassName="text-sm font-medium" /></td>
                      <td className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className="icon-box-sm">
                            <Pill className="w-3.5 h-3.5" style={{ color: '#2191D0' }} />
                          </div>
                          {rx.medication}
                          {rx.urgency === 'immediate' && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,119,6,0.12)', color: 'var(--color-warning)' }}>Immediate</span>
                          )}
                        </div>
                      </td>
                      <td className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {rx.dose} {rx.frequency} {rx.duration ? `x ${rx.duration}` : ''}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rx.prescribedBy}</td>
                      <td className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex items-center gap-1.5">
                          {rx.createdAt ? new Date(rx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${rx.status === 'pending' ? 'badge-warning' : 'badge-normal'}`}>
                          {rx.status === 'pending' ? t('pharmacy.pending') : t('pharmacy.dispensed')}
                        </span>
                      </td>
                      <td>
                        {rx.status === 'pending' && canDispense && (
                          <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                            onClick={(e) => { e.stopPropagation(); handleDispense(rx._id); }}>{t('pharmacy.dispense')}</button>
                        )}
                        {rx.status === 'pending' && !canDispense && (
                          <span className="text-[10px] font-medium px-2 py-1 rounded" style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)' }}>{t('pharmacy.pharmacistOnly')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'inventory' && (
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  {FilterTh(t('pharmacy.medication'), 'iMedication', textNode('iMedication', t('pharmacy.medication')))}
                  <th>{t('pharmacy.category')}</th>
                  <th>{t('pharmacy.stockLabel')}</th>
                  <th>{t('pharmacy.reorderLevel')}</th>
                  <th>{t('pharmacy.statusLabel')}</th>
                  <th>{t('pharmacy.batchLabel')}</th>
                  <th>{t('pharmacy.expiry')}</th>
                  <th>{t('pharmacy.kpiDispensedToday')}</th>
                  {canDispense && <th>{t('pharmacy.action')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={canDispense ? 9 : 8} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('pharmacy.noInventoryItems')}
                    </td>
                  </tr>
                ) : filteredInventory.map(item => (
                  <tr key={item._id}>
                    <td className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <div className="icon-box-sm">
                          {item.status === 'expired' || item.status === 'critical'
                            ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                            : <Pill className="w-3.5 h-3.5" style={{ color: item.status === 'low' ? '#F59E0B' : '#2191D0' }} />
                          }
                        </div>
                        {item.medicationName}
                      </div>
                    </td>
                    <td><span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--overlay-medium)', color: 'var(--text-secondary)' }}>{item.category}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: item.status === 'critical' ? 'var(--color-danger)' : item.status === 'low' ? 'var(--color-warning)' : 'inherit' }}>
                          {item.stockLevel}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.unit}</span>
                      </div>
                      <div className="w-20 h-1.5 rounded-full mt-1" style={{ background: 'var(--overlay-medium)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(100, (item.stockLevel / Math.max(1, item.reorderLevel * 3)) * 100)}%`,
                          background: item.status === 'critical' ? 'var(--color-danger)' : item.status === 'low' ? 'var(--color-warning)' : 'var(--color-success)',
                        }} />
                      </div>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.reorderLevel} {item.unit}</td>
                    <td>
                      <span className={`badge text-[10px] ${
                        item.status === 'adequate' ? 'badge-normal' :
                        item.status === 'low' ? 'badge-warning' :
                        'badge-emergency'
                      }`}>
                        {item.status === 'adequate' ? t('pharmacy.inStock') : t(`pharmacy.invStatus_${item.status}`)}
                      </span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                    <td className="text-xs" style={{ color: item.status === 'expired' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                      {item.expiryDate}
                    </td>
                    <td className="text-center font-semibold text-sm">{item.dispensedToday}</td>
                    {canDispense && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openRestock(item._id)}>+ {t('pharmacy.receive')}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reorder' && (
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>{t('pharmacy.medication')}</th>
                  <th>{t('pharmacy.category')}</th>
                  <th>{t('pharmacy.stockLabel')}</th>
                  <th>{t('pharmacy.reorderLevel')}</th>
                  <th>{t('pharmacy.orderQty')}</th>
                  <th>{t('pharmacy.statusLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {reorderList.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.allStockAdequate')}</td></tr>
                ) : reorderList.map(item => (
                  <tr key={item._id}>
                    <td className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <div className="icon-box-sm">
                          {item.status === 'critical'
                            ? <AlertOctagon className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                            : <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />}
                        </div>
                        {item.medicationName}
                      </div>
                    </td>
                    <td><span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--overlay-medium)', color: 'var(--text-secondary)' }}>{item.category}</span></td>
                    <td className="font-semibold text-sm" style={{ color: item.status === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{item.stockLevel} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{item.unit}</span></td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.reorderLevel}</td>
                    <td className="font-semibold text-sm" style={{ color: 'var(--accent-primary)' }}>{orderQtyFor(item)} {item.unit}</td>
                    <td>
                      <span className={`badge text-[10px] ${item.status === 'low' ? 'badge-warning' : 'badge-emergency'}`}>
                        {t(`pharmacy.invStatus_${item.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'expiry' && (
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>{t('pharmacy.medication')}</th>
                  <th>{t('pharmacy.batchLabel')}</th>
                  <th>{t('pharmacy.stockLabel')}</th>
                  <th>{t('pharmacy.expiry')}</th>
                  <th>{t('pharmacy.statusLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {expiryList.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.noInventoryItems')}</td></tr>
                ) : expiryList.map(item => {
                  const { days, expired, soon } = expiryStatusFor(item);
                  return (
                    <tr key={item._id}>
                      <td className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="icon-box-sm">
                            <Calendar className="w-3.5 h-3.5" style={{ color: expired ? 'var(--color-danger)' : soon ? '#F59E0B' : '#2191D0' }} />
                          </div>
                          {item.medicationName}
                        </div>
                      </td>
                      <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.batchNumber}</td>
                      <td className="text-sm">{item.stockLevel} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.unit}</span></td>
                      <td className="text-xs" style={{ color: expired ? 'var(--color-danger)' : 'var(--text-muted)' }}>{item.expiryDate}</td>
                      <td>
                        <span className={`badge text-[10px] ${expired ? 'badge-emergency' : soon ? 'badge-warning' : 'badge-normal'}`}>
                          {expired ? t('pharmacy.expired') : t('pharmacy.daysLeft', { count: days })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'overview' && (
          categoryOverview.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.noInventoryItems')}</p>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-3 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                {totalUnits.toLocaleString()} {t('pharmacy.kpiTotalMeds')}
              </div>
              {categoryOverview.map(cat => {
                const okPct = cat.items ? Math.round((cat.adequate / cat.items) * 100) : 0;
                return (
                  <div key={cat.category} className="rounded-xl p-3" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{cat.category}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                        background: okPct > 80 ? 'rgba(74,222,128,0.15)' : okPct > 60 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                        color: okPct > 80 ? 'var(--color-success)' : okPct > 60 ? 'var(--color-warning)' : '#F87171',
                      }}>{okPct}%</span>
                    </div>
                    <p className="text-lg font-bold mb-1.5">{cat.units.toLocaleString()} <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.stockLabel')}</span></p>
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border-light)' }}>
                      <div className="h-full rounded-full" style={{ width: `${okPct}%`, background: okPct > 80 ? 'var(--color-success)' : okPct > 60 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                    </div>
                    <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--color-success)' }}>{t('pharmacy.catOk', { count: cat.adequate })}</span>
                      <span style={{ color: 'var(--color-warning)' }}>{t('pharmacy.catLow', { count: cat.low })}</span>
                      <span style={{ color: '#F87171' }}>{t('pharmacy.catCrit', { count: cat.critical + cat.expired })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'patients' && (
          activePatient ? (
            <>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div>
                  <p className="text-sm font-semibold">{patientName(activePatient)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {activePatient.hospitalNumber} · {t('pharmacy.prescriptionsOnRecord', { count: activeRxs.length })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/patients/${activePatient._id}`)}>{t('pharmacy.viewAll')}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPatient(null)}>← {t('pharmacy.patientMedHistory')}</button>
                </div>
              </div>
              <hr className="section-divider" />
              {activeRxs.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.noPrescriptionsFound')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table" style={{ minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th>{t('pharmacy.medication')}</th>
                        <th>{t('pharmacy.dosage')}</th>
                        <th>{t('pharmacy.prescribedBy')}</th>
                        <th>{t('pharmacy.time')}</th>
                        <th>{t('pharmacy.statusLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRxs.map(rx => (
                        <tr key={rx._id}>
                          <td className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              <div className="icon-box-sm">
                                <Pill className="w-3.5 h-3.5" style={{ color: '#2191D0' }} />
                              </div>
                              {rx.medication}
                            </div>
                          </td>
                          <td className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{rx.dose} {rx.frequency} {rx.duration ? `x ${rx.duration}` : ''}</td>
                          <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rx.prescribedBy}</td>
                          <td className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{rx.createdAt ? new Date(rx.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                          <td>
                            <span className={`badge text-[10px] ${rx.status === 'pending' ? 'badge-warning' : 'badge-normal'}`}>
                              {rx.status === 'pending' ? t('pharmacy.pending') : t('pharmacy.dispensed')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            patientResults.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                {q ? t('pharmacy.noPatientsFound', { query: q }) : t('pharmacy.searchPatientPlaceholder')}
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {patientResults.map(p => {
                  const rxs = rxFor(p);
                  const pending = rxs.filter(r => r.status === 'pending').length;
                  return (
                    <button key={p._id} onClick={() => setSelectedPatient(p._id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--table-row-hover)]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{patientName(p)}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {p.hospitalNumber}{rxs.length ? ` · ${t('pharmacy.prescriptionsOnRecord', { count: rxs.length })}` : ''}
                        </p>
                      </div>
                      {pending > 0 && (
                        <span className="badge badge-warning text-[10px]">{t('pharmacy.pendingBadge', { count: pending })}</span>
                      )}
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  );
                })}
              </div>
            )
          )
        )}
      </div>

      {/* Stock-in modal */}
      {showStockInModal && (
        <Modal onClose={() => setShowStockInModal(false)}>
          <div className="modal-content card-elevated p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-box-sm">
                  <Pill className="w-4 h-4" style={{ color: '#2191D0' }} />
                </div>
                <h3 className="text-base font-semibold">{t('pharmacy.receiveStock')}</h3>
              </div>
              <button onClick={() => setShowStockInModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <hr className="section-divider" />
            <div className="data-row-divider-sm">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.medication')}</label>
                <input
                  list="medication-list"
                  type="text"
                  value={stockForm.medicationName}
                  onChange={e => {
                    const med = medications.find(m => m.name === e.target.value);
                    setStockForm({ ...stockForm, medicationName: e.target.value, category: med?.category || stockForm.category });
                  }}
                  placeholder={t('pharmacy.medicationPlaceholder')}
                />
                <datalist id="medication-list">
                  {medications.map(m => <option key={m.name} value={m.name}>{m.category}</option>)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.quantity')}</label>
                  <input type="number" min={1} value={stockForm.stockLevel || ''} onChange={e => setStockForm({ ...stockForm, stockLevel: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.unit')}</label>
                  <select value={stockForm.unit} onChange={e => setStockForm({ ...stockForm, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.reorderLevel')}</label>
                  <input type="number" min={0} value={stockForm.reorderLevel} onChange={e => setStockForm({ ...stockForm, reorderLevel: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.batchNumber')}</label>
                  <input type="text" value={stockForm.batchNumber} onChange={e => setStockForm({ ...stockForm, batchNumber: e.target.value })} placeholder={t('pharmacy.optional')} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.expiryDate')}</label>
                <input type="date" value={stockForm.expiryDate} onChange={e => setStockForm({ ...stockForm, expiryDate: e.target.value })} />
              </div>
            </div>
            <hr className="section-divider" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowStockInModal(false)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
              <button onClick={handleStockIn} className="btn btn-primary flex-1">{t('pharmacy.saveStockReceipt')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Restock modal — top up an existing inventory line with quantity + optional batch/expiry */}
      {restockTarget && (
        <Modal onClose={() => setRestockTarget(null)}>
          <div className="modal-content card-elevated p-6 max-w-md w-full" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">{t('pharmacy.receiveStock')}</h3>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{restockTarget.name}</p>
              </div>
              <button onClick={() => setRestockTarget(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  {t('pharmacy.quantityReceived', { unit: restockTarget.unit })} <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={restockForm.qty || ''}
                  onChange={e => setRestockForm({ ...restockForm, qty: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.batchNo')}</label>
                  <input
                    type="text"
                    value={restockForm.batchNumber}
                    onChange={e => setRestockForm({ ...restockForm, batchNumber: e.target.value })}
                    placeholder={t('pharmacy.autoGenerate')}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.expiryDate')}</label>
                  <input
                    type="date"
                    value={restockForm.expiryDate}
                    onChange={e => setRestockForm({ ...restockForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('pharmacy.leaveBlankKeepExisting')}
              </p>
            </div>
            <hr className="section-divider" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setRestockTarget(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
              <button onClick={handleRestock} className="btn btn-primary flex-1">{t('pharmacy.addToStock')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Controlled-substance witness sign-off before dispensing */}
      {dispenseTarget && (
        <Modal onClose={() => setDispenseTarget(null)}>
          <div className="modal-panel modal-panel--sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Controlled substance — witness required</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Dispensing <strong>{dispenseTarget.qty} {dispenseTarget.inv.unit}</strong> of <strong>{dispenseTarget.inv.medicationName}</strong> (Schedule {dispenseTarget.inv.controlledSchedule}) to {dispenseTarget.rx.patientName}. A second staff member must witness this movement.
            </p>
            <label>Witnessing staff</label>
            <select value={witnessId} onChange={e => setWitnessId(e.target.value)}>
              <option value="">Select witness…</option>
              {users.filter(u => u._id !== currentUser?._id).map(u => (
                <option key={u._id} value={u._id}>{u.name} — {u.role}</option>
              ))}
            </select>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-secondary flex-1" onClick={() => setDispenseTarget(null)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={confirmControlledDispense} disabled={!witnessId}>Confirm &amp; dispense</button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
