'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import {
  Settings, Building2, Stethoscope, FlaskConical, Wallet, ShieldCheck,
  Trash2, Plus, Save, X, Clock,
} from '@/components/icons/lucide';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { useSettings, useSettingsContext } from '@/lib/settings/SettingsProvider';
import { saveFacilitySettings } from '@/lib/settings/settings-service';
import {
  type FacilitySettings,
  type LabTestDef,
  type PaymentMethodKey,
  type PayorKey,
  PAYMENT_METHOD_LABELS,
  PAYOR_LABELS,
  ALL_PAYMENT_METHODS,
  ALL_PAYORS,
} from '@/lib/settings/facility-settings';

export default function FacilitySettingsPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { hospitalId, orgId } = useSettingsContext();
  const settings = useSettings();

  // Local editable copy, re-synced whenever the persisted settings change.
  const [draft, setDraft] = useState<FacilitySettings>(settings);
  useEffect(() => { setDraft(settings); }, [settings]);

  const hospitalName = currentUser?.hospital?.name || currentUser?.hospitalName || 'This facility';

  // Per-section saving flags so each card's button has its own pending state.
  const [saving, setSaving] = useState<string | null>(null);

  const saveSection = async (patch: Partial<FacilitySettings>, section: string) => {
    if (!hospitalId) return;
    setSaving(section);
    try {
      await saveFacilitySettings(hospitalId, patch, orgId);
      showToast('Facility settings saved', 'success');
    } catch {
      showToast('Could not save settings', 'error');
    } finally {
      setSaving(null);
    }
  };

  // ── No-facility guard (super-admin / org-admin / government) ───────────────
  if (!hospitalId) {
    return (
      <>
        <TopBar title="Facility Settings" />
        <main className="page-container page-enter">
          <PageHeader
            icon={Settings}
            title="Facility Settings"
            subtitle="Configure a single facility's clinical, operational and billing defaults"
          />
          <div className="dash-card card-elevated" style={{ marginTop: 16, padding: 48, textAlign: 'center' }}>
            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              No facility selected
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Select or open a facility to edit its settings.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Facility Settings" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Settings}
          title="Facility Settings"
          subtitle={hospitalName}
        />

        <div className="grid grid-cols-1 gap-6" style={{ marginTop: 16 }}>
          {/* ── General ──────────────────────────────────────────────── */}
          <SectionCard icon={Settings} title="General">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Currency">
                <input
                  className="fs-input"
                  value={draft.currency}
                  onChange={e => setDraft({ ...draft, currency: e.target.value })}
                  placeholder="e.g. SSP"
                />
              </Field>
              <Field label="Hospital number prefix">
                <input
                  className="fs-input"
                  value={draft.hospitalNumberPrefix}
                  onChange={e => setDraft({ ...draft, hospitalNumberPrefix: e.target.value })}
                  placeholder="e.g. TAB"
                />
              </Field>
              <Field label="Default language">
                <select
                  className="fs-input"
                  value={draft.language}
                  onChange={e => setDraft({ ...draft, language: e.target.value })}
                >
                  {SUPPORTED_LOCALES.map(l => (
                    <option key={l.code} value={l.code}>{l.name} ({l.nativeName})</option>
                  ))}
                </select>
              </Field>
            </div>
            <SaveBar
              saving={saving === 'general'}
              onSave={() => saveSection({
                currency: draft.currency,
                hospitalNumberPrefix: draft.hospitalNumberPrefix,
                language: draft.language,
              }, 'general')}
            />
          </SectionCard>

          {/* ── Clinical ─────────────────────────────────────────────── */}
          <SectionCard icon={Stethoscope} title="Clinical">
            <p className="fs-grouplabel">Result-review SLA</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Critical results — review within (hours)">
                <input
                  type="number" min={0} className="fs-input"
                  value={draft.resultReviewSLA.criticalHours}
                  onChange={e => setDraft({ ...draft, resultReviewSLA: { ...draft.resultReviewSLA, criticalHours: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Routine results — review within (hours)">
                <input
                  type="number" min={0} className="fs-input"
                  value={draft.resultReviewSLA.routineHours}
                  onChange={e => setDraft({ ...draft, resultReviewSLA: { ...draft.resultReviewSLA, routineHours: Number(e.target.value) } })}
                />
              </Field>
            </div>

            <p className="fs-grouplabel" style={{ marginTop: 16 }}>Triage acuity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <label className="flex items-center gap-2.5 text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={draft.acuity.timeAging}
                  onChange={e => setDraft({ ...draft, acuity: { ...draft.acuity, timeAging: e.target.checked } })}
                />
                Age the triage queue over time (waiting patients gain priority)
              </label>
              <Field label="Aging per minute">
                <input
                  type="number" min={0} step={0.01} className="fs-input"
                  value={draft.acuity.agingPerMinute}
                  onChange={e => setDraft({ ...draft, acuity: { ...draft.acuity, agingPerMinute: Number(e.target.value) } })}
                />
              </Field>
            </div>
            <SaveBar
              saving={saving === 'clinical'}
              onSave={() => saveSection({
                resultReviewSLA: draft.resultReviewSLA,
                acuity: draft.acuity,
              }, 'clinical')}
            />
          </SectionCard>

          {/* ── Lab Catalog ──────────────────────────────────────────── */}
          <SectionCard icon={FlaskConical} title="Lab Catalog">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    {['Test name', 'Tier', 'Specimen', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draft.labCatalog.map((test, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="px-3 py-2">
                        <input
                          className="fs-input"
                          value={test.name}
                          onChange={e => updateLabRow(draft, setDraft, i, { name: e.target.value })}
                          placeholder="e.g. Full Blood Count"
                        />
                      </td>
                      <td className="px-3 py-2" style={{ width: 150 }}>
                        <select
                          className="fs-input"
                          value={test.tier}
                          onChange={e => updateLabRow(draft, setDraft, i, { tier: e.target.value as LabTestDef['tier'] })}
                        >
                          <option value="basic">Basic</option>
                          <option value="special">Special</option>
                        </select>
                      </td>
                      <td className="px-3 py-2" style={{ width: 180 }}>
                        <input
                          className="fs-input"
                          value={test.specimen}
                          onChange={e => updateLabRow(draft, setDraft, i, { specimen: e.target.value })}
                          placeholder="e.g. Blood"
                        />
                      </td>
                      <td className="px-3 py-2 text-right" style={{ width: 48 }}>
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, labCatalog: draft.labCatalog.filter((_, idx) => idx !== i) })}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--color-danger)' }}
                          aria-label="Remove test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {draft.labCatalog.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No tests yet. Add the first investigation.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, labCatalog: [...draft.labCatalog, { name: '', tier: 'basic', specimen: '' }] })}
              className="btn btn-secondary inline-flex items-center gap-2 mt-3"
            >
              <Plus className="w-4 h-4" /> Add test
            </button>
            <SaveBar
              saving={saving === 'lab'}
              onSave={() => saveSection({
                labCatalog: draft.labCatalog.filter(t => t.name.trim()),
              }, 'lab')}
            />
          </SectionCard>

          {/* ── Operations ───────────────────────────────────────────── */}
          <SectionCard icon={Building2} title="Operations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TagListEditor
                label="Departments / clinics"
                placeholder="e.g. General Medicine"
                values={draft.departments}
                onChange={departments => setDraft({ ...draft, departments })}
              />
              <TagListEditor
                label="Rooms / bays"
                placeholder="e.g. Room 1"
                values={draft.rooms}
                onChange={rooms => setDraft({ ...draft, rooms })}
              />
            </div>
            <SaveBar
              saving={saving === 'operations'}
              onSave={() => saveSection({
                departments: draft.departments.filter(Boolean),
                rooms: draft.rooms.filter(Boolean),
              }, 'operations')}
            />
          </SectionCard>

          {/* ── Billing ──────────────────────────────────────────────── */}
          <SectionCard icon={Wallet} title="Billing">
            <p className="fs-grouplabel">Accepted payment methods</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PAYMENT_METHODS.map(key => (
                <CheckRow
                  key={key}
                  label={PAYMENT_METHOD_LABELS[key]}
                  checked={draft.paymentMethods.includes(key)}
                  onToggle={() => toggleKey<PaymentMethodKey>(draft.paymentMethods, key, v => setDraft({ ...draft, paymentMethods: v }))}
                />
              ))}
            </div>

            <p className="fs-grouplabel" style={{ marginTop: 16 }}>Payors / funding sources</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALL_PAYORS.map(key => (
                <CheckRow
                  key={key}
                  label={PAYOR_LABELS[key]}
                  checked={draft.payors.includes(key)}
                  onToggle={() => toggleKey<PayorKey>(draft.payors, key, v => setDraft({ ...draft, payors: v }))}
                />
              ))}
            </div>

            <p className="fs-grouplabel" style={{ marginTop: 16 }}>Collection timeline (days into an unpaid balance)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Follow-up reminder">
                <input
                  type="number" min={0} className="fs-input"
                  value={draft.collectionStageDays.followUp}
                  onChange={e => setDraft({ ...draft, collectionStageDays: { ...draft.collectionStageDays, followUp: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Warning notice">
                <input
                  type="number" min={0} className="fs-input"
                  value={draft.collectionStageDays.warning}
                  onChange={e => setDraft({ ...draft, collectionStageDays: { ...draft.collectionStageDays, warning: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Pre-write-off">
                <input
                  type="number" min={0} className="fs-input"
                  value={draft.collectionStageDays.preWriteOff}
                  onChange={e => setDraft({ ...draft, collectionStageDays: { ...draft.collectionStageDays, preWriteOff: Number(e.target.value) } })}
                />
              </Field>
            </div>
            <SaveBar
              saving={saving === 'billing'}
              onSave={() => saveSection({
                paymentMethods: draft.paymentMethods,
                payors: draft.payors,
                collectionStageDays: draft.collectionStageDays,
              }, 'billing')}
            />
          </SectionCard>

          {/* ── Security ─────────────────────────────────────────────── */}
          <SectionCard icon={ShieldCheck} title="Security">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Auto-lock after idle (minutes)">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="number" min={0} className="fs-input"
                    value={draft.lockTimeoutMinutes}
                    onChange={e => setDraft({ ...draft, lockTimeoutMinutes: Number(e.target.value) })}
                  />
                </div>
              </Field>
            </div>
            <SaveBar
              saving={saving === 'security'}
              onSave={() => saveSection({ lockTimeoutMinutes: draft.lockTimeoutMinutes }, 'security')}
            />
          </SectionCard>
        </div>
      </main>

      <style>{`
        .fs-input {
          width: 100%; padding: 9px 12px; border-radius: 8px;
          border: 1px solid var(--border-medium); background: var(--bg-secondary);
          color: var(--text-primary); font-size: 14px;
        }
        .fs-grouplabel {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 10px;
        }
      `}</style>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function updateLabRow(
  draft: FacilitySettings,
  setDraft: (s: FacilitySettings) => void,
  index: number,
  patch: Partial<LabTestDef>,
) {
  setDraft({
    ...draft,
    labCatalog: draft.labCatalog.map((t, i) => (i === index ? { ...t, ...patch } : t)),
  });
}

function toggleKey<K extends string>(list: K[], key: K, set: (v: K[]) => void) {
  set(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
}

// ── Presentational pieces ────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; children: React.ReactNode }) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end mt-4 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
      <button onClick={onSave} disabled={saving} className="btn btn-primary inline-flex items-center gap-2">
        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm py-1.5" style={{ color: 'var(--text-secondary)' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {label}
    </label>
  );
}

function TagListEditor({ label, placeholder, values, onChange }: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [entry, setEntry] = useState('');
  const add = () => {
    const v = entry.trim();
    if (!v || values.includes(v)) { setEntry(''); return; }
    onChange([...values, v]);
    setEntry('');
  };
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="flex items-center gap-2 mb-3">
        <input
          className="fs-input"
          value={entry}
          placeholder={placeholder}
          onChange={e => setEntry(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="btn btn-secondary inline-flex items-center gap-1.5 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              aria-label={`Remove ${v}`}
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>None added yet.</span>
        )}
      </div>
    </div>
  );
}
