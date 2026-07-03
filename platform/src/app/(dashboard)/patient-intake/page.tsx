'use client';

import { useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import Modal from '@/components/Modal';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useIntakeForms } from '@/lib/hooks/useIntakeForms';
import { usePatients } from '@/lib/hooks/usePatients';
import { useUsers } from '@/lib/hooks/useUsers';
import { isRouteAllowed } from '@/lib/permissions';
import { patientFullName, patientGenderAge } from '@/lib/patient-utils';
import { formatPhoneDisplay } from '@/lib/field-formats';
import type {
  IntakeFormStatus,
  PatientDoc,
  PatientIntakeFormDoc,
  UserRole,
} from '@/lib/db-types';
import { ClipboardPen, Mail, MessageSquare, Plus, Search, Settings, X } from '@/components/icons/lucide';

const TABS: { key: IntakeFormStatus; label: string }[] = [
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'not_submitted', label: 'Not Submitted by Patient' },
  { key: 'merged', label: 'Merged' },
];

// Roles that can be the ordering/receiving provider for an intake request.
// The list is additionally gated by route access below: a provider is only
// assignable if their role can actually open /patient-intake to see the
// queue (otherwise requests would route to someone who can never act).
const PROVIDER_ROLES: UserRole[] = [
  'doctor',
  'clinical_officer',
  'medical_superintendent',
  'nutritionist',
  'radiologist',
];

// The intake packets a patient can be asked to complete before their visit.
const INTAKE_FORM_OPTIONS = [
  'Basic Information',
  'Demographics',
  'Emergency Contact',
  'Financial Information',
  'Additional Information',
  'GAD-7',
  'PHQ-9',
  'PCL-5',
];

// Labels the reviewer can confidently merge straight into the chart, mapped to
// the patient-chart key they write to. Multiple form labels can point at the
// same key (forms evolve / are authored by different people). Anything NOT in
// this map is shown for context during review but has no checkbox — it isn't
// structured enough to write back automatically.
const MERGEABLE_FIELDS: Record<string, keyof PatientDoc> = {
  'Date of birth': 'dateOfBirth',
  'Phone': 'phone',
  'Primary Phone': 'phone',
  'Phone Number': 'phone',
  'Address': 'address',
  'Language': 'primaryLanguage',
  'Primary Language': 'primaryLanguage',
  'County': 'county',
  'State': 'state',
  'Ethnicity': 'tribe',
  'Tribe': 'tribe',
  'Blood Type': 'bloodType',
  'Blood Group': 'bloodType',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Read the current chart value for a mergeable field, as a display string. */
function currentChartValue(patient: PatientDoc | undefined, label: string): string {
  if (!patient) return '';
  const key = MERGEABLE_FIELDS[label];
  if (!key) return '';
  const raw = patient[key];
  if (raw == null || raw === '') return '';
  if (key === 'dateOfBirth') return formatDate(String(raw));
  if (key === 'phone') return formatPhoneDisplay(String(raw));
  return String(raw);
}

// Shared inline styles so the two modals match the existing filter controls.
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 13,
  width: '100%',
};

