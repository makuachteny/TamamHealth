'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useToast } from '@/components/Toast';
import {
  ClipboardCheck, Baby, Skull, Syringe, HeartPulse,
  Database, Building2, ArrowRight, CheckCircle2, AlertTriangle,
  Clock, Heart, BarChart3, Wifi, WifiOff,
  BedDouble, Stethoscope, Users, Zap, Save, Plus,
  Thermometer, Pill, FlaskConical, Droplets,
  ShieldCheck, Truck, FileText,
} from '@/components/icons/lucide';

const ACCENT = '#0891B2';

interface CensusData {
  date: string;
  // Patients
  inpatientsTotal: number;
  inpatientsMale: number;
  inpatientsFemale: number;
  inpatientsChildren: number;
  opdVisitsToday: number;
  emergencyVisits: number;
  maternityAdmissions: number;
  newborns: number;
  deaths: number;
  discharges: number;
  referralsOut: number;
  referralsIn: number;
  // Beds
  totalBeds: number;
  occupiedBeds: number;
  icuBeds: number;
  icuOccupied: number;
  maternityBeds: number;
  maternityOccupied: number;
  pediatricBeds: number;
  pediatricOccupied: number;
  // Staff present
  doctorsPresent: number;
  nursesPresent: number;
  clinicalOfficers: number;
  labTechs: number;
  pharmacists: number;
  supportStaff: number;
  // Equipment & supplies
  functionalThermometers: number;
  functionalBPMonitors: number;
  functionalStethoscopes: number;
  functionalOximeters: number;
  wheelchairsAvailable: number;
  ambulanceOperational: boolean;
  generatorFunctional: boolean;
  waterAvailable: boolean;
  electricityHoursToday: number;
  // Pharmacy & lab
  tracerMedicinesInStock: number;
  tracerMedicinesTotal: number;
  stockOutItems: string;
  labTestsPerformed: number;
  labTestsPending: number;
  bloodUnitsAvailable: number;
  // Infection control
  handwashStations: number;
  handwashFunctional: number;
  wasteDisposalFunctional: boolean;
  ppeSetsAvailable: number;
  // Notes
  challenges: string;
  achievements: string;
  urgentNeeds: string;
}

const emptyCensus = (date: string): CensusData => ({
  date,
  inpatientsTotal: 0, inpatientsMale: 0, inpatientsFemale: 0, inpatientsChildren: 0,
  opdVisitsToday: 0, emergencyVisits: 0, maternityAdmissions: 0, newborns: 0,
  deaths: 0, discharges: 0, referralsOut: 0, referralsIn: 0,
  totalBeds: 0, occupiedBeds: 0, icuBeds: 0, icuOccupied: 0,
  maternityBeds: 0, maternityOccupied: 0, pediatricBeds: 0, pediatricOccupied: 0,
  doctorsPresent: 0, nursesPresent: 0, clinicalOfficers: 0, labTechs: 0, pharmacists: 0, supportStaff: 0,
  functionalThermometers: 0, functionalBPMonitors: 0, functionalStethoscopes: 0, functionalOximeters: 0,
  wheelchairsAvailable: 0, ambulanceOperational: false, generatorFunctional: false, waterAvailable: true, electricityHoursToday: 0,
  tracerMedicinesInStock: 0, tracerMedicinesTotal: 20, stockOutItems: '', labTestsPerformed: 0, labTestsPending: 0, bloodUnitsAvailable: 0,
  handwashStations: 0, handwashFunctional: 0, wasteDisposalFunctional: true, ppeSetsAvailable: 0,
  challenges: '', achievements: '', urgentNeeds: '',
});

