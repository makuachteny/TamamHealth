'use client';

import { useState, useCallback } from 'react';
import {
  Thermometer, Droplets, Wind, Brain, Baby, Heart,
  AlertTriangle, CheckCircle2, Stethoscope, Pill, FlaskConical,
  ChevronRight, X, Loader2, Activity,
} from '@/components/icons/lucide';
import { evaluatePatient, type PatientInput } from '@/lib/ai/diagnosis-engine';
import type { AIEvaluation } from '@/lib/db-types';

// Simplified symptom categories for BHW-level workers
const SYMPTOM_GROUPS = [
  {
    id: 'fever',
    label: 'Fever / Hot',
    icon: Thermometer,
    color: 'var(--color-danger)',
    bg: 'rgba(239,68,68,0.1)',
    keywords: 'fever headache chills sweating body ache',
    followUp: [
      { id: 'high_fever', label: 'Very Hot (>39\u00b0C)', value: 39.5 },
      { id: 'mild_fever', label: 'Warm (37-39\u00b0C)', value: 38.0 },
    ],
  },
  {
    id: 'diarrhea',
    label: 'Diarrhea / Vomiting',
    icon: Droplets,
    color: 'var(--color-warning)',
    bg: 'rgba(245,158,11,0.1)',
    keywords: 'diarrhea vomiting watery stool dehydration loose stool',
    followUp: [
      { id: 'watery', label: 'Watery (like rice water)', value: 1 },
      { id: 'bloody', label: 'Bloody stool', value: 2 },
    ],
  },
  {
    id: 'cough',
    label: 'Cough / Breathing',
    icon: Wind,
    color: 'var(--accent-primary)',
    bg: 'var(--accent-light)',
    keywords: 'cough difficulty breathing shortness of breath chest pain sputum',
    followUp: [
      { id: 'acute_cough', label: 'Started recently (< 2 weeks)', value: 1 },
      { id: 'chronic_cough', label: 'Cough for weeks/months', value: 2 },
    ],
  },
  {
    id: 'skin',
    label: 'Rash / Skin',
    icon: Activity,
    color: 'var(--accent-primary)',
    bg: 'var(--accent-light)',
    keywords: 'rash skin red eyes measles itching swelling',
    followUp: [],
  },
  {
    id: 'weakness',
    label: 'Weakness / Pale',
    icon: Heart,
    color: 'var(--accent-primary)',
    bg: 'var(--accent-light)',
    keywords: 'fatigue weakness pale pallor dizzy weight loss tiredness',
    followUp: [],
  },
  {
    id: 'pregnancy',
    label: 'Pregnancy Problem',
    icon: Baby,
    color: 'var(--accent-primary)',
    bg: 'var(--accent-light)',
    keywords: 'pregnant pregnancy headache swelling blurred vision bleeding edema',
    followUp: [
      { id: 'bleeding', label: 'Bleeding', value: 1 },
      { id: 'swelling', label: 'Swelling + Headache', value: 2 },
    ],
  },
  {
    id: 'pain',
    label: 'Belly Pain',
    icon: AlertTriangle,
    color: 'var(--accent-primary)',
    bg: 'var(--accent-light)',
    keywords: 'abdominal pain burning urination frequency suprapubic pain',
    followUp: [],
  },
  {
    id: 'malnutrition',
    label: 'Not Eating / Thin',
    icon: Brain,
    color: 'var(--color-warning)',
    bg: 'rgba(217,119,6,0.1)',
    keywords: 'weight loss malnutrition wasting not eating poor appetite failure to thrive edema swelling',
    followUp: [
      { id: 'child_thin', label: 'Child very thin', value: 1 },
      { id: 'child_swollen', label: 'Child has swollen feet/face', value: 2 },
    ],
  },
];

interface SymptomCheckerProps {
  patientName?: string;
  patientAge?: number;
  patientGender?: 'Male' | 'Female';
  onDiagnosisComplete?: (evaluation: AIEvaluation) => void;
}

