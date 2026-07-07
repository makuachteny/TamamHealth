'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { usePatients } from '@/lib/hooks/usePatients';
import type { PatientDoc } from '@/lib/db-types';
import { patientAge, patientFullName } from '@/lib/patient-utils';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Search,
  X,
} from '@/components/icons/lucide';

type IntakeStatus = 'pending_review' | 'not_submitted' | 'merged';
type IntakeSectionKey =
  | 'basic'
  | 'demographics'
  | 'emergency'
  | 'payment'
  | 'responsible'
  | 'obgyn'
  | 'medical'
  | 'additional'
  | 'gad7'
  | 'phq9'
  | 'pcl5';

interface IntakeField {
  id: string;
  label: string;
  section: IntakeSectionKey;
  intakeValue: string;
  chartValue: string;
  selected: boolean;
  conflict?: boolean;
}

interface IntakeRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientMeta: string;
  provider: string;
  status: IntakeStatus;
  sentAt: string;
  receivedAt?: string;
  mergedAt?: string;
  delivery: Array<'sms' | 'email'>;
  forms: IntakeSectionKey[];
  fields: IntakeField[];
}

const STORAGE_KEY = 'tamamhealth.patient-intake.v3';

const SECTION_LABELS: Record<IntakeSectionKey, string> = {
  basic: 'Basic Information',
  demographics: 'Demographics',
  emergency: 'Emergency Contact',
  payment: 'Method of Payment',
  responsible: 'Responsible Party',
  obgyn: 'OB/GYN History',
  medical: 'Medical Intake',
  additional: 'Additional Information',
  gad7: 'GAD-7',
  phq9: 'PHQ-9',
  pcl5: 'PCL-5',
};

const FORM_OPTIONS: Array<{ key: IntakeSectionKey; label: string; desc: string }> = [
  { key: 'basic', label: 'Basic Information', desc: 'Name, phone, county, address' },
  { key: 'demographics', label: 'Demographics', desc: 'Language, ID status, county, boma' },
  { key: 'emergency', label: 'Emergency Contact', desc: 'Next of kin and contact phone' },
  { key: 'payment', label: 'Financial Information', desc: 'Cash, mobile money, waiver, NGO support' },
  { key: 'additional', label: 'Additional Information', desc: 'Allergies, chronic conditions, TB/malaria flags' },
  { key: 'responsible', label: 'Responsible Party', desc: 'Guarantor and billing responsibility' },
  { key: 'obgyn', label: 'OB/GYN History', desc: 'Pregnancy and women health history' },
  { key: 'medical', label: 'Medical Intake', desc: 'Medical history, reminders, and screening notes' },
  { key: 'gad7', label: 'GAD-7', desc: 'Anxiety screening' },
  { key: 'phq9', label: 'PHQ-9', desc: 'Depression screening' },
  { key: 'pcl5', label: 'PCL-5', desc: 'Trauma screening' },
];

const PROVIDERS = [
  'Dr. Achol Mayen Deng',
  'Dr. James Wani Igga',
  'CO Deng Mabior Kuol',
  'Midwife Nyakong Gatkuoth',
  'Nurse Stella Keji Lemi',
];