export default function DataEntryDashboard() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { hospitals } = useHospitals();
  const { showToast } = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [census, setCensus] = useState<CensusData>(() => emptyCensus(today));
  const [savedReports, setSavedReports] = useState<CensusData[]>([]);
  const [saving, setSaving] = useState(false);

  const myHospital = useMemo(() =>
    hospitals.find(h => h._id === currentUser?.hospitalId),
    [hospitals, currentUser?.hospitalId]
  );

  const facilityStats = useMemo(() => {
    if (!myHospital) return null;
    const services = myHospital.services || [];
    const completeness = [
      myHospital.totalBeds > 0, myHospital.doctors > 0, myHospital.nurses > 0,
      services.length > 0, myHospital.hasElectricity, myHospital.hasInternet,
      myHospital.state, myHospital.county,
    ].filter(Boolean).length;
    return { services, pct: Math.round((completeness / 8) * 100), completeness };
  }, [myHospital]);

  const updateField = useCallback(<K extends keyof CensusData>(field: K, value: CensusData[K]) => {
    setCensus(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to local storage for now (would save to PouchDB in production)
      const key = `tamamhealth-census-${currentUser?.hospitalId || 'unknown'}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = [census, ...existing.filter((r: CensusData) => r.date !== census.date)].slice(0, 30);
      localStorage.setItem(key, JSON.stringify(updated));
      setSavedReports(updated);
      showToast('Census report saved successfully', 'success');
      setShowForm(false);
    } catch {
      showToast('Failed to save report', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load saved reports + pre-fill from hospital data on mount / when the
  // hospital becomes available. (This was previously a `useState(() => {...})`
  // misuse that calls setters during state initialization — which both
  // skipped re-runs once the hospital loaded and triggered the React
  // "cannot update during render" warning.)
  useEffect(() => {
    try {
      const key = `tamamhealth-census-${currentUser?.hospitalId || 'unknown'}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      setSavedReports(existing);
    } catch { /* ignore */ }
  }, [currentUser?.hospitalId]);

  useEffect(() => {
    if (!myHospital) return;
    setCensus(prev => ({
      ...prev,
      totalBeds: myHospital.totalBeds || 0,
      icuBeds: myHospital.icuBeds || 0,
      maternityBeds: myHospital.maternityBeds || 0,
      pediatricBeds: myHospital.pediatricBeds || 0,
      doctorsPresent: myHospital.doctors || 0,
      nursesPresent: myHospital.nurses || 0,
      clinicalOfficers: myHospital.clinicalOfficers || 0,
      labTechs: myHospital.labTechnicians || 0,
      pharmacists: myHospital.pharmacists || 0,
    }));
  }, [myHospital]);

  const numField = (label: string, field: keyof CensusData, icon?: React.ElementType) => {
    const Icon = icon;
    return (
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </label>
        <input
          type="number" min={0}
          value={census[field] as number}
          onChange={e => updateField(field, parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-md text-sm font-semibold"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
        />
      </div>
    );
  };

  const boolField = (label: string, field: keyof CensusData) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <button type="button" onClick={() => updateField(field, !census[field] as CensusData[typeof field])}
        className="tbn-toggle" style={{ background: census[field] ? 'var(--accent-primary)' : 'var(--toggle-track)' }}>
        <span className="tbn-toggle__knob" style={{ transform: census[field] ? 'translateX(22px)' : 'translateX(3px)' }} />
      </button>
    </div>
  );

  const textField = (label: string, field: keyof CensusData, placeholder: string) => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <textarea
        rows={2} placeholder={placeholder}
        value={census[field] as string}
        onChange={e => updateField(field, e.target.value as CensusData[typeof field])}
        className="w-full px-3 py-2 rounded-md text-xs"
        style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', resize: 'vertical' }}
      />
    </div>
  );

  const sectionHeader = (icon: React.ElementType, title: string, color: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </div>
    );
  };

  // Latest report for visualization
  const latest = savedReports[0] || null;
  const bedOccupancy = latest && latest.totalBeds > 0 ? Math.round((latest.occupiedBeds / latest.totalBeds) * 100) : 0;
  const medAvailability = latest && latest.tracerMedicinesTotal > 0 ? Math.round((latest.tracerMedicinesInStock / latest.tracerMedicinesTotal) * 100) : 0;
  const handwashRate = latest && latest.handwashStations > 0 ? Math.round((latest.handwashFunctional / latest.handwashStations) * 100) : 0;

  if (!currentUser) return null;

  return (
    <>
      <TopBar title="Data Entry Dashboard" />
      <main className="page-container page-enter">

        {/* Facility banner */}
        {myHospital && (
          <div className="dash-card mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
                <Building2 className="w-5 h-5" style={{ color: ACCENT }} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{myHospital.name}</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {myHospital.state} &middot; {myHospital.county || myHospital.town} &middot; {myHospital.type?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {myHospital.syncStatus === 'online'
                  ? <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                  : <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                }
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  <Plus className="w-3.5 h-3.5" /> New Census
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI strip from latest report */}
        <div className="kpi-grid mb-4">
          {[
            { label: 'Facility Score', value: facilityStats ? `${facilityStats.pct}%` : '--', icon: BarChart3, color: facilityStats && facilityStats.pct >= 80 ? 'var(--color-success)' : 'var(--color-warning)' },
            { label: 'Bed Occupancy', value: latest ? `${bedOccupancy}%` : '--', icon: BedDouble, color: bedOccupancy > 90 ? 'var(--color-danger)' : bedOccupancy > 70 ? 'var(--color-warning)' : 'var(--color-success)' },
            { label: 'Medicine Avail.', value: latest ? `${medAvailability}%` : '--', icon: Pill, color: medAvailability >= 80 ? 'var(--color-success)' : medAvailability >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' },
            { label: 'Reports Filed', value: savedReports.length, icon: FileText, color: ACCENT },
          ].map(k => (
            <div key={k.label} className="kpi">
              <div className="kpi__icon" style={{ background: `${k.color}15` }}>
                <k.icon style={{ color: k.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{k.value}</div>
                <div className="kpi__label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="dash-card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Data Collection</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Daily Census', icon: ClipboardCheck, color: 'var(--accent-primary)', action: () => setShowForm(true) },
              { label: 'Facility Assessment', icon: Building2, color: 'var(--accent-primary)', action: () => router.push('/facility-assessments') },
              { label: 'Data Quality', icon: Database, color: 'var(--accent-primary)', action: () => router.push('/data-quality') },
              { label: 'Vital Statistics', icon: Heart, color: 'var(--accent-primary)', action: () => router.push('/vital-statistics') },
              { label: 'Immunizations', icon: Syringe, color: 'var(--accent-primary)', action: () => router.push('/immunizations') },
              { label: 'Antenatal Care', icon: HeartPulse, color: 'var(--accent-primary)', action: () => router.push('/anc') },
              { label: 'Births', icon: Baby, color: 'var(--accent-primary)', action: () => router.push('/births') },
              { label: 'Deaths', icon: Skull, color: 'var(--accent-primary)', action: () => router.push('/deaths') },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all active:scale-95"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${a.color}12` }}>
                  <a.icon className="w-4 h-4" style={{ color: a.color }} />
                </div>
                <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Latest report visualization */}
        {latest ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            {/* Patient summary */}
            <div className="glass-section">
              <div className="glass-section-header">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patient Census</span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{latest.date}</span>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Inpatients', value: latest.inpatientsTotal, color: 'var(--accent-primary)' },
                  { label: 'OPD Visits', value: latest.opdVisitsToday, color: 'var(--accent-primary)' },
                  { label: 'Emergency', value: latest.emergencyVisits, color: 'var(--color-danger)' },
                  { label: 'Maternity', value: latest.maternityAdmissions, color: 'var(--accent-primary)' },
                  { label: 'Newborns', value: latest.newborns, color: 'var(--accent-primary)' },
                  { label: 'Discharges', value: latest.discharges, color: 'var(--accent-primary)' },
                  { label: 'Deaths', value: latest.deaths, color: 'var(--color-danger)' },
                  { label: 'Referrals Out', value: latest.referralsOut, color: 'var(--accent-primary)' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bed & staff summary */}
            <div className="glass-section">
              <div className="glass-section-header">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Beds & Staff</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'General Beds', occupied: latest.occupiedBeds, total: latest.totalBeds, color: 'var(--accent-primary)' },
                  { label: 'ICU', occupied: latest.icuOccupied, total: latest.icuBeds, color: 'var(--color-danger)' },
                  { label: 'Maternity', occupied: latest.maternityOccupied, total: latest.maternityBeds, color: '#EC4899' },
                  { label: 'Pediatric', occupied: latest.pediatricOccupied, total: latest.pediatricBeds, color: '#2563EB' },
                ].map(bed => {
                  const pct = bed.total > 0 ? Math.round((bed.occupied / bed.total) * 100) : 0;
                  return (
                    <div key={bed.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{bed.label}</span>
                        <span className="text-[11px] font-bold" style={{ color: pct > 90 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{bed.occupied}/{bed.total}</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-medium)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bed.color }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: 8, marginTop: 4 }}>
                  <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Staff Present</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Doctors', value: latest.doctorsPresent },
                      { label: 'Nurses', value: latest.nursesPresent },
                      { label: 'COs', value: latest.clinicalOfficers },
                      { label: 'Lab', value: latest.labTechs },
                      { label: 'Pharma', value: latest.pharmacists },
                      { label: 'Support', value: latest.supportStaff },
                    ].map(s => (
                      <div key={s.label} className="text-center p-1.5 rounded" style={{ background: 'var(--overlay-subtle)' }}>
                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                        <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Equipment & supplies */}
            <div className="glass-section">
              <div className="glass-section-header">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Equipment & Supplies</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Thermometers', value: latest.functionalThermometers, icon: Thermometer },
                  { label: 'BP Monitors', value: latest.functionalBPMonitors, icon: Heart },
                  { label: 'Stethoscopes', value: latest.functionalStethoscopes, icon: Stethoscope },
                  { label: 'Pulse Oximeters', value: latest.functionalOximeters, icon: Zap },
                  { label: 'Wheelchairs', value: latest.wheelchairsAvailable, icon: Truck },
                  { label: 'PPE Sets', value: latest.ppeSetsAvailable, icon: ShieldCheck },
                ].map(eq => (
                  <div key={eq.label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="flex items-center gap-2">
                      <eq.icon className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{eq.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: eq.value > 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>{eq.value}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: 8, marginTop: 4 }}>
                  {[
                    { label: 'Medicine Availability', pct: medAvailability, color: 'var(--color-success)' },
                    { label: 'Handwash Stations', pct: handwashRate, color: 'var(--accent-primary)' },
                  ].map(m => (
                    <div key={m.label} className="mb-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                        <span className="text-[11px] font-bold" style={{ color: m.pct >= 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>{m.pct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-medium)' }}>
                        <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-2">
                    {[
                      { label: 'Ambulance', ok: latest.ambulanceOperational },
                      { label: 'Generator', ok: latest.generatorFunctional },
                      { label: 'Water', ok: latest.waterAvailable },
                      { label: 'Waste', ok: latest.wasteDisposalFunctional },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-1">
                        {s.ok ? <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-success)' }} /> : <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-danger)' }} />}
                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="dash-card p-8 mb-4 text-center">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No census reports yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Start your first daily facility census to see data here.</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold"
              style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus className="w-3.5 h-3.5" /> Start Daily Census
            </button>
          </div>
        )}

        {/* Previous reports */}
        {savedReports.length > 0 && (
          <div className="dash-card mb-4">
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Previous Reports ({savedReports.length})</span>
            </div>
            <div className="p-3 space-y-1">
              {savedReports.slice(0, 7).map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-md" style={{ border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.date}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{r.inpatientsTotal} inpatients</span>
                    <span>{r.opdVisitsToday} OPD</span>
                    <span>{r.occupiedBeds}/{r.totalBeds} beds</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ CENSUS FORM MODAL ═══ */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(0,0,0,0.55)', padding: '24px 16px' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
            <div className="w-full max-w-2xl rounded-lg" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-xl)' }}>

              {/* Form header */}
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 rounded-t-lg" style={{ background: 'var(--bg-card-solid)', borderBottom: '1px solid var(--border-medium)' }}>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" style={{ color: ACCENT }} />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Daily Facility Census</h3>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{myHospital?.name || 'Unknown Facility'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={census.date} onChange={e => updateField('date', e.target.value)}
                    className="px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded flex items-center justify-center"
                    style={{ background: 'var(--overlay-medium)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              </div>

              <div className="p-4 space-y-5">

                {/* 1. Patient Census */}
                {sectionHeader(Users, 'Patient Census', 'var(--accent-primary)')}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numField('Inpatients Total', 'inpatientsTotal', Users)}
                  {numField('Male', 'inpatientsMale')}
                  {numField('Female', 'inpatientsFemale')}
                  {numField('Children (<5)', 'inpatientsChildren')}
                  {numField('OPD Visits', 'opdVisitsToday')}
                  {numField('Emergency', 'emergencyVisits')}
                  {numField('Maternity Admissions', 'maternityAdmissions')}
                  {numField('Newborns', 'newborns', Baby)}
                  {numField('Deaths', 'deaths', Skull)}
                  {numField('Discharges', 'discharges')}
                  {numField('Referrals Out', 'referralsOut', ArrowRight)}
                  {numField('Referrals In', 'referralsIn')}
                </div>

                {/* 2. Bed Occupancy */}
                {sectionHeader(BedDouble, 'Bed Occupancy', '#7C3AED')}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numField('Total Beds', 'totalBeds', BedDouble)}
                  {numField('Occupied', 'occupiedBeds')}
                  {numField('ICU Beds', 'icuBeds')}
                  {numField('ICU Occupied', 'icuOccupied')}
                  {numField('Maternity Beds', 'maternityBeds')}
                  {numField('Maternity Occupied', 'maternityOccupied')}
                  {numField('Pediatric Beds', 'pediatricBeds')}
                  {numField('Pediatric Occupied', 'pediatricOccupied')}
                </div>

                {/* 3. Staff Present */}
                {sectionHeader(Stethoscope, 'Staff Present Today', 'var(--color-success)')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField('Doctors', 'doctorsPresent', Stethoscope)}
                  {numField('Nurses', 'nursesPresent', Users)}
                  {numField('Clinical Officers', 'clinicalOfficers')}
                  {numField('Lab Technicians', 'labTechs', FlaskConical)}
                  {numField('Pharmacists', 'pharmacists', Pill)}
                  {numField('Support Staff', 'supportStaff')}
                </div>

                {/* 4. Equipment */}
                {sectionHeader(Thermometer, 'Functional Equipment', 'var(--color-warning)')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField('Thermometers', 'functionalThermometers', Thermometer)}
                  {numField('BP Monitors', 'functionalBPMonitors')}
                  {numField('Stethoscopes', 'functionalStethoscopes', Stethoscope)}
                  {numField('Pulse Oximeters', 'functionalOximeters')}
                  {numField('Wheelchairs', 'wheelchairsAvailable')}
                  {numField('PPE Sets', 'ppeSetsAvailable', ShieldCheck)}
                </div>
                <div className="grid grid-cols-2 gap-x-6">
                  {boolField('Ambulance Operational', 'ambulanceOperational')}
                  {boolField('Generator Functional', 'generatorFunctional')}
                  {boolField('Water Available', 'waterAvailable')}
                  {boolField('Waste Disposal Functional', 'wasteDisposalFunctional')}
                </div>
                {numField('Electricity Hours Today', 'electricityHoursToday', Zap)}

                {/* 5. Pharmacy & Lab */}
                {sectionHeader(Pill, 'Pharmacy & Laboratory', '#EC4899')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField('Tracer Medicines In Stock', 'tracerMedicinesInStock', Pill)}
                  {numField('Tracer Medicines Total', 'tracerMedicinesTotal')}
                  {numField('Lab Tests Done', 'labTestsPerformed', FlaskConical)}
                  {numField('Lab Tests Pending', 'labTestsPending')}
                  {numField('Blood Units Available', 'bloodUnitsAvailable', Droplets)}
                </div>
                {textField('Stock-Out Items', 'stockOutItems', 'List medications currently out of stock...')}

                {/* 6. Infection Control */}
                {sectionHeader(ShieldCheck, 'Infection Control', '#2563EB')}
                <div className="grid grid-cols-2 gap-3">
                  {numField('Handwash Stations', 'handwashStations')}
                  {numField('Functional Stations', 'handwashFunctional')}
                </div>

                {/* 7. Notes */}
                {sectionHeader(FileText, 'Daily Notes', '#5A7370')}
                {textField('Challenges', 'challenges', 'Any issues faced today...')}
                {textField('Achievements', 'achievements', 'What went well...')}
                {textField('Urgent Needs', 'urgentNeeds', 'Critical items needed...')}
              </div>

              {/* Save button */}
              <div className="sticky bottom-0 p-4 rounded-b-lg flex gap-3" style={{ background: 'var(--bg-card-solid)', borderTop: '1px solid var(--border-medium)' }}>
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-md text-xs font-semibold"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-2"
                  style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Census Report'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
