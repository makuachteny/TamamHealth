'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SymptomChecker from '@/components/SymptomChecker';
import { useApp } from '@/lib/context';
import { useBomaVisits } from '@/lib/hooks/useBomaVisits';
import { useFollowUps } from '@/lib/hooks/useFollowUps';
import { useHospitals } from '@/lib/hooks/useHospitals';
import type { PatientDoc } from '@/lib/db-types';
import {
  Home, Users, Plus, Check, ArrowRight, MapPin, Search,
  Heart, AlertTriangle, Clock, ChevronRight, X,
  Thermometer, Droplets, Baby, Bandage, Brain, Wind, Activity,
  Apple, Stethoscope, CircleAlert, CheckCircle2, Pill, FlaskConical,
  Skull, HelpCircle, Send, Loader2, Mic, MicOff,
  Wifi, WifiOff, Navigation,
  Syringe, UtensilsCrossed, CalendarClock,
} from '@/components/icons/lucide';
import { evaluatePatient, type PatientInput } from '@/lib/ai/diagnosis-engine';
import type { AIEvaluation } from '@/lib/db-types';
import { useTranslation } from '@/lib/i18n/useTranslation';

const ACCENT = 'var(--accent-primary)';

// Quick Visit Templates
const VISIT_TEMPLATES = [
  { id: 'routine', label: 'Routine Household', icon: Home, color: 'var(--color-success)',
    chiefComplaint: 'Routine household health check', action: 'treated' as const, symptoms: [] as string[], conditionId: 'other' },
  { id: 'sick-child', label: 'Sick Child', icon: Thermometer, color: 'var(--color-danger)',
    chiefComplaint: 'Child illness assessment', action: '' as const, symptoms: ['fever'], conditionId: 'malaria' },
  { id: 'anc', label: 'ANC Follow-up', icon: Baby, color: '#EC4899',
    chiefComplaint: 'Antenatal care follow-up visit', action: '' as const, symptoms: ['pregnancy'], conditionId: 'pregnancy' },
  { id: 'immunization', label: 'Immunization Defaulter', icon: Syringe, color: '#8B5CF6',
    chiefComplaint: 'Immunization follow-up', action: 'referred' as const, symptoms: [] as string[], conditionId: 'other' },
  { id: 'malnutrition', label: 'Malnutrition Screening', icon: UtensilsCrossed, color: 'var(--color-warning)',
    chiefComplaint: 'Nutritional assessment', action: '' as const, symptoms: ['malnutrition'], conditionId: 'malnutrition' },
];

const CONDITIONS = [
  { id: 'malaria', label: 'Malaria', icon: Thermometer, color: 'var(--color-danger)' },
  { id: 'diarrhea', label: 'Diarrhea', icon: Droplets, color: '#3b82f6' },
  { id: 'pneumonia', label: 'Pneumonia', icon: Stethoscope, color: '#8B5CF6' },
  { id: 'malnutrition', label: 'Malnutrition', icon: Apple, color: 'var(--color-warning)' },
  { id: 'pregnancy', label: 'Pregnancy Issue', icon: Baby, color: '#EC4899' },
  { id: 'injury', label: 'Injury', icon: Bandage, color: '#FB923C' },
  { id: 'mental', label: 'Mental Health', icon: Brain, color: '#06B6D4' },
  { id: 'other', label: 'Other', icon: CircleAlert, color: '#5A7370' },
];