function buildFields(patient: PatientDoc | undefined, index = 0): IntakeField[] {
  const fullName = patient ? patientFullName(patient) : 'Adut Deng Garang';
  const phone = patient?.phone || '+211 912 555 018';
  const county = patient?.county || 'Juba';
  const state = patient?.state || 'Central Equatoria';
  const nokName = patient?.nokName || 'Deng Garang';
  const nokRelationship = patient?.nokRelationship || 'Spouse';
  const nokPhone = patient?.nokPhone || '+211 915 200 118';
  const allergies = patient?.allergies?.join(', ') || 'None known';
  const chronic = patient?.chronicConditions?.join(', ') || 'None';

  return [
    field('name', 'Full name', 'basic', fullName, fullName),
    field('phone', 'Primary phone', 'basic', normalizePhone(phone, index), phone, true),
    field('state', 'State', 'basic', state, state),
    field('county', 'County', 'basic', county, county),
    field('language', 'Preferred language', 'demographics', index % 2 === 0 ? 'Juba Arabic' : 'Dinka', 'Not recorded', true),
    field('id_status', 'ID status', 'demographics', 'No national ID available', 'Not recorded', true),
    field('nokName', 'Next of kin', 'emergency', nokName, nokName),
    field('nokRelationship', 'Relationship', 'emergency', nokRelationship, nokRelationship),
    field('nokPhone', 'Next-of-kin phone', 'emergency', normalizePhone(nokPhone, index + 1), nokPhone, true),
    field('payment_support', 'Method of payment', 'payment', index % 2 === 0 ? 'Self pay' : 'County waiver assessment requested', 'Not recorded', true),
    field('responsible_name', 'Responsible party', 'responsible', nokName, 'Not recorded', true),
    field('responsible_relationship', 'Responsible party relationship', 'responsible', nokRelationship, 'Not recorded', true),
    field('obgyn_pregnancy', 'Pregnancy status', 'obgyn', patient?.gender === 'Female' ? 'Not currently pregnant' : 'Not applicable', 'Not recorded', patient?.gender === 'Female'),
    field('obgyn_history', 'OB/GYN history', 'obgyn', patient?.gender === 'Female' ? 'No complications reported' : 'Not applicable', 'Not recorded', patient?.gender === 'Female'),
    field('allergies', 'Allergies', 'additional', allergies, allergies),
    field('chronicConditions', 'Chronic conditions', 'additional', chronic === 'None' ? 'None reported' : chronic, chronic, chronic === 'None'),
    field('malaria_screen', 'Malaria risk screen', 'medical', 'Fever in household this week: No', 'Not recorded', true),
    field('tb_screen', 'TB screen', 'medical', 'Cough over two weeks: No', 'Not recorded', true),
    field('immunization', 'Immunization reminder', 'medical', 'SMS reminders allowed', 'Not recorded', true),
    field('gad7_score', 'GAD-7 score', 'gad7', index % 2 === 0 ? '4 - minimal anxiety' : '7 - mild anxiety', 'Not recorded', true),
    field('phq9_score', 'PHQ-9 score', 'phq9', index % 2 === 0 ? '3 - minimal depression' : '6 - mild depression', 'Not recorded', true),
    field('pcl5_score', 'PCL-5 score', 'pcl5', '11 - below provisional threshold', 'Not recorded', true),
  ];
}

function field(
  id: string,
  label: string,
  section: IntakeSectionKey,
  intakeValue: string,
  chartValue: string,
  conflict = false,
): IntakeField {
  return {
    id,
    label,
    section,
    intakeValue,
    chartValue,
    selected: conflict,
    conflict,
  };
}

function normalizePhone(phone: string, offset: number): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const suffix = String((Number(digits.slice(-3)) + offset + 7) % 1000).padStart(3, '0');
  return `${phone.slice(0, Math.max(0, phone.length - 3))}${suffix}`;
}

function patientMeta(patient: PatientDoc | undefined): string {
  if (!patient) return 'No chart selected';
  const age = patientAge(patient);
  const bits = [
    patient.hospitalNumber,
    patient.gender,
    age ? `${age} yrs` : undefined,
    patient.county,
  ].filter(Boolean);
  return bits.join(' · ');
}

function seedRequests(patients: PatientDoc[]): IntakeRequest[] {
  const picks = [patients[0], patients[1], patients[2]].filter(Boolean);
  const now = Date.now();
  return picks.map((patient, index) => {
    const baseFields = buildFields(patient, index);
    const status: IntakeStatus = index === 0 ? 'pending_review' : index === 1 ? 'not_submitted' : 'merged';
    return {
      id: `seed-${patient._id}-${index}`,
      patientId: patient._id,
      patientName: patientFullName(patient),
      patientMeta: patientMeta(patient),
      provider: PROVIDERS[index % PROVIDERS.length],
      status,
      sentAt: new Date(now - index * 86400000).toISOString(),
      receivedAt: status !== 'not_submitted' ? new Date(now - index * 7200000).toISOString() : undefined,
      mergedAt: status === 'merged' ? new Date(now - 3600000).toISOString() : undefined,
      delivery: ['sms', 'email'],
      forms: FORM_OPTIONS.map(option => option.key),
      fields: baseFields,
    };
  });
}