export default function SymptomChecker({
  patientName,
  patientAge,
  patientGender,
  onDiagnosisComplete,
}: SymptomCheckerProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<AIEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [step, setStep] = useState<'symptoms' | 'results'>('symptoms');

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const runDiagnosis = useCallback(() => {
    if (selectedSymptoms.length === 0) return;
    setEvaluating(true);

    // Build chief complaint from selected symptoms
    const chiefComplaint = selectedSymptoms
      .map(id => SYMPTOM_GROUPS.find(g => g.id === id)?.keywords || '')
      .join(' ');

    // Build simplified PatientInput — BHW doesn't have clinical equipment
    // Use reasonable defaults for missing vitals
    const hasFever = selectedSymptoms.includes('fever');
    const hasCough = selectedSymptoms.includes('cough');
    const hasPregnancy = selectedSymptoms.includes('pregnancy');

    const input: PatientInput = {
      chiefComplaint,
      vitals: {
        temperature: hasFever ? 38.5 : 37.0,
        systolic: hasPregnancy ? 150 : 120,
        diastolic: hasPregnancy ? 95 : 80,
        pulse: hasFever ? 105 : 80,
        respiratoryRate: hasCough ? 26 : 18,
        oxygenSaturation: hasCough ? 93 : 98,
        weight: patientAge && patientAge < 5 ? 12 : 60,
        height: patientAge && patientAge < 5 ? 90 : 165,
        muac: selectedSymptoms.includes('malnutrition') ? 11.0 : undefined,
      },
      age: patientAge || 25,
      gender: patientGender || 'Male',
      physicalExam: {
        general: selectedSymptoms.includes('weakness') ? 'pallor, lethargic' : 'alert',
        cardiovascular: '',
        respiratory: hasCough ? 'crackles, reduced breath sounds' : 'clear',
        abdominal: selectedSymptoms.includes('pain') ? 'tender abdomen' : 'soft, non-tender',
        neurological: '',
      },
      chronicConditions: [],
      allergies: [],
    };

    // Small delay to show loading state
    setTimeout(() => {
      const result = evaluatePatient(input);
      setEvaluation(result);
      setStep('results');
      setEvaluating(false);
      onDiagnosisComplete?.(result);
    }, 600);
  }, [selectedSymptoms, patientAge, patientGender, onDiagnosisComplete]);

  const reset = () => {
    setSelectedSymptoms([]);
    setEvaluation(null);
    setStep('symptoms');
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.1)' };
      case 'moderate': return { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)' };
      default: return { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.1)' };
    }
  };

  return (
    <div className="card-elevated" style={{ border: '2px solid rgba(5,150,105,0.2)' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            AI Health Companion
          </h3>
        </div>
        {step === 'results' && (
          <button onClick={reset} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
            <X className="w-3 h-3" /> New Check
          </button>
        )}
      </div>

      {step === 'symptoms' && (
        <div className="p-4">
          {patientName && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Checking symptoms for <strong style={{ color: 'var(--text-primary)' }}>{patientName}</strong>
              {patientAge ? ` (${patientAge}y${patientGender ? `, ${patientGender}` : ''})` : ''}
            </p>
          )}
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            What is the patient complaining about?
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Tap all that apply
          </p>

          {/* Symptom buttons grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {SYMPTOM_GROUPS.map(group => {
              const isSelected = selectedSymptoms.includes(group.id);
              return (
                <button
                  key={group.id}
                  onClick={() => toggleSymptom(group.id)}
                  className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? group.bg : 'var(--overlay-subtle)',
                    border: isSelected ? `2px solid ${group.color}` : '2px solid var(--border-light)',
                    minHeight: '56px',
                  }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? group.color : 'var(--overlay-medium)' }}>
                    <group.icon className="w-4.5 h-4.5" style={{ color: isSelected ? 'white' : group.color }} />
                  </div>
                  <span className="text-sm font-medium" style={{
                    color: isSelected ? group.color : 'var(--text-primary)',
                  }}>
                    {group.label}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: group.color }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Run diagnosis button */}
          <button
            onClick={runDiagnosis}
            disabled={selectedSymptoms.length === 0 || evaluating}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
            style={{
              background: selectedSymptoms.length > 0 ? 'var(--color-success)' : 'var(--overlay-medium)',
              opacity: selectedSymptoms.length === 0 ? 0.5 : 1,
              minHeight: '52px',
            }}
          >
            {evaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing symptoms...
              </>
            ) : (
              <>
                <Stethoscope className="w-4 h-4" />
                Check Diagnosis ({selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''})
              </>
            )}
          </button>
        </div>
      )}

      {step === 'results' && evaluation && (
        <div className="p-4">
          {/* Severity banner */}
          <div className="p-3 rounded-xl mb-4" style={{
            background: evaluation.severityAssessment.includes('HIGH')
              ? 'rgba(239,68,68,0.1)'
              : evaluation.severityAssessment.includes('MODERATE')
                ? 'rgba(245,158,11,0.1)'
                : 'rgba(16,185,129,0.1)',
            border: `1px solid ${evaluation.severityAssessment.includes('HIGH')
              ? 'rgba(239,68,68,0.2)'
              : evaluation.severityAssessment.includes('MODERATE')
                ? 'rgba(245,158,11,0.2)'
                : 'rgba(16,185,129,0.2)'}`,
          }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" style={{
                color: evaluation.severityAssessment.includes('HIGH')
                  ? 'var(--color-danger)'
                  : evaluation.severityAssessment.includes('MODERATE')
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
              }} />
              <span className="text-xs font-bold" style={{
                color: evaluation.severityAssessment.includes('HIGH')
                  ? 'var(--color-danger)'
                  : evaluation.severityAssessment.includes('MODERATE')
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
              }}>
                {evaluation.severityAssessment.split(' \u2014 ')[0]}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {evaluation.severityAssessment.split(' \u2014 ')[1]}
            </p>
          </div>

          {/* Suggested diagnoses */}
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Possible Conditions
          </p>
          <div className="space-y-2.5 mb-4">
            {evaluation.suggestedDiagnoses.slice(0, 3).map((dx, i) => {
              const sev = severityColor(dx.severity);
              return (
                <div key={dx.icd10Code} className="p-3 rounded-xl" style={{
                  background: 'var(--overlay-subtle)',
                  border: '1px solid var(--border-light)',
                }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                        background: i === 0 ? 'var(--color-success)' : 'var(--overlay-medium)',
                        color: i === 0 ? 'white' : 'var(--text-muted)',
                      }}>
                        #{i + 1}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {dx.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                      background: sev.bg,
                      color: sev.color,
                    }}>
                      {dx.severity}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--overlay-medium)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${dx.confidence}%`,
                        background: dx.confidence >= 60 ? 'var(--color-success)' : dx.confidence >= 40 ? 'var(--color-warning)' : 'var(--text-muted)',
                      }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
                      {dx.confidence}%
                    </span>
                  </div>

                  {/* Treatment */}
                  <div className="flex items-start gap-1.5 mt-2">
                    <Pill className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {dx.suggestedTreatment}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommended tests */}
          {evaluation.recommendedTests.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Recommended Tests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {evaluation.recommendedTests.map(test => (
                  <span key={test} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <FlaskConical className="w-3 h-3" />
                    {test}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vital sign alerts */}
          {evaluation.vitalSignAlerts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Alerts
              </p>
              <div className="space-y-1.5">
                {evaluation.vitalSignAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs p-2 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.05)', color: 'var(--color-danger)' }}>
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral decision helper */}
          <div className="p-3 rounded-xl" style={{
            background: 'rgba(5,150,105,0.05)',
            border: '1px solid rgba(5,150,105,0.15)',
          }}>
            <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-success)' }}>
              <ChevronRight className="w-3 h-3 inline" /> What should I do?
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {evaluation.severityAssessment.includes('HIGH')
                ? 'REFER IMMEDIATELY to the nearest PHCC or hospital. This patient needs urgent care. Give first aid and arrange transport.'
                : evaluation.severityAssessment.includes('MODERATE')
                  ? 'Consider referral if you cannot provide the suggested treatment. Monitor the patient closely. Follow up within 24 hours.'
                  : 'You can treat this patient at the community level. Follow the treatment suggestions above. Schedule a follow-up in 2-3 days.'}
            </p>
          </div>

          {/* Learning Tool: Reference Links (Expert: "It also becomes a learning tool for the clinical officer") */}
          <div className="mt-4 p-3 rounded-xl" style={{
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
              <FlaskConical className="w-3 h-3" /> Learn More
            </p>
            <div className="space-y-1.5">
              {evaluation.suggestedDiagnoses.slice(0, 2).map(dx => {
                const searchTerm = encodeURIComponent(`${dx.name} treatment guidelines`);
                return (
                  <div key={dx.icd10Code + '-ref'} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{dx.name}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={`https://www.who.int/search#q=${searchTerm}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)' }}
                      >
                        WHO Guidelines
                      </a>
                      <a
                        href={`https://www.thelancet.com/action/doSearch?text1=${searchTerm}&startPage=0&pageSize=5`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)' }}
                      >
                        Lancet
                      </a>
                      <a
                        href={`https://icd.who.int/browse/2024-01/mms/en#search=${encodeURIComponent(dx.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-primary)' }}
                      >
                        ICD-11: {dx.icd10Code}
                      </a>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                South Sudan National Treatment Guidelines apply. Links for reference only.
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
            AI suggestion based on WHO/IMCI guidelines. Use your clinical judgment.
          </p>
        </div>
      )}
    </div>
  );
}
