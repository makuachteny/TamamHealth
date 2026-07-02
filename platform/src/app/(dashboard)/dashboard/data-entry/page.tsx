'use client';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardActionsRow from '@/components/dashboard/DashboardActionsRow';
import SpotlightCard from '@/components/dashboard/SpotlightCard';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
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

// Use the platform accent token so this dashboard matches the reference
// Clinical Officer design instead of a one-off hardcoded hex.
const ACCENT = 'var(--accent-primary)';

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
  const { t } = useTranslation();

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
      const { saveFacilityCensus, getFacilityCensusByFacility } = await import('@/lib/services/facility-census-service');
      const facilityId = currentUser?.hospitalId || 'unknown';
      await saveFacilityCensus({
        facilityId,
        facilityName: myHospital?.name,
        orgId: currentUser?.orgId,
        date: census.date,
        census: census as unknown as Record<string, unknown>,
        submittedBy: currentUser?._id,
        submittedByName: currentUser?.name,
      });
      const updated = await getFacilityCensusByFacility(facilityId);
      setSavedReports(updated.map(r => r.census as unknown as CensusData).slice(0, 30));
      showToast(t('dataEntry.toastSaved'), 'success');
      setShowForm(false);
    } catch {
      showToast(t('dataEntry.toastSaveFailed'), 'error');
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
    let cancelled = false;
    async function loadSavedReports() {
      try {
        const { getFacilityCensusByFacility } = await import('@/lib/services/facility-census-service');
        const facilityId = currentUser?.hospitalId || 'unknown';
        const existing = await getFacilityCensusByFacility(facilityId);
        if (!cancelled) setSavedReports(existing.map(r => r.census as unknown as CensusData).slice(0, 30));
      } catch {
        if (!cancelled) setSavedReports([]);
      }
    }
    loadSavedReports();
    return () => { cancelled = true; };
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
      <TopBar title={t('dataEntry.title')} />
      <main className="page-container page-enter">

        <DashboardHero
          className="mb-5"
          stats={[
            { label: 'Beds', value: myHospital?.totalBeds ?? 0 },
            { label: 'Doctors', value: myHospital?.doctors ?? 0 },
            { label: 'Nurses', value: myHospital?.nurses ?? 0 },
            { label: 'Profile', value: `${facilityStats?.pct ?? 0}%` },
          ]}
        />

        <DashboardActionsRow
          className="mb-5"
          actions={[
            { label: 'My Facility', icon: Building2, href: '/my-facility' },
            { label: 'All Patients', icon: Users, href: '/patients', color: '#0D9488' },
            { label: 'Data Quality', icon: ClipboardCheck, href: '/data-quality', color: 'var(--accent-primary)' },
            { label: 'Reports', icon: BarChart3, href: '/reports', color: '#F59E0B' },
          ]}
          secondaryCard={<SpotlightCard title="Profile Completeness" value={`${facilityStats?.pct ?? 0}%`} caption="facility profile filled" href="/my-facility" />}
        />

        {/* COMMAND CENTER HEADER (matches the nurse dashboard) */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 44 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'transparent' }}>
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.title')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {myHospital?.name || currentUser.hospitalName || ''}{myHospital?.state ? ` · ${myHospital.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Facility banner */}
        {myHospital && (
          <div className="dash-card mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
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
                  <Plus className="w-3.5 h-3.5" /> {t('dataEntry.newCensus')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI strip from latest report */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { label: t('dataEntry.kpiFacilityScore'), value: facilityStats ? `${facilityStats.pct}%` : '--', icon: BarChart3, color: facilityStats && facilityStats.pct >= 80 ? 'var(--color-success)' : 'var(--color-warning)' },
            { label: t('dashboard.bedOccupancy'), value: latest ? `${bedOccupancy}%` : '--', icon: BedDouble, color: bedOccupancy > 90 ? 'var(--color-danger)' : bedOccupancy > 70 ? 'var(--color-warning)' : 'var(--color-success)' },
            { label: t('dataEntry.kpiMedicineAvail'), value: latest ? `${medAvailability}%` : '--', icon: Pill, color: medAvailability >= 80 ? 'var(--color-success)' : medAvailability >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' },
            { label: t('dataEntry.kpiReportsFiled'), value: savedReports.length, icon: FileText, color: ACCENT },
          ].map(k => (
            <div key={k.label} className="dash-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="icon-box-sm">
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                </div>
                <span className="kpi-card-title">{k.label}</span>
              </div>
              <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="dash-card mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('dataEntry.dataCollection')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: t('dataEntry.dailyCensus'), icon: ClipboardCheck, color: 'var(--accent-primary)', action: () => setShowForm(true) },
              { label: t('dataEntry.facilityAssessment'), icon: Building2, color: 'var(--accent-primary)', action: () => router.push('/facility-assessments') },
              { label: t('dataEntry.dataQuality'), icon: Database, color: 'var(--accent-primary)', action: () => router.push('/data-quality') },
              { label: t('dataEntry.vitalStatistics'), icon: Heart, color: 'var(--accent-primary)', action: () => router.push('/vital-statistics') },
              { label: t('nav.immunizations'), icon: Syringe, color: 'var(--accent-primary)', action: () => router.push('/immunizations') },
              { label: t('nav.anc'), icon: HeartPulse, color: 'var(--accent-primary)', action: () => router.push('/anc') },
              { label: t('dataEntry.births'), icon: Baby, color: 'var(--accent-primary)', action: () => router.push('/births') },
              { label: t('dataEntry.deaths'), icon: Skull, color: 'var(--accent-primary)', action: () => router.push('/deaths') },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                  <a.icon className="w-4 h-4" style={{ color: a.color }} />
                </div>
                <span className="text-[10px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Latest report visualization */}
        {latest ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Patient summary */}
            <div className="glass-section">
              <div className="glass-section-header">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.patientCensus')}</span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{latest.date}</span>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: t('dataEntry.inpatients'), value: latest.inpatientsTotal, color: 'var(--accent-primary)' },
                  { label: t('dataEntry.opdVisits'), value: latest.opdVisitsToday, color: 'var(--accent-primary)' },
                  { label: t('encounters.emergency'), value: latest.emergencyVisits, color: 'var(--color-danger)' },
                  { label: t('dashboard.bedMaternity'), value: latest.maternityAdmissions, color: 'var(--accent-primary)' },
                  { label: t('dataEntry.newborns'), value: latest.newborns, color: 'var(--accent-primary)' },
                  { label: t('dataEntry.discharges'), value: latest.discharges, color: 'var(--accent-primary)' },
                  { label: t('dataEntry.deaths'), value: latest.deaths, color: 'var(--color-danger)' },
                  { label: t('dataEntry.referralsOut'), value: latest.referralsOut, color: 'var(--accent-primary)' },
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
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.bedsAndStaff')}</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: t('dataEntry.generalBeds'), occupied: latest.occupiedBeds, total: latest.totalBeds, color: 'var(--accent-primary)' },
                  { label: t('dashboard.bedIcu'), occupied: latest.icuOccupied, total: latest.icuBeds, color: 'var(--color-danger)' },
                  { label: t('dashboard.bedMaternity'), occupied: latest.maternityOccupied, total: latest.maternityBeds, color: '#EC4899' },
                  { label: t('dashboard.bedPediatric'), occupied: latest.pediatricOccupied, total: latest.pediatricBeds, color: '#2191D0' },
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
                  <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{t('dataEntry.staffPresent')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: t('dashboard.doctors'), value: latest.doctorsPresent },
                      { label: t('dataEntry.nurses'), value: latest.nursesPresent },
                      { label: t('dataEntry.cos'), value: latest.clinicalOfficers },
                      { label: t('dataEntry.lab'), value: latest.labTechs },
                      { label: t('dataEntry.pharma'), value: latest.pharmacists },
                      { label: t('dataEntry.support'), value: latest.supportStaff },
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
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.equipmentSupplies')}</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: t('dataEntry.thermometers'), value: latest.functionalThermometers, icon: Thermometer },
                  { label: t('dataEntry.bpMonitors'), value: latest.functionalBPMonitors, icon: Heart },
                  { label: t('dataEntry.stethoscopes'), value: latest.functionalStethoscopes, icon: Stethoscope },
                  { label: t('dataEntry.pulseOximeters'), value: latest.functionalOximeters, icon: Zap },
                  { label: t('dataEntry.wheelchairs'), value: latest.wheelchairsAvailable, icon: Truck },
                  { label: t('dataEntry.ppeSets'), value: latest.ppeSetsAvailable, icon: ShieldCheck },
                ].map(eq => (
                  <div key={eq.label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{eq.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: eq.value > 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>{eq.value}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: 8, marginTop: 4 }}>
                  {[
                    { label: t('dataEntry.medicineAvailability'), pct: medAvailability, color: 'var(--color-success)' },
                    { label: t('dataEntry.handwashStations'), pct: handwashRate, color: 'var(--accent-primary)' },
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
                      { label: t('dataEntry.ambulance'), ok: latest.ambulanceOperational },
                      { label: t('dataEntry.generator'), ok: latest.generatorFunctional },
                      { label: t('dataEntry.water'), ok: latest.waterAvailable },
                      { label: t('dataEntry.waste'), ok: latest.wasteDisposalFunctional },
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
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.noReportsYet')}</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('dataEntry.noReportsDesc')}</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold"
              style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Plus className="w-3.5 h-3.5" /> {t('dataEntry.startDailyCensus')}
            </button>
          </div>
        )}

        {/* Previous reports */}
        {savedReports.length > 0 && (
          <div className="dash-card mb-4">
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.previousReports', { count: savedReports.length })}</span>
            </div>
            <div className="p-3 space-y-1">
              {savedReports.slice(0, 7).map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-md" style={{ border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.date}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{t('dataEntry.inpatientsCount', { count: r.inpatientsTotal })}</span>
                    <span>{t('dataEntry.opdCount', { count: r.opdVisitsToday })}</span>
                    <span>{t('dataEntry.bedsCount', { occupied: r.occupiedBeds, total: r.totalBeds })}</span>
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
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('dataEntry.dailyFacilityCensus')}</h3>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{myHospital?.name || t('dataEntry.unknownFacility')}</p>
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
                {sectionHeader(Users, t('dataEntry.patientCensus'), 'var(--accent-primary)')}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numField(t('dataEntry.inpatientsTotal'), 'inpatientsTotal', Users)}
                  {numField(t('patient.male'), 'inpatientsMale')}
                  {numField(t('patient.female'), 'inpatientsFemale')}
                  {numField(t('dataEntry.childrenUnder5'), 'inpatientsChildren')}
                  {numField(t('dataEntry.opdVisits'), 'opdVisitsToday')}
                  {numField(t('encounters.emergency'), 'emergencyVisits')}
                  {numField(t('dataEntry.maternityAdmissions'), 'maternityAdmissions')}
                  {numField(t('dataEntry.newborns'), 'newborns', Baby)}
                  {numField(t('dataEntry.deaths'), 'deaths', Skull)}
                  {numField(t('dataEntry.discharges'), 'discharges')}
                  {numField(t('dataEntry.referralsOut'), 'referralsOut', ArrowRight)}
                  {numField(t('dataEntry.referralsIn'), 'referralsIn')}
                </div>

                {/* 2. Bed Occupancy */}
                {sectionHeader(BedDouble, t('dashboard.bedOccupancy'), 'var(--accent-primary)')}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numField(t('dataEntry.totalBeds'), 'totalBeds', BedDouble)}
                  {numField(t('dataEntry.occupied'), 'occupiedBeds')}
                  {numField(t('dataEntry.icuBeds'), 'icuBeds')}
                  {numField(t('dataEntry.icuOccupied'), 'icuOccupied')}
                  {numField(t('dataEntry.maternityBeds'), 'maternityBeds')}
                  {numField(t('dataEntry.maternityOccupied'), 'maternityOccupied')}
                  {numField(t('dataEntry.pediatricBeds'), 'pediatricBeds')}
                  {numField(t('dataEntry.pediatricOccupied'), 'pediatricOccupied')}
                </div>

                {/* 3. Staff Present */}
                {sectionHeader(Stethoscope, t('dataEntry.staffPresentToday'), 'var(--color-success)')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField(t('dashboard.doctors'), 'doctorsPresent', Stethoscope)}
                  {numField(t('dataEntry.nurses'), 'nursesPresent', Users)}
                  {numField(t('dataEntry.clinicalOfficers'), 'clinicalOfficers')}
                  {numField(t('dataEntry.labTechnicians'), 'labTechs', FlaskConical)}
                  {numField(t('dataEntry.pharmacists'), 'pharmacists', Pill)}
                  {numField(t('dataEntry.supportStaff'), 'supportStaff')}
                </div>

                {/* 4. Equipment */}
                {sectionHeader(Thermometer, t('dataEntry.functionalEquipment'), 'var(--color-warning)')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField(t('dataEntry.thermometers'), 'functionalThermometers', Thermometer)}
                  {numField(t('dataEntry.bpMonitors'), 'functionalBPMonitors')}
                  {numField(t('dataEntry.stethoscopes'), 'functionalStethoscopes', Stethoscope)}
                  {numField(t('dataEntry.pulseOximeters'), 'functionalOximeters')}
                  {numField(t('dataEntry.wheelchairs'), 'wheelchairsAvailable')}
                  {numField(t('dataEntry.ppeSets'), 'ppeSetsAvailable', ShieldCheck)}
                </div>
                <div className="grid grid-cols-2 gap-x-6">
                  {boolField(t('dataEntry.ambulanceOperational'), 'ambulanceOperational')}
                  {boolField(t('dataEntry.generatorFunctional'), 'generatorFunctional')}
                  {boolField(t('dataEntry.waterAvailable'), 'waterAvailable')}
                  {boolField(t('dataEntry.wasteDisposalFunctional'), 'wasteDisposalFunctional')}
                </div>
                {numField(t('dataEntry.electricityHoursToday'), 'electricityHoursToday', Zap)}

                {/* 5. Pharmacy & Lab */}
                {sectionHeader(Pill, t('dataEntry.pharmacyLaboratory'), '#EC4899')}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField(t('dataEntry.tracerMedicinesInStock'), 'tracerMedicinesInStock', Pill)}
                  {numField(t('dataEntry.tracerMedicinesTotal'), 'tracerMedicinesTotal')}
                  {numField(t('dataEntry.labTestsDone'), 'labTestsPerformed', FlaskConical)}
                  {numField(t('dataEntry.labTestsPending'), 'labTestsPending')}
                  {numField(t('dataEntry.bloodUnitsAvailable'), 'bloodUnitsAvailable', Droplets)}
                </div>
                {textField(t('dataEntry.stockOutItems'), 'stockOutItems', t('dataEntry.stockOutItemsPlaceholder'))}

                {/* 6. Infection Control */}
                {sectionHeader(ShieldCheck, t('dataEntry.infectionControl'), '#2191D0')}
                <div className="grid grid-cols-2 gap-3">
                  {numField(t('dataEntry.handwashStations'), 'handwashStations')}
                  {numField(t('dataEntry.functionalStations'), 'handwashFunctional')}
                </div>

                {/* 7. Notes */}
                {sectionHeader(FileText, t('dataEntry.dailyNotes'), '#5A7370')}
                {textField(t('dataEntry.challenges'), 'challenges', t('dataEntry.challengesPlaceholder'))}
                {textField(t('dataEntry.achievements'), 'achievements', t('dataEntry.achievementsPlaceholder'))}
                {textField(t('dataEntry.urgentNeeds'), 'urgentNeeds', t('dataEntry.urgentNeedsPlaceholder'))}
              </div>

              {/* Save button */}
              <div className="sticky bottom-0 p-4 rounded-b-lg flex gap-3" style={{ background: 'var(--bg-card-solid)', borderTop: '1px solid var(--border-medium)' }}>
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-md text-xs font-semibold"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  {t('action.cancel')}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-2"
                  style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  <Save className="w-3.5 h-3.5" /> {saving ? t('nurse.savingDots') : t('dataEntry.saveCensusReport')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