export default function PatientIntakePage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { forms, loading, merge, reject, sendRequest } = useIntakeForms();
  const { patients } = usePatients();
  const { users } = useUsers();

  const [activeTab, setActiveTab] = useState<IntakeFormStatus>('pending_review');
  const [patientQuery, setPatientQuery] = useState('');
  const [reviewing, setReviewing] = useState<PatientIntakeFormDoc | null>(null);
  const [merging, setMerging] = useState(false);
  // Which mergeable field labels the reviewer has selected to write to the chart.
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});

  // --- Send-forms modal state ---
  const [sendOpen, setSendOpen] = useState(false);
  const [sendProviderId, setSendProviderId] = useState('');
  const [sendPatient, setSendPatient] = useState<PatientDoc | null>(null);
  const [sendPatientQuery, setSendPatientQuery] = useState('');
  const [sendForms, setSendForms] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [sending, setSending] = useState(false);

  const providerUsers = useMemo(
    () => users
      .filter(u => PROVIDER_ROLES.includes(u.role) && isRouteAllowed(u.role, '/patient-intake'))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const counts = useMemo(() => {
    const c: Record<IntakeFormStatus, number> = { pending_review: 0, not_submitted: 0, merged: 0, rejected: 0 };
    for (const f of forms) c[f.status]++;
    return c;
  }, [forms]);

  const filtered = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    return forms
      .filter(f => f.status === activeTab)
      .filter(f => !q || f.patientName.toLowerCase().includes(q));
  }, [forms, activeTab, patientQuery]);

  // Patient typeahead for the send modal: match name / hospital number / phone.
  const patientMatches = useMemo(() => {
    const q = sendPatientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(p =>
        patientFullName(p).toLowerCase().includes(q) ||
        (p.hospitalNumber || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [patients, sendPatientQuery]);

  const sendProviderUser = useMemo(
    () => providerUsers.find(u => u._id === sendProviderId),
    [providerUsers, sendProviderId],
  );

  function openReview(form: PatientIntakeFormDoc) {
    // Default every mergeable field to checked.
    const defaults: Record<string, boolean> = {};
    for (const field of form.fields) {
      if (MERGEABLE_FIELDS[field.label]) defaults[field.label] = true;
    }
    setCheckedFields(defaults);
    setReviewing(form);
  }

  function selectSendPatient(p: PatientDoc) {
    setSendPatient(p);
    setSendPatientQuery(patientFullName(p));
    setSendEmail(false); // patients have no email field yet — stays disabled
    setSendSms(!!p.phone);
  }

  function resetSend() {
    setSendProviderId('');
    setSendPatient(null);
    setSendPatientQuery('');
    setSendForms([]);
    setSendEmail(false);
    setSendSms(false);
  }

  async function handleSend() {
    if (!sendPatient || !sendProviderId || sendForms.length === 0) return;
    setSending(true);
    try {
      await sendRequest(
        sendPatient._id,
        patientFullName(sendPatient),
        sendForms.map(f => ({ label: f, value: 'Requested' })),
        {
          providerId: sendProviderUser?._id,
          providerName: sendProviderUser?.name,
          hospitalNumber: sendPatient.hospitalNumber,
          hospitalId: currentUser?.hospitalId,
          orgId: currentUser?.orgId,
        },
      );
      showToast(`Intake forms sent to ${patientFullName(sendPatient)}.`, 'success');
      resetSend();
      setSendOpen(false);
    } catch {
      showToast('Could not send intake forms. Try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleMerge() {
    if (!reviewing) return;
    setMerging(true);
    try {
      const updates: Record<string, unknown> = {};
      for (const field of reviewing.fields) {
        const key = MERGEABLE_FIELDS[field.label];
        if (key && checkedFields[field.label]) updates[key] = field.value;
      }
      await merge(reviewing._id, updates, currentUser?.name || currentUser?.username || 'Staff');
      showToast(`${reviewing.patientName}'s form merged into their chart.`, 'success');
      setReviewing(null);
    } catch {
      showToast('Could not merge this form. Try again.', 'error');
    } finally {
      setMerging(false);
    }
  }

  async function handleReject() {
    if (!reviewing) return;
    setMerging(true);
    try {
      await reject(reviewing._id, currentUser?.name || currentUser?.username || 'Staff');
      showToast('Form rejected', 'success');
      setReviewing(null);
    } catch {
      showToast('Could not reject this form. Try again.', 'error');
    } finally {
      setMerging(false);
    }
  }

  const reviewPatient = useMemo(
    () => (reviewing ? patients.find(p => p._id === reviewing.patientId) : undefined),
    [patients, reviewing],
  );

  const canSend = !!sendPatient && !!sendProviderId && sendForms.length > 0;
  const availableFormOptions = INTAKE_FORM_OPTIONS.filter(o => !sendForms.includes(o));

  return (
    <>
      <TopBar
        title="Patient Intake"
        hideSearch
        titleIcon={<Settings className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        titleActions={
          <>
            <a
              href="mailto:support.tamam@gmail.com?subject=Patient%20Intake%20feedback"
              className="text-[12px] font-medium hidden sm:inline"
              style={{ color: 'var(--accent-primary)' }}
            >
              How can we improve this feature? <span className="underline">Let us know</span>
            </a>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'var(--color-warning-600)', borderColor: 'var(--color-warning-600)', color: '#fff' }}
              onClick={() => setSendOpen(true)}
            >
              Send forms
            </button>
          </>
        }
      />

      <main className="page-container page-enter">
        <div className="flex gap-5 items-start">
          {/* Status tabs */}
          <aside className="card-elevated p-2 flex-shrink-0" style={{ width: 220 }}>
            {TABS.map(tab => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center justify-between gap-2 text-left text-[13px] font-medium rounded-lg px-3 py-2.5 mb-1"
                  style={active
                    ? { background: 'var(--overlay-subtle)', color: 'var(--accent-primary)' }
                    : { color: 'var(--text-secondary)' }}
                >
                  <span>{tab.label}</span>
                  {counts[tab.key] > 0 && (
                    <span
                      className="text-[11px] font-semibold rounded-full min-w-[20px] text-center px-1.5 py-0.5"
                      style={active
                        ? { background: 'var(--color-warning-600)', color: '#fff' }
                        : { background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}
                    >
                      {counts[tab.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Table + filters */}
          <div className="flex-1 min-w-0 card-elevated p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative ml-auto" style={{ minWidth: 220 }}>
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={patientQuery}
                  onChange={e => setPatientQuery(e.target.value)}
                  placeholder="Patient"
                  style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)', borderRadius: 10,
                    padding: '8px 10px 8px 30px', fontSize: 13, width: '100%',
                  }}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No forms in this view.
              </p>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Patient</th>
                    <th>Provider</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(form => (
                    <tr key={form._id}>
                      <td>{formatDate(form.receivedAt || form.requestedAt)}</td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <ClipboardPen className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          {form.patientName}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{form.providerName || '—'}</td>
                      <td className="text-right">
                        {form.status === 'pending_review' ? (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => openReview(form)}>
                            Review
                          </button>
                        ) : form.status === 'merged' ? (
                          <span className="text-[12px]" style={{ color: 'var(--color-success)' }}>Merged {formatDate(form.mergedAt)}</span>
                        ) : (
                          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Awaiting patient</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Send forms to patient                                            */}
      {/* ---------------------------------------------------------------- */}
      {sendOpen && (
        <Modal onClose={() => { resetSend(); setSendOpen(false); }} width={520}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Send forms to patient</h3>
              <button
                onClick={() => { resetSend(); setSendOpen(false); }}
                className="p-1.5 rounded-lg"
                style={{ background: 'var(--overlay-subtle)' }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Provider */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Provider</label>
                <select value={sendProviderId} onChange={e => setSendProviderId(e.target.value)} style={inputStyle}>
                  <option value="">Select a provider</option>
                  {providerUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>

              {/* Patient typeahead */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Patient</label>
                <div className="relative">
                  <input
                    value={sendPatientQuery}
                    onChange={e => { setSendPatientQuery(e.target.value); setSendPatient(null); }}
                    placeholder="Search by name, hospital number, or phone"
                    style={inputStyle}
                  />
                  {!sendPatient && patientMatches.length > 0 && (
                    <div
                      className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10 shadow-lg"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)', maxHeight: 240, overflowY: 'auto' }}
                    >
                      {patientMatches.map(p => (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => selectSendPatient(p)}
                          className="w-full text-left px-3 py-2 text-[13px]"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="font-medium">{(p.surname || '').toUpperCase()}, {p.firstName}</span>
                          <span style={{ color: 'var(--text-muted)' }}> ({formatDate(p.dateOfBirth)} · {patientGenderAge(p)})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Patient intake packets */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>Patient Intake</label>
                {sendForms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {sendForms.map(f => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 text-[12px] font-medium rounded-full px-2.5 py-1"
                        style={{ background: 'var(--overlay-subtle)', color: 'var(--accent-primary)' }}
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() => setSendForms(prev => prev.filter(x => x !== f))}
                          aria-label={`Remove ${f}`}
                          className="inline-flex"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Plus className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  <select
                    value=""
                    onChange={e => { if (e.target.value) setSendForms(prev => [...prev, e.target.value]); }}
                    disabled={availableFormOptions.length === 0}
                    style={{ ...inputStyle, padding: '8px 10px 8px 30px' }}
                  >
                    <option value="">Add a form…</option>
                    {availableFormOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Delivery */}
              <div className="flex flex-col gap-2">
                <label
                  className="inline-flex items-center gap-2 text-[13px]"
                  style={{ color: 'var(--text-muted)', cursor: 'not-allowed' }}
                  title="No email on file for this patient"
                >
                  <input type="checkbox" checked={sendEmail} disabled onChange={e => setSendEmail(e.target.checked)} />
                  <Mail className="w-3.5 h-3.5" />
                  Email to {'no email on file'}
                </label>
                <label
                  className="inline-flex items-center gap-2 text-[13px]"
                  style={{ color: sendPatient?.phone ? 'var(--text-primary)' : 'var(--text-muted)', cursor: sendPatient?.phone ? 'pointer' : 'not-allowed' }}
                >
                  <input
                    type="checkbox"
                    checked={sendSms}
                    disabled={!sendPatient?.phone}
                    onChange={e => setSendSms(e.target.checked)}
                  />
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send SMS to {sendPatient?.phone ? formatPhoneDisplay(sendPatient.phone) : 'no phone on file'}
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => { resetSend(); setSendOpen(false); }} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSend} disabled={!canSend || sending} className="btn btn-primary flex-1">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Review & merge (side-by-side compare)                            */}
      {/* ---------------------------------------------------------------- */}
      {reviewing && (
        <Modal onClose={() => setReviewing(null)} width={720}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{reviewing.patientName}</h3>
              <button onClick={() => setReviewing(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Compare conflicting data, select relevant data, and merge into a single view.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* Left: incoming intake data */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Information from intake forms
                </p>
                <div className="flex flex-col gap-2.5">
                  {reviewing.fields.map(field => {
                    const mergeable = !!MERGEABLE_FIELDS[field.label];
                    return (
                      <div key={field.label} className="flex items-start gap-2">
                        {mergeable ? (
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={!!checkedFields[field.label]}
                            onChange={e => setCheckedFields(prev => ({ ...prev, [field.label]: e.target.checked }))}
                          />
                        ) : (
                          <span className="w-[13px] flex-shrink-0" />
                        )}
                        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                          {field.label}:{' '}
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{field.value}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: current chart data */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Information from patient&apos;s chart
                </p>
                <div className="flex flex-col gap-2.5">
                  {reviewing.fields.map(field => {
                    const current = currentChartValue(reviewPatient, field.label);
                    return (
                      <p key={field.label} className="text-[13px]" style={{ color: 'var(--text-primary)', minHeight: 18 }}>
                        {MERGEABLE_FIELDS[field.label]
                          ? <>{field.label}: {current || <span style={{ color: 'var(--text-muted)' }}>—</span>}</>
                          : <span style={{ color: 'var(--text-muted)' }}>&nbsp;</span>}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setReviewing(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleReject} disabled={merging} className="btn btn-secondary" style={{ color: 'var(--color-danger)' }}>
                Reject All
              </button>
              <button onClick={handleMerge} disabled={merging} className="btn btn-primary flex-1">
                {merging ? 'Merging…' : 'Merge Into Chart'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
