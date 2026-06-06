'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Pill, AlertTriangle, Package, Clock, ShieldCheck, Archive,
  MessageSquare, Activity, Radio, Zap, Wifi, ChevronRight,
  Search, ClipboardList, Send, TrendingDown, CheckCircle2, XCircle,
  AlertOctagon, Calendar, User, History, Printer, Trash2, X, Check,
  ShoppingCart, FileText,
} from '@/components/icons/lucide';

const ACCENT = 'var(--accent-primary)';

// Live activity ticker is a demo flourish only — gated off in production so
// users do not see invented prescriptions / dispense events.
const PHARMACY_LIVE_FEED_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const EVENT_TYPES = [
  { type: 'rx_received', label: 'Prescription Received', color: '#5CB8A8', icon: ClipboardList },
  { type: 'dispensed', label: 'Medication Dispensed', color: 'var(--color-success)', icon: CheckCircle2 },
  { type: 'stock_alert', label: 'Stock Alert Triggered', color: '#F87171', icon: AlertTriangle },
  { type: 'controlled', label: 'Controlled Substance Logged', color: '#A855F7', icon: ShieldCheck },
  { type: 'expired', label: 'Expired Item Flagged', color: 'var(--color-danger)', icon: XCircle },
  { type: 'pickup', label: 'Awaiting Patient Pickup', color: ACCENT, icon: Clock },
  { type: 'restock', label: 'Restock Order Placed', color: '#5CB8A8', icon: Package },
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
  LOW: { bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', text: '#5CB8A8' },
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

// ===================== EXPIRY DATA =====================
interface ExpiryItem {
  id: string;
  name: string;
  batch: string;
  stock: number;
  unit: string;
  expiryDate: string;
}

const today = new Date();
const EXPIRY_DATA: ExpiryItem[] = [
  { id: 'exp-1', name: 'Amoxicillin 250mg Susp', batch: 'AMX-2024-001', stock: 15, unit: 'bottles', expiryDate: new Date(today.getTime() - 15 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-2', name: 'Paracetamol Syrup', batch: 'PCM-2024-033', stock: 8, unit: 'bottles', expiryDate: new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-3', name: 'ORS Sachets (Lot A)', batch: 'ORS-2024-100', stock: 30, unit: 'sachets', expiryDate: new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-4', name: 'Ferrous Sulfate', batch: 'FES-2024-044', stock: 100, unit: 'tablets', expiryDate: new Date(today.getTime() + 25 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-5', name: 'Ciprofloxacin 500mg', batch: 'CIP-2024-012', stock: 60, unit: 'tablets', expiryDate: new Date(today.getTime() + 45 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-6', name: 'Diazepam 5mg', batch: 'DZP-2024-007', stock: 20, unit: 'ampoules', expiryDate: new Date(today.getTime() + 75 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-7', name: 'Insulin Glargine', batch: 'INS-2024-055', stock: 5, unit: 'vials', expiryDate: new Date(today.getTime() + 120 * 86400000).toISOString().slice(0, 10) },
  { id: 'exp-8', name: 'Morphine 10mg', batch: 'MOR-2024-009', stock: 10, unit: 'ampoules', expiryDate: new Date(today.getTime() + 200 * 86400000).toISOString().slice(0, 10) },
];

function getExpiryStatus(expiryDate: string): { expired: boolean; days: number; color: string; bgColor: string } {
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return { expired: true, days: diffDays, color: 'var(--color-danger)', bgColor: 'rgba(239,68,68,0.1)' };
  if (diffDays <= 30) return { expired: false, days: diffDays, color: '#F97316', bgColor: 'rgba(249,115,22,0.1)' };
  if (diffDays <= 90) return { expired: false, days: diffDays, color: 'var(--color-warning)', bgColor: 'rgba(251,191,36,0.1)' };
  return { expired: false, days: diffDays, color: 'var(--color-success)', bgColor: 'rgba(74,222,128,0.1)' };
}

// ===================== PATIENT MEDICATION HISTORY =====================
interface PatientHistoryEntry {
  date: string;
  medication: string;
  dose: string;
  prescriber: string;
  status: 'dispensed' | 'pending' | 'awaiting_pickup';
}

const PATIENT_HISTORY: Record<string, PatientHistoryEntry[]> = {
  'Deng Mabior': [
    { date: '2026-03-12', medication: 'Artemether-Lumefantrine', dose: '80/480mg BD x 3d', prescriber: 'Dr. James Wani', status: 'pending' },
    { date: '2026-02-20', medication: 'Paracetamol 1g', dose: '1g QDS x 3d', prescriber: 'Dr. Achol Mayen', status: 'dispensed' },
    { date: '2026-01-10', medication: 'Amoxicillin 500mg', dose: '500mg TDS x 7d', prescriber: 'Dr. James Wani', status: 'dispensed' },
    { date: '2025-11-05', medication: 'ORS Sachets', dose: '1 sachet per litre x 3d', prescriber: 'CO Deng Mabior', status: 'dispensed' },
  ],
  'Nyamal Koang': [
    { date: '2026-03-12', medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30d', prescriber: 'Dr. Achol Mayen', status: 'pending' },
    { date: '2026-02-10', medication: 'Ferrous Sulfate + Folic Acid', dose: '200mg OD x 30d', prescriber: 'Dr. Achol Mayen', status: 'dispensed' },
    { date: '2025-12-15', medication: 'Metformin 500mg', dose: '500mg BD x 30d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
  ],
  'Gatluak Ruot': [
    { date: '2026-03-12', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
    { date: '2025-12-12', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
    { date: '2025-09-12', medication: 'TDF/3TC/DTG', dose: '300/300/50mg OD x 90d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
  ],
  'Rose Gbudue': [
    { date: '2026-03-12', medication: 'Metformin', dose: '500mg BD x 30d', prescriber: 'CO Deng Mabior', status: 'pending' },
    { date: '2026-02-10', medication: 'Metformin', dose: '500mg BD x 30d', prescriber: 'CO Deng Mabior', status: 'dispensed' },
    { date: '2026-01-08', medication: 'Ciprofloxacin 500mg', dose: '500mg BD x 5d', prescriber: 'Dr. Nyamal Koang', status: 'dispensed' },
  ],
  'Kuol Akot': [
    { date: '2026-03-12', medication: 'Morphine 10mg', dose: 'PRN q4h x 3d', prescriber: 'Dr. Nyamal Koang', status: 'pending' },
    { date: '2026-03-01', medication: 'Paracetamol 1g', dose: '1g QDS x 5d', prescriber: 'Dr. Nyamal Koang', status: 'dispensed' },
  ],
  'Achol Mayen': [
    { date: '2026-03-12', medication: 'Amoxicillin', dose: '500mg TDS x 7d', prescriber: 'Dr. James Wani', status: 'awaiting_pickup' },
    { date: '2026-01-20', medication: 'Artemether-Lumefantrine', dose: '80/480mg BD x 3d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
  ],
  'Majok Chol': [
    { date: '2026-03-12', medication: 'Insulin Glargine', dose: '20 IU OD', prescriber: 'Dr. TamamHealth Ladu', status: 'pending' },
    { date: '2026-02-12', medication: 'Insulin Glargine', dose: '18 IU OD', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
    { date: '2026-01-12', medication: 'Metformin 500mg', dose: '500mg BD x 30d', prescriber: 'Dr. TamamHealth Ladu', status: 'dispensed' },
  ],
  'Ayen Dut': [
    { date: '2026-02-28', medication: 'Salbutamol Inhaler', dose: '2 puffs PRN', prescriber: 'Dr. James Wani', status: 'dispensed' },
  ],
  'Ladu Tombe': [
    { date: '2026-02-15', medication: 'Paracetamol 1g', dose: '1g QDS x 3d', prescriber: 'CO Deng Mabior', status: 'dispensed' },
  ],
  'Nyandit Dut': [
    { date: '2026-03-05', medication: 'Ferrous Sulfate', dose: '200mg OD x 30d', prescriber: 'Dr. Achol Mayen', status: 'dispensed' },
  ],
};

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

const INITIAL_STOCK: StockItem[] = [
  { name: 'Artemether-Lumefantrine', stock: 12, reorder: 100, unit: 'packs', status: 'critical' },
  { name: 'ORS Sachets', stock: 28, reorder: 200, unit: 'sachets', status: 'critical' },
  { name: 'Amoxicillin 250mg Susp', stock: 45, reorder: 80, unit: 'bottles', status: 'low' },
  { name: 'Diazepam 5mg', stock: 8, reorder: 30, unit: 'ampoules', status: 'critical' },
  { name: 'Ferrous Sulfate', stock: 67, reorder: 100, unit: 'tablets', status: 'low' },
  { name: 'Paracetamol Syrup', stock: 15, reorder: 50, unit: 'bottles', status: 'critical' },
];

const INVENTORY_OVERVIEW = [
  { category: 'Antimalarials', total: 340, adequate: 280, low: 48, critical: 12 },
  { category: 'Antibiotics', total: 520, adequate: 410, low: 85, critical: 25 },
  { category: 'ARVs', total: 180, adequate: 165, low: 15, critical: 0 },
  { category: 'Analgesics', total: 290, adequate: 245, low: 30, critical: 15 },
  { category: 'Controlled', total: 45, adequate: 32, low: 8, critical: 5 },
  { category: 'Maternal Health', total: 160, adequate: 130, low: 22, critical: 8 },
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
      background: '#065F46', color: '#D1FAE5', border: '1px solid #10B981',
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

// ===================== PURCHASE ORDER MODAL =====================
function PurchaseOrderModal({ items, onClose }: {
  items: StockItem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${t('pharmacy.purchaseOrder')}</title><style>
      body { font-family: Arial, sans-serif; padding: 30px; }
      h1 { font-size: 18px; margin-bottom: 5px; }
      h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid var(--border-medium); padding: 8px; text-align: left; font-size: 13px; color: var(--text-primary); }
      th { background: var(--overlay-subtle); font-weight: bold; }
      .footer { margin-top: 40px; font-size: 12px; color: #888; }
    </style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="dash-card rounded-2xl p-5 w-full max-w-lg mx-4" style={{
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: ACCENT }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.purchaseOrder')}</h3>
          </div>
          <button onClick={onClose} aria-label={t('action.close')}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <div ref={printRef}>
          <h1>{t('pharmacy.purchaseOrderRestock')}</h1>
          <h2>{t('pharmacy.dateLabel')}: {new Date().toLocaleDateString('en-GB')}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '6px', textAlign: 'left' }}>{t('pharmacy.medication')}</th>
                <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '6px', textAlign: 'left' }}>{t('pharmacy.currentStock')}</th>
                <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '6px', textAlign: 'left' }}>{t('pharmacy.orderQty')}</th>
                <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '6px', textAlign: 'left' }}>{t('pharmacy.unit')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ borderBottom: '1px solid var(--border-medium)', padding: '6px', color: 'var(--text-primary)' }}>{item.name}</td>
                  <td style={{ borderBottom: '1px solid var(--border-medium)', padding: '6px', color: 'var(--text-primary)' }}>{item.stock}</td>
                  <td style={{ borderBottom: '1px solid var(--border-medium)', padding: '6px', color: 'var(--text-primary)' }}>{item.reorder * 2}</td>
                  <td style={{ borderBottom: '1px solid var(--border-medium)', padding: '6px', color: 'var(--text-primary)' }}>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="footer" style={{ marginTop: '20px', fontSize: '11px', color: '#888' }}>
            {t('pharmacy.authorizedBy')}: _____________________ {t('pharmacy.dateLabel')}: _____________________
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all" style={{
            background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)',
          }}>{t('action.close')}</button>
          <button onClick={handlePrint} className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5" style={{
            background: ACCENT,
          }}>
            <Printer className="w-4 h-4" /> {t('pharmacy.printOrder')}
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
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [eventCounter, setEventCounter] = useState(0);
  const [dataRate, setDataRate] = useState(0);

  // State for prescription queue (mutable for dispense)
  const [prescriptionQueue, setPrescriptionQueue] = useState<PrescriptionItem[]>(INITIAL_PRESCRIPTION_QUEUE);
  // State for stock (mutable for dispense deduction)
  const [stockAlerts, setStockAlerts] = useState<StockItem[]>(INITIAL_STOCK);
  // Dispense modal
  const [dispenseTarget, setDispenseTarget] = useState<PrescriptionItem | null>(null);
  // Toast
  const [toast, setToast] = useState<string | null>(null);
  // Purchase order modal
  const [showPurchaseOrder, setShowPurchaseOrder] = useState(false);
  // Expiry items
  const [expiryItems, setExpiryItems] = useState<ExpiryItem[]>(EXPIRY_DATA);
  // Patient lookup
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

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
      setDataRate(14 + Math.floor(Math.random() * 10) - 5);
    }, 5000);

    return () => clearInterval(interval);
  }, [generateEvent]);

  // Computed values
  const pendingRx = prescriptionQueue.filter(r => r.status === 'pending').length;
  const dispensedToday = prescriptionQueue.filter(r => r.status === 'dispensed').length;
  const lowStockCount = stockAlerts.filter(a => a.status === 'low').length;
  const criticalCount = stockAlerts.filter(a => a.status === 'critical').length;
  const awaitingPickup = prescriptionQueue.filter(r => r.status === 'awaiting_pickup').length;
  const controlledCount = prescriptionQueue.filter(r => r.medication.includes('Morphine') || r.medication.includes('Diazepam')).length;
  const totalMeds = INVENTORY_OVERVIEW.reduce((s, c) => s + c.total, 0);

  // Expiry computed
  const expiredCount = expiryItems.filter(e => new Date(e.expiryDate) <= today).length;
  const expiringCount = expiryItems.filter(e => {
    const d = new Date(e.expiryDate);
    return d > today && d <= new Date(today.getTime() + 90 * 86400000);
  }).length;

  // Reorder items: stock <= reorder level
  const reorderItems = stockAlerts
    .filter(s => s.stock <= s.reorder)
    .sort((a, b) => a.stock - b.stock);

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
        const newStatus: 'critical' | 'low' | 'adequate' = newStock === 0 ? 'critical' : newStock <= s.reorder * 0.25 ? 'critical' : newStock <= s.reorder ? 'low' : 'adequate';
        return { ...s, stock: newStock, status: newStatus };
      }
      return s;
    }));
    setToast(t('pharmacy.dispensedToast', { medication: dispenseTarget.medication, patient: dispenseTarget.patient }));
    setDispenseTarget(null);
  };

  // Drug interaction check for dispense modal
  const getInteractionsForRx = (rx: PrescriptionItem): DrugInteraction[] => {
    const patientName = rx.patient.split(' ').slice(0, 2).join(' ');
    const history = Object.entries(PATIENT_HISTORY).find(([k]) =>
      patientName.toLowerCase().includes(k.split(' ')[0].toLowerCase())
    );
    const currentMeds = history ? history[1].filter(h => h.status === 'dispensed').map(h => h.medication) : [];
    return checkDrugInteractions(rx.medication, currentMeds);
  };

  // Remove expired batch action
  const handleRemoveExpired = () => {
    setExpiryItems(prev => prev.filter(e => new Date(e.expiryDate) > today));
    setToast(t('pharmacy.removedExpiredToast', { count: expiredCount }));
  };

  // Patient history search
  const matchingPatients = patientSearch.length > 0
    ? Object.keys(PATIENT_HISTORY).filter(p => p.toLowerCase().includes(patientSearch.toLowerCase()))
    : [];
  const patientHistory = selectedPatient ? PATIENT_HISTORY[selectedPatient] || [] : [];

  // Sorted expiry items (FEFO)
  const sortedExpiry = [...expiryItems].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return (
    <>
      <TopBar title={t('pharmacy.operations')} />
      <main className="page-container page-enter">

        {/* Command Center Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'var(--accent-primary)',
            }}>
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {t('nav.pharmacy')}
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {currentUser?.hospitalName ? ` · ${currentUser.hospitalName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-1"><Zap className="w-3 h-3" style={{ color: ACCENT }} /><span>{t('pharmacy.dispensingPerHr', { count: dataRate || 14 })}</span></div>
              <div className="flex items-center gap-1"><Wifi className="w-3 h-3" style={{ color: 'var(--color-success)' }} /><span>{t('pharmacy.inventorySynced')}</span></div>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {[
            { label: t('pharmacy.kpiPendingRx'), value: pendingRx, icon: ClipboardList, color: ACCENT },
            { label: t('pharmacy.kpiDispensed'), value: dispensedToday, icon: CheckCircle2, color: 'var(--color-success)' },
            { label: t('pharmacy.kpiLowStock'), value: lowStockCount, icon: TrendingDown, color: 'var(--color-warning)' },
            { label: t('pharmacy.kpiExpired'), value: expiredCount, icon: XCircle, color: '#F87171' },
            { label: t('pharmacy.kpiExpiring'), value: expiringCount, icon: Calendar, color: '#F97316' },
            { label: t('pharmacy.kpiPickup'), value: awaitingPickup, icon: Clock, color: '#5CB8A8' },
            { label: t('pharmacy.kpiControlled'), value: controlledCount, icon: ShieldCheck, color: '#A855F7' },
            { label: t('pharmacy.kpiTotalMeds'), value: totalMeds.toLocaleString(), icon: Archive, color: '#5CB8A8' },
          ].map((kpi) => (
            <div key={kpi.label} className="dash-card relative px-3 py-2.5 transition-all cursor-pointer overflow-hidden">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

          {/* Prescription Queue with One-Tap Dispense - 2 cols */}
          <div className="md:col-span-2 dash-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.prescriptionQueue')}</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider" style={{
                  background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30`,
                }}>{t('pharmacy.pendingBadge', { count: pendingRx })}</span>
              </div>
              <button onClick={() => router.push('/pharmacy')} className="text-[10px] font-medium flex items-center gap-1" style={{ color: ACCENT }}>
                {t('pharmacy.viewAll')} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-1.5" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {prescriptionQueue.map(rx => (
                <div key={rx.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-all" style={{
                  background: rx.priority === 'urgent' ? `${ACCENT}08` : 'var(--overlay-subtle)',
                  border: `1px solid ${rx.priority === 'urgent' ? `${ACCENT}25` : 'var(--border-light)'}`,
                }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{
                    background: 'var(--accent-primary)',
                  }}>
                    {rx.patient.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{rx.patient}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {rx.medication} · {rx.dose}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{rx.prescriber} · {rx.time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: rx.status === 'dispensed' ? 'rgba(74,222,128,0.15)' :
                        rx.status === 'awaiting_pickup' ? 'rgba(56,189,248,0.15)' : `${ACCENT}15`,
                      color: rx.status === 'dispensed' ? 'var(--color-success)' :
                        rx.status === 'awaiting_pickup' ? '#5CB8A8' : ACCENT,
                    }}>{rx.status === 'awaiting_pickup' ? t('pharmacy.statusPickup') : t(`pharmacy.status_${rx.status}`)}</span>
                    {rx.priority === 'urgent' && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                        background: 'rgba(248,113,113,0.15)', color: '#F87171',
                      }}>{t('pharmacy.urgent')}</span>
                    )}
                    {rx.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDispense(rx); }}
                        className="mt-1 px-3 py-1 rounded-lg text-[10px] font-bold text-white transition-all hover:opacity-90 flex items-center gap-1"
                        style={{ background: 'var(--color-success)' }}
                      >
                        <Pill className="w-3 h-3" /> {t('pharmacy.dispense')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stock Alerts - 1 col */}
          <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{
            maxHeight: '460px',
          }}>
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: '#F87171' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.stockAlerts')}</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                background: 'rgba(248,113,113,0.12)', color: '#F87171',
              }}>{t('pharmacy.criticalBadge', { count: criticalCount })}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {stockAlerts.map((item, i) => {
                const pct = Math.round((item.stock / item.reorder) * 100);
                return (
                  <div key={i} className="p-2.5 rounded-lg transition-all" style={{
                    background: item.status === 'critical' ? 'rgba(248,113,113,0.06)' : 'rgba(251,191,36,0.06)',
                    border: `1px solid ${item.status === 'critical' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)'}`,
                  }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-1" style={{
                        background: item.status === 'critical' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
                        color: item.status === 'critical' ? '#F87171' : 'var(--color-warning)',
                      }}>{t(`pharmacy.stockStatus_${item.status}`)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span>{item.stock} / {item.reorder} {item.unit}</span>
                      <span style={{ color: item.status === 'critical' ? '#F87171' : 'var(--color-warning)' }}>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--overlay-subtle)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${pct}%`,
                        background: item.status === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispensing Activity Feed - 1 col */}
          <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{
            maxHeight: '460px',
          }}>
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
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${evt.color}15` }}>
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

        {/* NEW SECTIONS: Reorder Alerts + Expiry Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">

          {/* Auto Reorder Alerts */}
          <div className="dash-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" style={{ color: '#F97316' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.reorderNeeded')}</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider" style={{
                  background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)',
                }}>{t('pharmacy.itemsBadge', { count: reorderItems.length })}</span>
              </div>
              <button
                onClick={() => setShowPurchaseOrder(true)}
                className="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90"
                style={{ background: ACCENT }}
              >
                <Printer className="w-3 h-3" /> {t('pharmacy.generateOrder')}
              </button>
            </div>
            <div className="p-3 space-y-1.5" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {reorderItems.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.allStockAdequate')}</p>
              ) : (
                reorderItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{
                    background: item.stock === 0 ? 'rgba(239,68,68,0.06)' : 'rgba(249,115,22,0.06)',
                    border: `1px solid ${item.stock === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)'}`,
                  }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {item.stock === 0 && <AlertOctagon className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />}
                        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{t('pharmacy.stockLabel')}: <strong style={{ color: item.stock === 0 ? 'var(--color-danger)' : '#F97316' }}>{item.stock}</strong></span>
                        <span>{t('pharmacy.reorderLabel')}: {item.reorder}</span>
                        <span>{t('pharmacy.orderLabel')}: <strong style={{ color: ACCENT }}>{item.reorder * 2}</strong> {item.unit}</span>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2" style={{
                      background: item.stock === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                      color: item.stock === 0 ? 'var(--color-danger)' : '#F97316',
                    }}>{item.stock === 0 ? t('pharmacy.outBadge') : t('pharmacy.lowBadge')}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expiry Tracker (FEFO) */}
          <div className="dash-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.expiryTracker')}</span>
              </div>
              {expiredCount > 0 && (
                <button
                  onClick={handleRemoveExpired}
                  className="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--color-danger)' }}
                >
                  <Trash2 className="w-3 h-3" /> {t('pharmacy.removeExpired', { count: expiredCount })}
                </button>
              )}
            </div>
            <div className="p-3 space-y-1.5" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {sortedExpiry.map(item => {
                const status = getExpiryStatus(item.expiryDate);
                return (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{
                    background: status.bgColor,
                    border: `1px solid ${status.color}25`,
                  }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                      <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{t('pharmacy.batchLabel')}: {item.batch}</span>
                        <span>{item.stock} {item.unit}</span>
                        <span>{t('pharmacy.expLabel')}: {item.expiryDate}</span>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2" style={{
                      background: `${status.color}20`, color: status.color,
                    }}>{status.expired ? t('pharmacy.expired') : t('pharmacy.daysLeft', { count: status.days })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Patient Medication History Lookup */}
        <div className="dash-card rounded-2xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: '#A855F7' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.patientMedHistory')}</span>
            </div>
          </div>
          <div className="p-3">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={t('pharmacy.searchPatientPlaceholder')}
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Autocomplete dropdown */}
            {patientSearch.length > 0 && !selectedPatient && matchingPatients.length > 0 && (
              <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                {matchingPatients.map(p => (
                  <button key={p} onClick={() => { setSelectedPatient(p); setPatientSearch(p); }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all hover:opacity-80"
                    style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                    <User className="w-3.5 h-3.5" style={{ color: '#A855F7' }} />
                    {p}
                  </button>
                ))}
              </div>
            )}

            {patientSearch.length > 0 && !selectedPatient && matchingPatients.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.noPatientsFound', { query: patientSearch })}</p>
            )}

            {/* History Table */}
            {selectedPatient && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#A855F7' }}>
                    {selectedPatient.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedPatient}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.prescriptionsOnRecord', { count: patientHistory.length })}</p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-light)' }}>
                  <table className="w-full text-[11px]" style={{ minWidth: '500px' }}>
                    <thead>
                      <tr style={{ background: 'var(--overlay-subtle)' }}>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.dateLabel')}</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.medication')}</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.dose')}</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.prescriber')}</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.statusLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientHistory.map((entry, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{entry.date}</td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{entry.medication}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{entry.dose}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{entry.prescriber}</td>
                          <td className="px-3 py-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                              background: entry.status === 'dispensed' ? 'rgba(74,222,128,0.15)' :
                                entry.status === 'awaiting_pickup' ? 'rgba(56,189,248,0.15)' : `${ACCENT}15`,
                              color: entry.status === 'dispensed' ? 'var(--color-success)' :
                                entry.status === 'awaiting_pickup' ? '#5CB8A8' : ACCENT,
                            }}>{entry.status === 'awaiting_pickup' ? t('pharmacy.statusPickup') : t(`pharmacy.status_${entry.status}`)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Inventory Overview + Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Inventory Overview - 3 cols */}
          <div className="md:col-span-2 lg:col-span-3 dash-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pharmacy.inventoryOverview')}</span>
              </div>
              <button onClick={() => router.push('/pharmacy')} className="text-[10px] font-medium flex items-center gap-1" style={{ color: ACCENT }}>
                {t('pharmacy.fullInventory')} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INVENTORY_OVERVIEW.map((cat) => {
                const adequatePct = Math.round((cat.adequate / cat.total) * 100);
                return (
                  <div key={cat.category} className="dash-stat rounded-xl transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: ACCENT }}>{t(`pharmacy.cat_${cat.category.replace(/\s+/g, '')}`)}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                        background: adequatePct > 80 ? 'rgba(74,222,128,0.15)' : adequatePct > 60 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                        color: adequatePct > 80 ? 'var(--color-success)' : adequatePct > 60 ? 'var(--color-warning)' : '#F87171',
                      }}>{adequatePct}%</span>
                    </div>
                    <p className="text-lg font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{cat.total}</p>
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border-light)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${adequatePct}%`,
                        background: adequatePct > 80 ? 'var(--color-success)' : adequatePct > 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                      }} />
                    </div>
                    <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--color-success)' }}>{t('pharmacy.catOk', { count: cat.adequate })}</span>
                      <span style={{ color: 'var(--color-warning)' }}>{t('pharmacy.catLow', { count: cat.low })}</span>
                      <span style={{ color: '#F87171' }}>{t('pharmacy.catCrit', { count: cat.critical })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions - 1 col */}
          <div className="dash-card rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('pharmacy.quickActions')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: t('pharmacy.dispense'), icon: Pill, color: ACCENT },
                { label: t('pharmacy.checkStock'), icon: Search, color: '#5CB8A8' },
                { label: t('pharmacy.message'), icon: Send, href: '/messages', color: '#EC4899' },
                { label: t('pharmacy.inventory'), icon: Package, color: 'var(--color-success)' },
              ].map(action => (
                <button key={action.label} onClick={() => action.href ? router.push(action.href) : undefined}
                  className="flex items-center gap-2 p-2.5 rounded-lg transition-all"
                  style={{ background: `${action.color}08`, border: `1px solid ${action.color}15` }}>
                  <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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
      {showPurchaseOrder && (
        <PurchaseOrderModal
          items={reorderItems}
          onClose={() => setShowPurchaseOrder(false)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