const SYMPTOM_GROUPS = [
  { id: 'fever', label: 'Fever / Hot Body', icon: Thermometer, color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)', keywords: 'fever headache chills sweating body ache' },
  { id: 'diarrhea', label: 'Diarrhea / Vomiting', icon: Droplets, color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)', keywords: 'diarrhea vomiting watery stool dehydration loose stool' },
  { id: 'cough', label: 'Cough / Breathing', icon: Wind, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', keywords: 'cough difficulty breathing shortness of breath chest pain' },
  { id: 'skin', label: 'Rash / Skin Problem', icon: Activity, color: '#EC4899', bg: 'rgba(236,72,153,0.1)', keywords: 'rash skin red eyes measles itching swelling' },
  { id: 'weakness', label: 'Weakness / Pale', icon: Heart, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', keywords: 'fatigue weakness pale pallor dizzy weight loss' },
  { id: 'pregnancy', label: 'Pregnancy Problem', icon: Baby, color: '#EC4899', bg: 'rgba(236,72,153,0.1)', keywords: 'pregnant bleeding swelling headache blurred vision edema' },
  { id: 'pain', label: 'Belly / Body Pain', icon: AlertTriangle, color: '#F97316', bg: 'rgba(249,115,22,0.1)', keywords: 'abdominal pain body pain burning urination' },
  { id: 'malnutrition', label: 'Not Eating / Thin', icon: Apple, color: 'var(--color-warning)', bg: 'rgba(217,119,6,0.1)', keywords: 'weight loss malnutrition wasting not eating swollen feet' },
  { id: 'injury', label: 'Injury / Wound', icon: Bandage, color: '#FB923C', bg: 'rgba(251,146,60,0.1)', keywords: 'injury wound cut fracture bleeding trauma' },
  { id: 'mental', label: 'Confusion / Mood', icon: Brain, color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', keywords: 'confusion anxiety depression mood seizure convulsion' },
];

type VisitFormStep = 'closed' | 'search' | 'patient' | 'symptoms' | 'evaluation' | 'action' | 'done';

export default function BomaDashboardPage() {
  const { t } = useTranslation();
  const { currentUser, isOnline } = useApp();
  const workerId = currentUser?._id || '';
  const { todaysVisits, stats, loading, createVisit } = useBomaVisits(workerId);
  const { followUps, updateFollowUp, createFollowUp, loading: followUpsLoading } = useFollowUps(workerId);
  const [showFuModal, setShowFuModal] = useState(false);
  const [fuForm, setFuForm] = useState({
    patientName: '',
    geocodeId: '',
    condition: 'Maternal',
    scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: '',
  });
  const [fuSubmitting, setFuSubmitting] = useState(false);

  const handleCreateFollowUp = async () => {
    if (!fuForm.patientName.trim()) return;
    try {
      setFuSubmitting(true);
      await createFollowUp({
        patientId: `boma-${Date.now().toString(36)}`,
        patientName: fuForm.patientName.trim(),
        geocodeId: fuForm.geocodeId.trim() || undefined,
        assignedWorker: workerId,
        assignedWorkerName: currentUser?.name || 'BHW',
        status: 'active',
        condition: fuForm.condition,
        facilityLevel: 'boma',
        scheduledDate: fuForm.scheduledDate,
        notes: fuForm.notes.trim() || undefined,
        state: currentUser?.hospitalName || 'Unknown',
        county: 'Unknown',
        orgId: currentUser?.orgId,
      });
      setShowFuModal(false);
      setFuForm({ patientName: '', geocodeId: '', condition: 'Maternal', scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), notes: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setFuSubmitting(false);
    }
  };
  const router = useRouter();
  const { hospitals } = useHospitals();
  const payamFacilities = hospitals.filter(h => h.facilityType === 'phcu');

  const [formStep, setFormStep] = useState<VisitFormStep>('closed');
  const [visitForm, setVisitForm] = useState({
    patientName: '', geocodeId: '', condition: '',
    action: '' as '' | 'treated' | 'referred',
    referredTo: '', treatmentGiven: '', chiefComplaint: '',
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [aiEvaluation, setAiEvaluation] = useState<AIEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSymptomChecker, setShowSymptomChecker] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [referralFacilityId, setReferralFacilityId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'capturing' | 'captured' | 'denied'>('idle');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientDoc[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();
  const newPatientHandledRef = useRef(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      const { searchPatients: searchFn } = await import('@/lib/services/patient-service');
      const results = await searchFn(value.trim());
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
  }, []);

  const handleSelectPatient = useCallback((patient: PatientDoc) => {
    const fullName = [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ');
    setVisitForm(prev => ({ ...prev, patientName: fullName, geocodeId: patient.geocodeId || prev.geocodeId }));
    setSelectedPatientId(patient._id);
    setSearchQuery(''); setSearchResults([]); setIsNewPatient(false); setFormStep('symptoms');
  }, []);

  useEffect(() => {
    const newPatientId = searchParams.get('newPatientId');
    if (!newPatientId || newPatientHandledRef.current) return;
    newPatientHandledRef.current = true;
    (async () => {
      try {
        const { getPatientById } = await import('@/lib/services/patient-service');
        const patient = await getPatientById(newPatientId);
        if (patient) handleSelectPatient(patient);
      } catch (err) { console.error('Failed to load new patient:', err); }
      window.history.replaceState({}, '', '/dashboard/boma');
    })();
  }, [searchParams, handleSelectPatient]);

  useEffect(() => { return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); }; }, []);

  const captureGPS = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) { setGpsStatus('denied'); return; }
    setGpsStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus('captured'); },
      () => { setGpsStatus('denied'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (formStep === 'search' || formStep === 'patient') captureGPS();
    if (formStep === 'closed') { setGpsCoords(null); setGpsStatus('idle'); }
  }, [formStep, captureGPS]);

  useEffect(() => {
    const checkPending = async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const db = getDB('tamamhealth_boma_visits');
        const result = await db.allDocs({ include_docs: true, startkey: 'boma_visit:', endkey: 'boma_visit:\uffff' });
        const cnt = result.rows.filter(r => { const d = r.doc as Record<string, unknown> | undefined; return d && !d._rev?.toString().startsWith('2-'); }).length;
        setPendingSyncCount(isOnline ? 0 : cnt);
      } catch { setPendingSyncCount(0); }
    };
    checkPending();
    const iv = setInterval(checkPending, 15000);
    return () => clearInterval(iv);
  }, [isOnline]);

  const applyTemplate = useCallback((templateId: string) => {
    const tpl = VISIT_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    setVisitForm(prev => ({ ...prev, condition: tpl.conditionId, action: tpl.action || prev.action, chiefComplaint: tpl.chiefComplaint }));
    setSelectedSymptoms(tpl.symptoms);
    setFormStep('search');
  }, []);

  const resetForm = useCallback(() => {
    setFormStep('closed');
    setVisitForm({ patientName: '', geocodeId: '', condition: '', action: '', referredTo: '', treatmentGiven: '', chiefComplaint: '' });
    setSelectedSymptoms([]); setAiEvaluation(null); setSearchQuery(''); setSearchResults([]); setIsNewPatient(false);
    setSelectedPatientId(undefined); setReferralFacilityId('');
  }, []);

  const handleSubmitVisit = useCallback(async () => {
    if (!currentUser || submitting) return;
    setSubmitting(true);
    try {
      if (isNewPatient && visitForm.patientName) {
        try {
          const { createPatient } = await import('@/lib/services/patient-service');
          const nameParts = visitForm.patientName.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
          await createPatient({
            firstName, middleName: middleName || undefined, surname,
            gender: 'Unknown' as PatientDoc['gender'],
            geocodeId: visitForm.geocodeId || undefined,
            boma: 'Kajo-keji', county: 'Kajo-keji', state: 'Central Equatoria', payam: 'Kajo-keji',
            registrationHospital: currentUser.hospitalId || 'phcu-001',
          } as Omit<PatientDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);
        } catch (err) { console.error('Failed to create patient record:', err); }
      }
      const conditionLabel = CONDITIONS.find(c => c.id === visitForm.condition)?.label || visitForm.condition;
      const chiefComplaintText = visitForm.chiefComplaint || conditionLabel;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const visitData: any = {
        workerId: currentUser._id, workerName: currentUser.name, assignedBoma: 'KJ',
        geocodeId: visitForm.geocodeId || `BOMA-KJ-HH${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: visitForm.patientName, visitDate: new Date().toISOString(),
        chiefComplaint: chiefComplaintText, suspectedCondition: conditionLabel,
        action: visitForm.action as 'treated' | 'referred',
        referredTo: visitForm.action === 'referred' ? visitForm.referredTo : undefined,
        treatmentGiven: visitForm.action === 'treated' ? visitForm.treatmentGiven : undefined,
        outcome: 'unknown', followUpRequired: true,
        state: 'Central Equatoria', county: 'Kajo-keji', payam: 'Kajo-keji', boma: 'Kajo-keji',
      };
      if (gpsCoords) { visitData.gpsLat = gpsCoords.lat; visitData.gpsLng = gpsCoords.lng; }
      await createVisit(visitData);
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // Create a formal ReferralDoc when the BHW refers a patient to a facility
      if (visitForm.action === 'referred' && visitForm.referredTo) {
        try {
          const { createReferral } = await import('@/lib/services/referral-service');
          const urgency: 'routine' | 'urgent' | 'emergency' = aiEvaluation?.suggestedDiagnoses?.[0]?.severity === 'severe'
            ? 'emergency'
            : aiEvaluation?.suggestedDiagnoses?.[0]?.severity === 'moderate'
              ? 'urgent'
              : 'routine';
          const reason = [chiefComplaintText, conditionLabel].filter(Boolean).join(' - ');
          await createReferral({
            patientId: selectedPatientId || '',
            patientName: visitForm.patientName,
            fromHospitalId: currentUser.hospitalId || 'boma-community',
            fromHospital: currentUser.hospitalName || 'Boma Health Post',
            toHospitalId: referralFacilityId || '',
            toHospital: visitForm.referredTo,
            referralDate: new Date().toISOString(),
            urgency,
            reason,
            department: 'General Medicine',
            status: 'sent',
            referringDoctor: currentUser.name,
            notes: aiEvaluation?.clinicalNotes || `BHW community referral: ${chiefComplaintText}`,
          });
        } catch (refErr) {
          console.error('Failed to create referral document:', refErr);
        }
      }

      setFormStep('done'); setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); resetForm(); }, 2000);
    } catch (err) { console.error('Failed to save visit:', err); }
    finally { setSubmitting(false); }
  }, [currentUser, visitForm, submitting, createVisit, isNewPatient, gpsCoords, resetForm, aiEvaluation, selectedPatientId, referralFacilityId]);

  const toggleSymptom = (id: string) => { setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]); };

  const runAiEvaluation = useCallback(() => {
    if (selectedSymptoms.length === 0) return;
    setEvaluating(true);
    const chiefComplaint = selectedSymptoms.map(id => SYMPTOM_GROUPS.find(g => g.id === id)?.keywords || '').join(' ');
    const hasFever = selectedSymptoms.includes('fever');
    const hasCough = selectedSymptoms.includes('cough');
    const hasPregnancy = selectedSymptoms.includes('pregnancy');
    const input: PatientInput = {
      chiefComplaint,
      vitals: { temperature: hasFever ? 38.5 : 37.0, systolic: hasPregnancy ? 150 : 120, diastolic: hasPregnancy ? 95 : 80, pulse: hasFever ? 105 : 80, respiratoryRate: hasCough ? 26 : 18, oxygenSaturation: hasCough ? 93 : 98, weight: 60, height: 165, muac: selectedSymptoms.includes('malnutrition') ? 11.0 : undefined },
      age: 25, gender: 'Male',
      physicalExam: { general: selectedSymptoms.includes('weakness') ? 'pallor, lethargic' : 'alert', cardiovascular: '', respiratory: hasCough ? 'crackles, reduced breath sounds' : 'clear', abdominal: selectedSymptoms.includes('pain') ? 'tender abdomen' : 'soft, non-tender', neurological: '' },
      chronicConditions: [], allergies: [],
    };
    setTimeout(() => {
      const result = evaluatePatient(input);
      setAiEvaluation(result);
      const topDx = result.suggestedDiagnoses[0];
      if (topDx) {
        const condId = CONDITIONS.find(c => topDx.name.toLowerCase().includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(topDx.name.toLowerCase().split(' ')[0]))?.id || 'other';
        setVisitForm(prev => ({ ...prev, condition: condId }));
      }
      setFormStep('evaluation'); setEvaluating(false);
    }, 800);
  }, [selectedSymptoms]);

  const handleFollowUpAction = useCallback(async (id: string, action: 'recovered' | 'died' | 'under_treatment' | 'lost_to_followup') => {
    const status = action === 'recovered' || action === 'died' ? 'completed' as const : action === 'lost_to_followup' ? 'lost_to_followup' as const : 'active' as const;
    const outcome = action === 'lost_to_followup' ? undefined : action;
    await updateFollowUp(id, { status, outcome, completedDate: new Date().toISOString() });
  }, [updateFollowUp]);

  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      /* eslint-disable @typescript-eslint/no-explicit-any */
      if (typeof window !== 'undefined' && (window as any).__bhwRecognition) { (window as any).__bhwRecognition.stop(); }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } else {
      setIsRecording(true); setVoiceTranscript('');
      if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US';
        recognition.onresult = (event: any) => { let transcript = ''; for (let i = 0; i < event.results.length; i++) { transcript += event.results[i][0].transcript; } setVoiceTranscript(transcript); };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        recognition.start();
        (window as any).__bhwRecognition = recognition;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }
    }
  }, [isRecording]);

  if (!currentUser) return null;

  const displayName = currentUser.name.split(' ').pop() || currentUser.name;
  const hr = new Date().getHours();
  const greeting = hr < 12 ? t('boma.greetingMorning') : hr < 17 ? t('boma.greetingAfternoon') : t('boma.greetingEvening');
  const todayDate = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const _todayTreated = todaysVisits.filter(v => v.action === 'treated').length; void _todayTreated;
  const todayReferred = todaysVisits.filter(v => v.action === 'referred').length;
  const pendingFollowUps = followUps.filter(f => f.status === 'active' || f.status === 'missed');

  // Follow-ups due today or overdue
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueTodayFollowUps = pendingFollowUps.filter(fu => {
    if (!fu.scheduledDate) return false;
    const scheduled = new Date(fu.scheduledDate); scheduled.setHours(0, 0, 0, 0);
    return scheduled.getTime() <= todayStart.getTime();
  }).sort((a, b) => new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime());

  return (
    <>
      <TopBar title={t('boma.title')} />
      <main className="page-container page-enter">

        {/* OFFLINE SYNC STATUS BAR */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{
          background: isOnline ? (pendingSyncCount > 0 ? '#F59E0B10' : '#05966910') : '#EF444410',
          border: `1px solid ${isOnline ? (pendingSyncCount > 0 ? '#F59E0B20' : '#05966920') : '#EF444420'}`,
        }}>
          {isOnline ? (
            pendingSyncCount > 0 ? (
              <><Wifi className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} /><span className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>{t('boma.visitsPendingSync', { count: pendingSyncCount })}</span></>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} /><span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>{t('boma.allSynced')}</span></>
            )
          ) : (
            <><WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} /><span className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>{pendingSyncCount > 0 ? t('boma.offlinePendingSync', { count: pendingSyncCount }) : t('boma.offlineSavedLocally')}</span></>
          )}
        </div>

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-primary)' }}>
              <Home className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t('boma.greeting', { greeting, name: displayName })}</h1>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('boma.locationLabel', { date: todayDate })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="kpi-grid mb-3">
          {[
            { id: 'households', label: t('boma.kpiHouseholds'), value: stats?.uniqueHouseholds.toString() || '40', icon: Home, color: 'var(--accent-primary)', bg: 'rgba(0,119,215,0.12)' },
            { id: 'seenToday', label: t('boma.kpiSeenToday'), value: todaysVisits.length.toString(), icon: Users, color: 'var(--accent-primary)', bg: 'rgba(0,119,215,0.12)' },
            { id: 'followUps', label: t('boma.kpiFollowUps'), value: pendingFollowUps.length.toString(), icon: Clock, color: 'var(--accent-primary)', bg: 'rgba(0,119,215,0.12)' },
            { id: 'referrals', label: t('boma.kpiReferrals'), value: todayReferred.toString(), icon: ArrowRight, color: 'var(--accent-primary)', bg: 'rgba(0,119,215,0.12)' },
          ].map(kpi => (
            <div key={kpi.id} className="kpi cursor-pointer"
              onClick={() => { if (kpi.id === 'referrals') router.push('/referrals'); }}>
              <div className="kpi__icon" style={{ background: kpi.bg }}>
                <kpi.icon style={{ color: kpi.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{loading ? '\u2014' : kpi.value}</div>
                <div className="kpi__label">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOLLOW-UP REMINDERS - DUE TODAY */}
        {dueTodayFollowUps.length > 0 && formStep === 'closed' && (
          <div className="dash-card mb-4 overflow-hidden" style={{ border: '1px solid #F59E0B30' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#F59E0B10', borderBottom: '1px solid #F59E0B20' }}>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>{t('boma.dueToday')}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#F59E0B20', color: 'var(--color-warning)' }}>{dueTodayFollowUps.length}</span>
              </div>
            </div>
            <div className="p-3 space-y-1.5" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {dueTodayFollowUps.map(fu => {
                const daysOverdue = fu.scheduledDate ? Math.max(0, Math.floor((Date.now() - new Date(fu.scheduledDate).getTime()) / 86400000)) : 0;
                return (
                  <button key={fu._id}
                    onClick={() => {
                      setVisitForm(prev => ({ ...prev, patientName: fu.patientName, geocodeId: fu.geocodeId || '', chiefComplaint: t('boma.followUpComplaint', { condition: fu.condition }), condition: CONDITIONS.find(c => c.label === fu.condition)?.id || 'other' }));
                      setFormStep('symptoms');
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                    style={{ background: daysOverdue > 0 ? '#EF444408' : 'var(--overlay-subtle)', border: daysOverdue > 0 ? '1px solid #EF444415' : '1px solid var(--border-light)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: daysOverdue > 2 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                      {fu.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{fu.patientName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: CONDITIONS.find(c => c.label === fu.condition)?.color || '#5A7370' }}>{fu.condition}</span>
                        {fu.scheduledDate && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(fu.scheduledDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                    {daysOverdue > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#EF444415', color: 'var(--color-danger)' }}>{t('boma.daysOverdue', { days: daysOverdue })}</span>}
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUICK VISIT TEMPLATES */}
        {formStep === 'closed' && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('boma.quickVisitTemplates')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {VISIT_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-[0.97] flex-shrink-0"
                  style={{ background: 'var(--bg-card)', border: `1px solid ${tpl.color}30`, boxShadow: 'var(--card-shadow)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tpl.color}15` }}>
                    <tpl.icon className="w-3.5 h-3.5" style={{ color: tpl.color }} />
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        {formStep === 'closed' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => setFormStep('search')} className="rounded-xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]"
              style={{ background: 'var(--accent-primary)', color: 'white', boxShadow: `0 4px 20px ${ACCENT}40` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}><Search className="w-5 h-5" /></div>
              <div className="text-left"><p className="text-sm font-bold">{t('boma.findPatient')}</p><p className="text-xs opacity-80">{t('boma.findPatientDesc')}</p></div>
            </button>
            <button onClick={() => router.push('/patients/new')} className="rounded-xl p-3.5 flex items-center gap-3 transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-card)', border: '2px solid var(--accent-primary)', boxShadow: 'var(--card-shadow)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}15` }}><Users className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /></div>
              <div className="text-left"><p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('boma.addNewPatient')}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('boma.registerPatient')}</p></div>
            </button>
          </div>
        )}

        {/* VISIT FORM */}
        {formStep !== 'closed' && formStep !== 'done' && (
          <div className="dash-card mb-4 overflow-hidden" style={{ border: `2px solid ${ACCENT}`, boxShadow: `0 4px 24px ${ACCENT}20` }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: `${ACCENT}10` }}>
              <div className="flex items-center gap-2">
                {formStep === 'search' ? <Search className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /> : <Plus className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />}
                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {formStep === 'search' ? t('boma.findPatient') : formStep === 'patient' ? t('boma.newPatientDetails') : formStep === 'symptoms' ? t('boma.signsSymptoms') : formStep === 'evaluation' ? t('boma.aiDiagnosis') : t('boma.takeAction')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {gpsStatus !== 'idle' && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: gpsStatus === 'captured' ? '#05966910' : gpsStatus === 'capturing' ? '#3b82f610' : '#EF444410' }}>
                    <Navigation className="w-3 h-3" style={{ color: gpsStatus === 'captured' ? 'var(--color-success)' : gpsStatus === 'capturing' ? '#3b82f6' : 'var(--color-danger)' }} />
                    <span className="text-[9px] font-bold" style={{ color: gpsStatus === 'captured' ? 'var(--color-success)' : gpsStatus === 'capturing' ? '#3b82f6' : 'var(--color-danger)' }}>
                      {gpsStatus === 'captured' ? t('boma.gpsCaptured') : gpsStatus === 'capturing' ? t('boma.gpsCapturing') : t('boma.gpsNone')}
                    </span>
                  </div>
                )}
                <button onClick={resetForm}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
              </div>
            </div>
            {visitForm.chiefComplaint && formStep === 'search' && (
              <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#05966908', borderBottom: '1px solid #05966915' }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>{t('boma.templateLabel', { complaint: visitForm.chiefComplaint })}</span>
              </div>
            )}
            <div className="p-4">
              {formStep === 'search' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input type="text" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder={t('boma.searchPlaceholder')} autoFocus
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-base" style={{ background: 'var(--bg-input)', border: '2px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '48px' }} />
                  </div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {searchLoading && (<div className="flex items-center justify-center py-6 gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('boma.searching')}</span></div>)}
                    {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (<div className="text-center py-6"><Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} /><p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t('boma.noPatientsFound')}</p><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('boma.noPatientsFoundHint')}</p></div>)}
                    {!searchLoading && searchQuery.trim().length < 2 && (<div className="text-center py-6"><Search className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('boma.searchMinChars')}</p></div>)}
                    {!searchLoading && searchResults.length > 0 && (
                      <div className="space-y-1.5">
                        {searchResults.map(patient => {
                          const fullName = [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ');
                          const initials = `${patient.firstName?.[0] || ''}${patient.surname?.[0] || ''}`.toUpperCase();
                          const age = patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : patient.estimatedAge;
                          return (
                            <button key={patient._id} onClick={() => handleSelectPatient(patient)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: ACCENT }}>{initials}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{fullName}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {patient.geocodeId && <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{patient.geocodeId}</span>}
                                  {patient.hospitalNumber && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{patient.hospitalNumber}</span>}
                                </div>
                              </div>
                              {age != null && <span className="text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0" style={{ background: `${ACCENT}15`, color: ACCENT }}>{age}y {patient.gender?.[0]}</span>}
                              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <button onClick={() => router.push('/patients/new')} className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]" style={{ background: 'var(--overlay-subtle)', border: '2px dashed var(--border-medium)', color: 'var(--text-secondary)' }}><Plus className="w-4 h-4" /> {t('boma.registerNewPatient')}</button>
                  </div>
                </div>
              )}

              {formStep === 'patient' && (
                <div className="space-y-4">
                  <div><label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('patient.name')}</label><input type="text" value={visitForm.patientName} onChange={e => setVisitForm(prev => ({ ...prev, patientName: e.target.value }))} placeholder={t('boma.patientNamePlaceholder')} className="w-full px-4 py-3 rounded-xl text-base" style={{ background: 'var(--bg-input)', border: '2px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '48px' }} /></div>
                  <div><label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('boma.geocodeId')}</label><input type="text" value={visitForm.geocodeId} onChange={e => setVisitForm(prev => ({ ...prev, geocodeId: e.target.value.toUpperCase() }))} placeholder="BOMA-XX-HH1001" className="w-full px-4 py-3 rounded-xl text-base font-mono" style={{ background: 'var(--bg-input)', border: '2px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '48px' }} /></div>
                  {voiceTranscript && (<div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}><Mic className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info)' }} /><p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{voiceTranscript}</p><button onClick={() => setVoiceTranscript('')} className="flex-shrink-0"><X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button></div>)}
                  <button onClick={() => visitForm.patientName && setFormStep('symptoms')} disabled={!visitForm.patientName} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]" style={{ background: visitForm.patientName ? 'var(--accent-primary)' : 'var(--text-muted)', minHeight: '56px', fontSize: '16px' }}>{t('boma.nextSignsSymptoms')} <ArrowRight className="w-5 h-5" /></button>
                </div>
              )}

              {formStep === 'symptoms' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{t('boma.symptomsQuestion')}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('boma.tapAllThatApply')}</p></div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setShowSymptomChecker(!showSymptomChecker)} className="flex items-center gap-1.5 px-3 rounded-full transition-all active:scale-95" style={{ height: '32px', background: showSymptomChecker ? `${ACCENT}15` : 'var(--bg-card)', border: showSymptomChecker ? `2px solid ${ACCENT}` : '1px solid var(--border-light)', boxShadow: 'var(--card-shadow)' }}>
                        <Stethoscope className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /><span className="text-[11px] font-semibold" style={{ color: showSymptomChecker ? 'var(--accent-primary)' : 'var(--text-primary)' }}>AI</span>
                      </button>
                      <button onClick={handleVoiceToggle} className="flex items-center gap-1.5 px-3 rounded-full transition-all active:scale-95" style={{ height: '32px', background: isRecording ? 'var(--color-danger)' : 'var(--bg-card)', border: isRecording ? '2px solid var(--color-danger)' : '1px solid var(--border-light)', boxShadow: 'var(--card-shadow)' }}>
                        {isRecording ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5" style={{ color: 'var(--color-info)' }} />}
                        <span className="text-[11px] font-semibold" style={{ color: isRecording ? 'white' : 'var(--text-primary)' }}>{isRecording ? t('boma.voiceStop') : t('boma.voice')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {SYMPTOM_GROUPS.map(group => {
                      const isSelected = selectedSymptoms.includes(group.id);
                      return (
                        <button key={group.id} onClick={() => toggleSymptom(group.id)} className="flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.97]" style={{ background: isSelected ? group.bg : 'var(--overlay-subtle)', border: isSelected ? `2px solid ${group.color}` : '2px solid var(--border-light)' }}>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isSelected ? group.color : 'var(--overlay-medium)' }}><group.icon className="w-4 h-4" style={{ color: isSelected ? 'white' : group.color }} /></div>
                          <span className="text-xs font-semibold flex-1" style={{ color: isSelected ? group.color : 'var(--text-primary)' }}>{group.label}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: group.color }} />}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={runAiEvaluation} disabled={selectedSymptoms.length === 0 || evaluating} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]" style={{ background: selectedSymptoms.length > 0 ? 'var(--color-success)' : 'var(--text-muted)', minHeight: '56px', fontSize: '16px', boxShadow: selectedSymptoms.length > 0 ? '0 4px 16px rgba(5,150,105,0.3)' : 'none' }}>
                    {evaluating ? (<><Loader2 className="w-5 h-5 animate-spin" /> {t('boma.analyzingSymptoms')}</>) : (<><Stethoscope className="w-5 h-5" /> {t('boma.evaluateWithCount', { count: selectedSymptoms.length })} <ArrowRight className="w-5 h-5" /></>)}
                  </button>
                </div>
              )}

              {formStep === 'evaluation' && aiEvaluation && (
                <div>
                  <div className="p-3 rounded-xl mb-3" style={{ background: aiEvaluation.severityAssessment.includes('HIGH') ? 'rgba(239,68,68,0.1)' : aiEvaluation.severityAssessment.includes('MODERATE') ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${aiEvaluation.severityAssessment.includes('HIGH') ? 'rgba(239,68,68,0.2)' : aiEvaluation.severityAssessment.includes('MODERATE') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" style={{ color: aiEvaluation.severityAssessment.includes('HIGH') ? 'var(--color-danger)' : aiEvaluation.severityAssessment.includes('MODERATE') ? 'var(--color-warning)' : 'var(--color-success)' }} />
                      <span className="text-xs font-bold" style={{ color: aiEvaluation.severityAssessment.includes('HIGH') ? 'var(--color-danger)' : aiEvaluation.severityAssessment.includes('MODERATE') ? 'var(--color-warning)' : 'var(--color-success)' }}>{aiEvaluation.severityAssessment.split(' \u2014 ')[0]}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{aiEvaluation.severityAssessment.split(' \u2014 ')[1]}</p>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('boma.aiSuggestedConditions')}</p>
                  <div className="space-y-2 mb-3">
                    {aiEvaluation.suggestedDiagnoses.slice(0, 3).map((dx, i) => (
                      <div key={dx.icd10Code} className="p-3 rounded-xl" style={{ background: i === 0 ? 'rgba(5,150,105,0.06)' : 'var(--overlay-subtle)', border: i === 0 ? '1px solid rgba(5,150,105,0.2)' : '1px solid var(--border-light)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: i === 0 ? 'var(--color-success)' : 'var(--overlay-medium)', color: i === 0 ? 'white' : 'var(--text-muted)' }}>#{i + 1}</span><span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dx.name}</span></div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: dx.severity === 'severe' ? 'rgba(239,68,68,0.1)' : dx.severity === 'moderate' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: dx.severity === 'severe' ? 'var(--color-danger)' : dx.severity === 'moderate' ? 'var(--color-warning)' : 'var(--color-success)' }}>{dx.severity}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1.5"><div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--overlay-medium)' }}><div className="h-full rounded-full" style={{ width: `${dx.confidence}%`, background: dx.confidence >= 60 ? 'var(--color-success)' : dx.confidence >= 40 ? 'var(--color-warning)' : 'var(--text-muted)' }} /></div><span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{dx.confidence}%</span></div>
                        <div className="flex items-start gap-1.5"><Pill className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} /><p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{dx.suggestedTreatment}</p></div>
                      </div>
                    ))}
                  </div>
                  {aiEvaluation.recommendedTests.length > 0 && (<div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('boma.recommendedTests')}</p><div className="flex flex-wrap gap-1.5">{aiEvaluation.recommendedTests.map(test => (<span key={test} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)' }}><FlaskConical className="w-2.5 h-2.5" /> {test}</span>))}</div></div>)}
                  <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)' }}><p className="text-xs font-bold mb-1" style={{ color: 'var(--color-success)' }}><ChevronRight className="w-3 h-3 inline" /> {t('boma.whatShouldIDo')}</p><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{aiEvaluation.severityAssessment.includes('HIGH') ? t('boma.guidanceHigh') : aiEvaluation.severityAssessment.includes('MODERATE') ? t('boma.guidanceModerate') : t('boma.guidanceLow')}</p></div>
                  <button onClick={() => setFormStep('action')} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]" style={{ background: 'var(--accent-primary)', minHeight: '56px', fontSize: '16px' }}>{t('boma.nextTakeAction')} <ArrowRight className="w-5 h-5" /></button>
                  <p className="text-[9px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('boma.aiDisclaimer')}</p>
                </div>
              )}

              {formStep === 'action' && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('boma.whatActionTaken')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setVisitForm(prev => ({ ...prev, action: 'treated' }))} className="p-5 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95" style={{ background: visitForm.action === 'treated' ? 'var(--accent-primary)' : 'var(--overlay-subtle)', border: visitForm.action === 'treated' ? `3px solid ${ACCENT}` : '2px solid var(--border-medium)', color: visitForm.action === 'treated' ? 'white' : 'var(--text-primary)', minHeight: '100px' }}><CheckCircle2 className="w-10 h-10" /><span className="text-lg font-bold">{t('boma.treated')}</span><span className="text-xs opacity-70">{t('boma.treatedHere')}</span></button>
                    <button onClick={() => setVisitForm(prev => ({ ...prev, action: 'referred' }))} className="p-5 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95" style={{ background: visitForm.action === 'referred' ? 'var(--color-danger)' : 'var(--overlay-subtle)', border: visitForm.action === 'referred' ? '3px solid var(--color-danger)' : '2px solid var(--border-medium)', color: visitForm.action === 'referred' ? 'white' : 'var(--text-primary)', minHeight: '100px' }}><Send className="w-10 h-10" /><span className="text-lg font-bold">{t('boma.referred')}</span><span className="text-xs opacity-70">{t('boma.sentToFacility')}</span></button>
                  </div>
                  {visitForm.action === 'treated' && (<div><label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('boma.treatmentGiven')}</label><input type="text" value={visitForm.treatmentGiven} onChange={e => setVisitForm(prev => ({ ...prev, treatmentGiven: e.target.value }))} placeholder={t('boma.treatmentGivenPlaceholder')} className="w-full px-4 py-3 rounded-xl text-base" style={{ background: 'var(--bg-input)', border: '2px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '48px' }} /></div>)}
                  {visitForm.action === 'referred' && (<div><label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('boma.referredTo')}</label><select value={visitForm.referredTo} onChange={e => { const facility = payamFacilities.find(f => f.name === e.target.value); setVisitForm(prev => ({ ...prev, referredTo: e.target.value })); setReferralFacilityId(facility?._id || ''); }} className="w-full px-4 py-3 rounded-xl text-base" style={{ background: 'var(--bg-input)', border: '2px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: '48px' }}><option value="">{t('boma.selectPayamFacility')}</option>{payamFacilities.map(f => <option key={f._id} value={f.name}>{f.name} &mdash; {f.state}</option>)}</select><p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{t('boma.referralNote')}</p></div>)}
                  {visitForm.action && (<button onClick={handleSubmitVisit} disabled={submitting} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]" style={{ background: 'var(--accent-primary)', minHeight: '56px', fontSize: '16px', boxShadow: `0 4px 16px ${ACCENT}40`, opacity: submitting ? 0.7 : 1 }}>{submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}{submitting ? t('boma.saving') : t('boma.saveVisit')}</button>)}
                </div>
              )}
            </div>
          </div>
        )}

        {showSuccess && (<div className="rounded-2xl p-5 mb-4 flex items-center gap-3" style={{ background: 'var(--accent-primary)', color: 'white' }}><CheckCircle2 className="w-8 h-8" /><div><p className="font-bold text-lg">{visitForm.action === 'referred' ? t('boma.visitSavedReferralSent') : t('boma.visitSaved')}</p><p className="text-sm opacity-80">{visitForm.patientName} &mdash; {CONDITIONS.find(c => c.id === visitForm.condition)?.label}{visitForm.action === 'referred' && visitForm.referredTo ? t('boma.referralSentTo', { facility: visitForm.referredTo }) : ''}</p></div></div>)}

        {showSymptomChecker && (
          <div className="dash-card mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2" style={{ background: `${ACCENT}08`, borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /><span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{t('boma.aiSymptomChecker')}</span></div>
              <button onClick={() => setShowSymptomChecker(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <SymptomChecker patientName={visitForm.patientName || undefined} onDiagnosisComplete={(evaluation) => { const topDx = evaluation.suggestedDiagnoses[0]; if (topDx) { const condId = CONDITIONS.find(c => topDx.name.toLowerCase().includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(topDx.name.toLowerCase().split(' ')[0]))?.id || 'other'; setVisitForm(prev => ({ ...prev, condition: condId })); } }} />
          </div>
        )}

        {/* TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FOLLOW-UP QUEUE */}
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} /><span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('boma.followUpQueue')}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#F59E0B20', color: 'var(--color-warning)' }}>{followUpsLoading ? '\u2014' : pendingFollowUps.length}</span></div>
              <button onClick={() => setShowFuModal(true)} className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{t('boma.scheduleShort')}</button>
            </div>
            <div className="p-3 space-y-2">
              {!followUpsLoading && pendingFollowUps.length === 0 && (<div className="text-center py-6"><CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--accent-primary)', opacity: 0.5 }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('boma.allFollowUpsComplete')}</p></div>)}
              {pendingFollowUps.map(fu => (
                <div key={fu._id} className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fu.patientName}</p><p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{fu.geocodeId || '\u2014'}</p></div>
                    <div className="text-right"><p className="text-xs font-medium" style={{ color: CONDITIONS.find(c => c.label === fu.condition)?.color || '#5A7370' }}>{fu.condition}</p><p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('boma.daysAgo', { days: fu.scheduledDate ? Math.floor((Date.now() - new Date(fu.scheduledDate).getTime()) / 86400000) : 0 })}</p></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button onClick={() => handleFollowUpAction(fu._id, 'recovered')} className="py-2.5 rounded-lg flex flex-col items-center gap-1 transition-all active:scale-95" style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, minHeight: '48px' }}><Heart className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /><span className="text-[9px] font-bold" style={{ color: 'var(--accent-primary)' }}>{t('boma.outcomeWell')}</span></button>
                    <button onClick={() => handleFollowUpAction(fu._id, 'under_treatment')} className="py-2.5 rounded-lg flex flex-col items-center gap-1 transition-all active:scale-95" style={{ background: '#F59E0B15', border: '1px solid #F59E0B30', minHeight: '48px' }}><AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} /><span className="text-[9px] font-bold" style={{ color: 'var(--color-warning)' }}>{t('boma.outcomeSick')}</span></button>
                    <button onClick={() => handleFollowUpAction(fu._id, 'died')} className="py-2.5 rounded-lg flex flex-col items-center gap-1 transition-all active:scale-95" style={{ background: '#EF444415', border: '1px solid #EF444430', minHeight: '48px' }}><Skull className="w-4 h-4" style={{ color: 'var(--color-danger)' }} /><span className="text-[9px] font-bold" style={{ color: 'var(--color-danger)' }}>{t('boma.outcomeDied')}</span></button>
                    <button onClick={() => handleFollowUpAction(fu._id, 'lost_to_followup')} className="py-2.5 rounded-lg flex flex-col items-center gap-1 transition-all active:scale-95" style={{ background: 'var(--overlay-medium)', border: '1px solid var(--border-medium)', minHeight: '48px' }}><HelpCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /><span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>{t('boma.outcomeLost')}</span></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SCHEDULE FOLLOW-UP MODAL */}
          {showFuModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !fuSubmitting && setShowFuModal(false)}>
              <div className="dash-card p-5 w-full max-w-md" style={{ margin: '20px' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} /> {t('boma.scheduleFollowUp')}</h3>
                  <button onClick={() => setShowFuModal(false)} className="p-1 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('boma.patientNameLabel')}</label>
                    <input type="text" value={fuForm.patientName} onChange={e => setFuForm({ ...fuForm, patientName: e.target.value })} placeholder={t('boma.fullNamePlaceholder')} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('boma.geocodeOptional')}</label>
                    <input type="text" value={fuForm.geocodeId} onChange={e => setFuForm({ ...fuForm, geocodeId: e.target.value })} placeholder={t('boma.geocodePlaceholder')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('boma.conditionLabel')}</label>
                      <select value={fuForm.condition} onChange={e => setFuForm({ ...fuForm, condition: e.target.value })}>
                        <option value="Maternal">{t('boma.conditionMaternal')}</option>
                        <option value="Immunization">{t('boma.conditionImmunization')}</option>
                        <option value="Malaria">{t('boma.conditionMalaria')}</option>
                        <option value="Malnutrition">{t('boma.conditionMalnutrition')}</option>
                        <option value="TB">{t('boma.conditionTb')}</option>
                        <option value="HIV">{t('boma.conditionHiv')}</option>
                        <option value="Newborn">{t('boma.conditionNewborn')}</option>
                        <option value="Wound">{t('boma.conditionWound')}</option>
                        <option value="Other">{t('boma.conditionOther')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('boma.visitDate')}</label>
                      <input type="date" value={fuForm.scheduledDate} onChange={e => setFuForm({ ...fuForm, scheduledDate: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('boma.notesLabel')}</label>
                    <textarea rows={2} value={fuForm.notes} onChange={e => setFuForm({ ...fuForm, notes: e.target.value })} placeholder={t('boma.notesPlaceholder')} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowFuModal(false)} className="btn btn-secondary flex-1" disabled={fuSubmitting}>{t('action.cancel')}</button>
                  <button onClick={handleCreateFollowUp} className="btn btn-primary flex-1" disabled={fuSubmitting || !fuForm.patientName.trim()}>
                    {fuSubmitting ? t('boma.savingEllipsis') : t('boma.schedule')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TODAY'S VISITS LOG */}
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /><span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('boma.todaysVisits')}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${ACCENT}15`, color: 'var(--accent-primary)' }}>{todaysVisits.length}</span></div>
            </div>
            <div className="p-3 space-y-1.5" style={{ maxHeight: '440px', overflowY: 'auto' }}>
              {todaysVisits.length === 0 && !loading && (<div className="text-center py-6"><Stethoscope className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.3 }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('boma.noVisitsToday')}</p></div>)}
              {todaysVisits.map(visit => (
                <div key={visit._id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: visit.action === 'treated' ? 'var(--accent-primary)' : 'var(--color-danger)' }}>{visit.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{visit.patientName}</p><div className="flex items-center gap-2"><span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{visit.geocodeId}</span><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{visit.chiefComplaint}</span></div></div>
                  <div className="text-right flex-shrink-0"><span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: visit.action === 'treated' ? `${ACCENT}15` : '#EF444415', color: visit.action === 'treated' ? 'var(--accent-primary)' : 'var(--color-danger)' }}>{visit.action === 'treated' ? t('boma.treated') : t('boma.referred')}</span><p className="text-[9px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>{new Date(visit.visitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p></div>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
