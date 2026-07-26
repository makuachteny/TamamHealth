'use client';

/**
 * Super-admin → Security & Compliance.
 * Edits config.superAdminPolicies (same merge pattern as the retired
 * Control Center: defaults ⊕ persisted overrides, one field write at a
 * time) and derives an honest posture checklist from the live values —
 * nothing here is simulated.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import type { PlatformConfigDoc } from '@/lib/db-types';
import { ToggleLeft, ToggleRight } from '@/components/icons/lucide';
import { SaPage, SaCard, SaStatusDot } from '@/components/admin/sa-ui';

type Policy = NonNullable<PlatformConfigDoc['superAdminPolicies']>;

// Mirrors SuperAdminControlCenter's DEFAULT_POLICIES (not exported there) so
// unspecified keys resolve to the same defaults across both surfaces.
const DEFAULT_POLICIES: Policy = {
  mfaRequired: true,
  passwordMinLength: 12,
  sessionTimeoutMinutes: 15,
  emergencyAccessEnabled: true,
  emergencyAccessReviewHours: 24,
  impersonationEnabled: false,
  impersonationMaxMinutes: 30,
  dualApprovalForHighRisk: true,
  auditRetentionYears: 6,
  phiExportRequiresReason: true,
  dataDeletionRequiresApproval: true,
  ssoEnabled: false,
  apiKeysEnabled: false,
  backupRpoHours: 24,
  backupRtoHours: 8,
  supportAccessRequiresTicket: true,
};

function ToggleRow({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sa-policy-row">
      <span className="sa-policy-text">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={label}
        style={{ background: 'none', border: 0, padding: 0, lineHeight: 0, cursor: 'pointer' }}
      >
        {enabled
          ? <ToggleRight className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
          : <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />}
      </button>
    </div>
  );
}

function NumberRow({ label, description, value, onChange, min, max }: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="sa-policy-row">
      <span className="sa-policy-text">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value) || value)}
        style={{ width: 76 }}
      />
    </div>
  );
}

function KvRow({ label, tone, value }: { label: string; tone: 'ok' | 'warn'; value: string }) {
  return (
    <div className="sa-kv-row">
      <span>{label}</span>
      <SaStatusDot tone={tone} label={value} />
    </div>
  );
}

export default function SecurityCompliancePage() {
  const { currentUser } = useApp();
  const { config, update } = usePlatformConfig();
  const [backupAgeHours, setBackupAgeHours] = useState<number | null>(null);

  useEffect(() => {
    const last = typeof window !== 'undefined' ? localStorage.getItem('safeguard_last_backup') : null;
    if (!last) return;
    const ms = Date.now() - new Date(last).getTime();
    if (Number.isFinite(ms)) setBackupAgeHours(ms / 3600000);
  }, []);

  const policies: Policy = { ...DEFAULT_POLICIES, ...(config?.superAdminPolicies || {}) };

  const setPolicy = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    if (!currentUser) return;
    update({ superAdminPolicies: { ...policies, [key]: value } }, currentUser._id, currentUser.username);
  };

  const backupWithinRpo = backupAgeHours !== null && backupAgeHours <= policies.backupRpoHours;

  return (
    <SaPage title="Security & Compliance" subtitle="Platform-wide access, PHI, break-glass, and continuity policy.">
      <div className="sa-split">
        <SaCard title="Access & authentication">
          <ToggleRow
            label="Require MFA"
            description="Multi-factor authentication for privileged access."
            enabled={policies.mfaRequired}
            onToggle={() => setPolicy('mfaRequired', !policies.mfaRequired)}
          />
          <NumberRow
            label="Password minimum"
            description="Minimum password length, characters."
            value={policies.passwordMinLength}
            onChange={v => setPolicy('passwordMinLength', v)}
            min={8}
            max={64}
          />
          <NumberRow
            label="Session timeout"
            description="Idle session timeout, minutes."
            value={policies.sessionTimeoutMinutes}
            onChange={v => setPolicy('sessionTimeoutMinutes', v)}
            min={1}
            max={240}
          />
          <ToggleRow
            label="SSO controls"
            description="Expose SAML/OIDC controls per organization."
            enabled={policies.ssoEnabled}
            onToggle={() => setPolicy('ssoEnabled', !policies.ssoEnabled)}
          />
        </SaCard>

        <SaCard title="PHI & data controls">
          <ToggleRow
            label="Reason required for PHI export"
            description="Exports must include purpose and requester."
            enabled={policies.phiExportRequiresReason}
            onToggle={() => setPolicy('phiExportRequiresReason', !policies.phiExportRequiresReason)}
          />
          <ToggleRow
            label="Approval before deletion"
            description="Hard deletion and tenant data removal need approval."
            enabled={policies.dataDeletionRequiresApproval}
            onToggle={() => setPolicy('dataDeletionRequiresApproval', !policies.dataDeletionRequiresApproval)}
          />
          <NumberRow
            label="Audit retention"
            description="Audit documentation retention window, years."
            value={policies.auditRetentionYears}
            onChange={v => setPolicy('auditRetentionYears', v)}
            min={1}
            max={25}
          />
          <ToggleRow
            label="API keys"
            description="Enable tenant API key issuance and rotation."
            enabled={policies.apiKeysEnabled}
            onToggle={() => setPolicy('apiKeysEnabled', !policies.apiKeysEnabled)}
          />
        </SaCard>

        <SaCard title="Break-glass & support access">
          <ToggleRow
            label="Emergency access"
            description="Allow break-glass access with follow-up review."
            enabled={policies.emergencyAccessEnabled}
            onToggle={() => setPolicy('emergencyAccessEnabled', !policies.emergencyAccessEnabled)}
          />
          <NumberRow
            label="Emergency review window"
            description="Hours to review break-glass access after use."
            value={policies.emergencyAccessReviewHours}
            onChange={v => setPolicy('emergencyAccessReviewHours', v)}
            min={1}
            max={168}
          />
          <ToggleRow
            label="Support impersonation"
            description="Allow isolated tenant support sessions with audit trail."
            enabled={policies.impersonationEnabled}
            onToggle={() => setPolicy('impersonationEnabled', !policies.impersonationEnabled)}
          />
          <NumberRow
            label="Impersonation max duration"
            description="Maximum impersonation session length, minutes."
            value={policies.impersonationMaxMinutes}
            onChange={v => setPolicy('impersonationMaxMinutes', v)}
            min={5}
            max={240}
          />
          <ToggleRow
            label="Require support ticket"
            description="Support access must carry a ticket or incident reference."
            enabled={policies.supportAccessRequiresTicket}
            onToggle={() => setPolicy('supportAccessRequiresTicket', !policies.supportAccessRequiresTicket)}
          />
          <ToggleRow
            label="Dual approval"
            description="Require a second approver for destructive or privileged actions."
            enabled={policies.dualApprovalForHighRisk}
            onToggle={() => setPolicy('dualApprovalForHighRisk', !policies.dualApprovalForHighRisk)}
          />
        </SaCard>

        <SaCard title="Continuity objectives">
          <NumberRow
            label="Recovery point objective"
            description="Maximum acceptable data loss window, hours."
            value={policies.backupRpoHours}
            onChange={v => setPolicy('backupRpoHours', v)}
            min={1}
            max={168}
          />
          <NumberRow
            label="Recovery time objective"
            description="Maximum acceptable restore time, hours."
            value={policies.backupRtoHours}
            onChange={v => setPolicy('backupRtoHours', v)}
            min={1}
            max={72}
          />
          <div className="sa-kv">
            <KvRow
              label="Current backup age"
              tone={backupWithinRpo ? 'ok' : 'warn'}
              value={backupAgeHours === null ? 'No backup on record' : `${Math.round(backupAgeHours)}h ago`}
            />
          </div>
        </SaCard>
      </div>

      <div className="sa-split">
        <SaCard title="Security posture">
          <div className="sa-kv">
            <KvRow label="MFA required" tone={policies.mfaRequired ? 'ok' : 'warn'} value={policies.mfaRequired ? 'On' : 'Off'} />
            <KvRow label="Audit retention ≥ 6 years" tone={policies.auditRetentionYears >= 6 ? 'ok' : 'warn'} value={`${policies.auditRetentionYears}y`} />
            <KvRow label="PHI export control" tone={policies.phiExportRequiresReason ? 'ok' : 'warn'} value={policies.phiExportRequiresReason ? 'On' : 'Off'} />
            <KvRow label="Deletion approval" tone={policies.dataDeletionRequiresApproval ? 'ok' : 'warn'} value={policies.dataDeletionRequiresApproval ? 'On' : 'Off'} />
            <KvRow label="Backup within RPO" tone={backupWithinRpo ? 'ok' : 'warn'} value={backupWithinRpo ? 'Within RPO' : 'At risk'} />
            <KvRow label="Break-glass review window set" tone={policies.emergencyAccessReviewHours > 0 ? 'ok' : 'warn'} value={policies.emergencyAccessReviewHours > 0 ? `${policies.emergencyAccessReviewHours}h` : 'Not set'} />
          </div>
        </SaCard>

        <SaCard title="Compliance evidence">
          <p style={{ margin: '10px 0 12px', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>
            Full audit trail export with user, org, action, and risk classification lives in Audit Logs.
          </p>
          <Link href="/admin/audit" className="sa-btn" style={{ marginBottom: 14, alignSelf: 'flex-start' }}>
            Open Audit Logs
          </Link>
        </SaCard>
      </div>
    </SaPage>
  );
}