function statusLabel(status: IntakeStatus): string {
  if (status === 'pending_review') return 'Pending Review';
  if (status === 'not_submitted') return 'Not Submitted by Patient';
  return 'Merged';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function workflowLabel(request: IntakeRequest): string {
  if (request.status === 'pending_review') return 'Ready for review';
  if (request.status === 'merged') return 'Merged to chart';
  return 'Awaiting patient';
}

function workflowDetail(request: IntakeRequest): string {
  const forms = request.forms.length;
  const delivery = request.delivery.map(channel => channel.toUpperCase()).join(' + ');
  if (request.status === 'pending_review' && request.receivedAt) {
    return `Received ${formatDate(request.receivedAt)} · ${forms} form${forms === 1 ? '' : 's'}`;
  }
  if (request.status === 'merged' && request.mergedAt) {
    return `Merged ${formatDate(request.mergedAt)} · ${delivery}`;
  }
  return `Sent ${formatDate(request.sentAt)} · ${delivery}`;
}

export default function PatientIntakePage() {
  const { patients, loading, update } = usePatients();
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [activeStatus, setActiveStatus] = useState<IntakeStatus>('pending_review');
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (patients.length === 0) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setRequests(JSON.parse(saved) as IntakeRequest[]);
        return;
      }
    } catch {
      // Ignore invalid local storage and regenerate the demo queue.
    }
    setRequests(seedRequests(patients));
  }, [patients]);

  useEffect(() => {
    if (requests.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  const activeRequest = requests.find(request => request.id === selectedId) || null;
  const providerOptions = useMemo(() => {
    return Array.from(new Set(requests.map(request => request.provider))).sort((a, b) => a.localeCompare(b));
  }, [requests]);
  const visibleRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter(request => {
      const matchesStatus = request.status === activeStatus;
      const matchesProvider = providerFilter === 'all' || request.provider === providerFilter;
      const matchesQuery = !needle || `${request.patientName} ${request.patientMeta} ${request.provider}`.toLowerCase().includes(needle);
      return matchesStatus && matchesProvider && matchesQuery;
    });
  }, [activeStatus, providerFilter, query, requests]);

  const counts = useMemo(() => ({
    pending_review: requests.filter(request => request.status === 'pending_review').length,
    not_submitted: requests.filter(request => request.status === 'not_submitted').length,
    merged: requests.filter(request => request.status === 'merged').length,
  }), [requests]);

  const toggleField = (requestId: string, fieldId: string) => {
    setRequests(current => current.map(request => (
      request.id !== requestId ? request : {
        ...request,
        fields: request.fields.map(item => (
          item.id === fieldId ? { ...item, selected: !item.selected } : item
        )),
      }
    )));
  };

  const markReceived = (requestId: string) => {
    setRequests(current => current.map(request => (
      request.id === requestId
        ? { ...request, status: 'pending_review', receivedAt: new Date().toISOString() }
        : request
    )));
    setActiveStatus('pending_review');
    showToast('Patient forms received and ready for review.');
  };

  const mergeRequest = async (request: IntakeRequest) => {
    const selected = Object.fromEntries(
      request.fields.filter(item => item.selected).map(item => [item.id, item.intakeValue]),
    );

    const patientPatch: Partial<PatientDoc> = {};
    if (typeof selected.phone === 'string') patientPatch.phone = selected.phone;
    if (typeof selected.state === 'string') patientPatch.state = selected.state;
    if (typeof selected.county === 'string') patientPatch.county = selected.county;
    if (typeof selected.nokName === 'string') patientPatch.nokName = selected.nokName;
    if (typeof selected.nokRelationship === 'string') patientPatch.nokRelationship = selected.nokRelationship;
    if (typeof selected.nokPhone === 'string') patientPatch.nokPhone = selected.nokPhone;
    if (typeof selected.allergies === 'string') {
      patientPatch.allergies = selected.allergies === 'None reported' ? ['None known'] : selected.allergies.split(',').map(v => v.trim()).filter(Boolean);
    }
    if (typeof selected.chronicConditions === 'string') {
      patientPatch.chronicConditions = selected.chronicConditions === 'None reported' ? ['None'] : selected.chronicConditions.split(',').map(v => v.trim()).filter(Boolean);
    }

    if (Object.keys(patientPatch).length > 0) {
      await update(request.patientId, patientPatch);
    }

    setRequests(current => current.map(item => (
      item.id === request.id
        ? { ...item, status: 'merged', mergedAt: new Date().toISOString() }
        : item
    )));
    setSelectedId(null);
    setActiveStatus('merged');
    showToast('Intake merged into the patient chart.');
  };

  const sendForms = (input: {
    patientId: string;
    provider: string;
    forms: IntakeSectionKey[];
    delivery: Array<'sms' | 'email'>;
  }) => {
    const patient = patients.find(item => item._id === input.patientId);
    if (!patient) return;
    const now = new Date().toISOString();
    const request: IntakeRequest = {
      id: `intake-${Date.now()}`,
      patientId: patient._id,
      patientName: patientFullName(patient),
      patientMeta: patientMeta(patient),
      provider: input.provider,
      status: 'not_submitted',
      sentAt: now,
      delivery: input.delivery,
      forms: input.forms,
      fields: buildFields(patient, requests.length).filter(item => input.forms.includes(item.section)),
    };
    setRequests(current => [request, ...current]);
    setActiveStatus('not_submitted');
    setSendOpen(false);
    showToast('Forms queued for patient delivery.');
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="ti-page">
      <TopBar title="Patient intake" hideSearch />

      {activeRequest ? (
        <ReviewPanel
          request={activeRequest}
          onClose={() => setSelectedId(null)}
          onToggleField={(fieldId) => toggleField(activeRequest.id, fieldId)}
          onMerge={() => mergeRequest(activeRequest)}
        />
      ) : (
      <section className="ti-shell">
        <div className="ti-page-head">
          <div className="ti-title-row">
            <h1>Patient Intake</h1>
            <button type="button" className="ti-settings-link">Settings</button>
          </div>
          <div className="ti-page-head-actions">
            <span>How can we improve this feature? <button type="button">Let us know</button></span>
            <button type="button" className="ti-primary" onClick={() => setSendOpen(true)}>
              SEND FORMS
            </button>
          </div>
        </div>

        <div className="ti-board">
          <aside className="ti-queue-nav" aria-label="Intake queue status">
            {(['pending_review', 'not_submitted', 'merged'] as IntakeStatus[]).map(status => (
              <button
                type="button"
                key={status}
                className={activeStatus === status ? 'is-active' : ''}
                onClick={() => setActiveStatus(status)}
              >
                <span>{statusLabel(status)}</span>
                {counts[status] > 0 && <strong>{counts[status]}</strong>}
              </button>
            ))}
          </aside>

          <main className="ti-workspace">
            <div className="ti-toolbar">
              <label className="ti-filter">
                <select value={providerFilter} onChange={event => setProviderFilter(event.target.value)}>
                  <option value="all">All providers</option>
                  {providerOptions.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </label>
              <label className="ti-search">
                <Search className="w-4 h-4" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search patient, ID, or provider" />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear intake search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
            </div>

            <div className="ti-table" role="table" aria-label={`${statusLabel(activeStatus)} intake forms`}>
              <div className="ti-row ti-head" role="row">
                <span>{activeStatus === 'merged' ? 'Merged' : activeStatus === 'not_submitted' ? 'Sent' : 'Received'}</span>
                <span>Patient</span>
                <span>Workflow</span>
                <span>Action</span>
              </div>

              {loading && <div className="ti-empty">Loading intake queue...</div>}

              {!loading && visibleRequests.length === 0 && (
                <div className="ti-empty">
                  <FileText className="w-8 h-8" />
                  <strong>No forms in this queue</strong>
                  <span>Use Send forms to invite a patient to complete intake before the visit.</span>
                </div>
              )}

              {visibleRequests.map(request => (
                <div className="ti-row" role="row" key={request.id}>
                  <span>{formatDate(request.mergedAt || request.receivedAt || request.sentAt)}</span>
                  <span>
                    <strong>{request.patientName}</strong>
                    <small>{request.patientMeta} · {request.provider}</small>
                  </span>
                  <span>
                    <strong>{workflowLabel(request)}</strong>
                    <small>{workflowDetail(request)}</small>
                  </span>
                  <span className="ti-actions">
                    {request.status === 'not_submitted' ? (
                      <button type="button" className="ti-secondary" onClick={() => markReceived(request.id)}>Mark received</button>
                    ) : request.status === 'merged' ? (
                      <button type="button" className="ti-secondary" onClick={() => setSelectedId(request.id)}>View</button>
                    ) : (
                      <button type="button" className="ti-secondary" onClick={() => setSelectedId(request.id)}>Review</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </main>
        </div>
      </section>
      )}

      {sendOpen && (
        <SendFormsDialog
          patients={patients}
          onClose={() => setSendOpen(false)}
          onSubmit={sendForms}
        />
      )}

      {toast && (
        <div className="ti-toast" role="status">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  request,
  onClose,
  onToggleField,
  onMerge,
}: {
  request: IntakeRequest;
  onClose: () => void;
  onToggleField: (fieldId: string) => void;
  onMerge: () => void;
}) {
  const sections = request.forms.filter(section => request.fields.some(fieldItem => fieldItem.section === section));
  const selectedCount = request.fields.filter(fieldItem => fieldItem.selected).length;
  const isMerged = request.status === 'merged';

  return (
    <section className="ti-review-page" aria-label="Review intake form">
      <nav className="ti-section-list" aria-label="Intake sections">
        {sections.map(section => (
          <a key={section} href={`#section-${section}`}>
            {SECTION_LABELS[section]}
          </a>
        ))}
      </nav>

      <div className="ti-review-panel">
        <header>
          <div>
            <h2>{request.patientName}</h2>
            <span>{request.patientMeta} · {request.provider}</span>
          </div>
          <button type="button" className="ti-icon-btn" onClick={onClose} aria-label="Close review">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="ti-compare">
          {sections.map(section => (
            <section id={`section-${section}`} key={section} className="ti-compare-section">
              <h3>{SECTION_LABELS[section]}</h3>
              <div className="ti-compare-head">
                <span>Information from intake forms</span>
                <span>Information from patient&apos;s chart</span>
              </div>
              {request.fields.filter(fieldItem => fieldItem.section === section).map(fieldItem => (
                <label key={fieldItem.id} className={`ti-compare-row ${fieldItem.conflict ? 'has-conflict' : ''}`}>
                  <span>
                    <input
                      type="checkbox"
                      checked={fieldItem.selected}
                      onChange={() => onToggleField(fieldItem.id)}
                      disabled={isMerged}
                    />
                    <span>
                      <strong>{fieldItem.label}</strong>
                      <em>{fieldItem.intakeValue}</em>
                    </span>
                  </span>
                  <span>{fieldItem.chartValue}</span>
                </label>
              ))}
            </section>
          ))}
        </div>

        <footer>
          <span>{isMerged ? `Merged ${formatDate(request.mergedAt)}` : `${selectedCount} fields selected for chart merge`}</span>
          <div>
            <button type="button" className="ti-secondary" onClick={onClose}>Cancel</button>
            {!isMerged && (
              <button type="button" className="ti-primary" onClick={onMerge}>
                <Check className="w-4 h-4" />
                Merge Into Chart
              </button>
            )}
            {!isMerged && <button type="button" className="ti-danger" onClick={onClose}>Reject All</button>}
          </div>
        </footer>
      </div>
    </section>
  );
}

function SendFormsDialog({
  patients,
  onClose,
  onSubmit,
}: {
  patients: PatientDoc[];
  onClose: () => void;
  onSubmit: (input: {
    patientId: string;
    provider: string;
    forms: IntakeSectionKey[];
    delivery: Array<'sms' | 'email'>;
  }) => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [forms, setForms] = useState<IntakeSectionKey[]>(['basic', 'demographics', 'emergency', 'payment', 'additional', 'gad7', 'phq9', 'pcl5']);
  const [delivery, setDelivery] = useState<Array<'sms' | 'email'>>(['sms', 'email']);
  const selectedPatient = useMemo(() => patients.find(patient => patient._id === patientId) || null, [patients, patientId]);

  const toggleForm = (key: IntakeSectionKey) => {
    setForms(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  };

  const toggleDelivery = (key: 'sms' | 'email') => {
    setDelivery(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  };

  const canSend = patientId && forms.length > 0 && delivery.length > 0;

  return (
    <div className="ti-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Send forms to patient">
      <form
        className="ti-dialog"
        onSubmit={event => {
          event.preventDefault();
          if (canSend) onSubmit({ patientId, provider, forms, delivery });
        }}
      >
        <header>
          <div>
            <h2>Send Forms to Patient</h2>
          </div>
          <button type="button" className="ti-icon-btn" onClick={onClose} aria-label="Close send forms">
            <X className="w-5 h-5" />
          </button>
        </header>

        <label className="ti-field">
          <span>Provider</span>
          <select value={provider} onChange={event => setProvider(event.target.value)}>
            {PROVIDERS.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label className="ti-field">
          <span>Patient</span>
          <select value={patientId} onChange={event => setPatientId(event.target.value)}>
            <option value="">Select patient</option>
            {patients.map(patient => (
              <option key={patient._id} value={patient._id}>
                {patientFullName(patient)} · {patient.hospitalNumber || 'No facility number'}
              </option>
            ))}
          </select>
        </label>
        {patientId && (
          <div className="ti-selected-patient">
            {selectedPatient ? (
              <>
                <strong>{patientFullName(selectedPatient)}</strong>
                <span>{patientMeta(selectedPatient)}</span>
              </>
            ) : null}
            <button type="button" aria-label="Clear selected patient" onClick={() => { setPatientId(''); }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="ti-form-picker">
          <span>Patient intake</span>
          <div className="ti-form-option-list">
            {FORM_OPTIONS.map(option => (
              <div
                key={option.key}
                className={`ti-form-option ${forms.includes(option.key) ? 'is-selected' : ''}`}
              >
                <input
                  id={`form-${option.key}`}
                  type="checkbox"
                  checked={forms.includes(option.key)}
                  onChange={() => toggleForm(option.key)}
                />
                <label htmlFor={`form-${option.key}`}>
                  <strong>{option.label}</strong>
                  <small>{option.desc}</small>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="ti-delivery">
          <button type="button" className={delivery.includes('sms') ? 'is-selected' : ''} onClick={() => toggleDelivery('sms')}>
            SMS to patient
          </button>
          <button type="button" className={delivery.includes('email') ? 'is-selected' : ''} onClick={() => toggleDelivery('email')}>
            Email to patient
          </button>
        </div>

        {!canSend && (
          <div className="ti-warning">
            <AlertCircle className="w-4 h-4" />
            Select a patient, at least one form, and one delivery method.
          </div>
        )}

        <footer>
          <button type="button" className="ti-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="ti-primary" disabled={!canSend}>SEND</button>
        </footer>
      </form>
    </div>
  );
}
