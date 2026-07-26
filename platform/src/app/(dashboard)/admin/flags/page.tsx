'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import type { OrganizationDoc } from '@/lib/db-types';
import { SaPage, SaCard, SaStat, SaTable, SaPill } from '@/components/admin/sa-ui';
import { ToggleLeft, ToggleRight } from '@/components/icons/lucide';

type FlagKey = keyof OrganizationDoc['featureFlags'];

const TENANT_FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'epidemicIntelligence', label: 'Epidemic' },
  { key: 'mchAnalytics', label: 'MCH' },
  { key: 'dhis2Export', label: 'DHIS2' },
  { key: 'aiClinicalSupport', label: 'AI Clinical' },
  { key: 'communityHealth', label: 'Community' },
  { key: 'facilityAssessments', label: 'Assessments' },
];

const planTone = (plan: OrganizationDoc['subscriptionPlan']) =>
  plan === 'enterprise' ? 'info' as const : plan === 'professional' ? 'ok' as const : 'muted' as const;

export default function AdminFlagsPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { config, loading: configLoading, update: updateConfig } = usePlatformConfig();
  const { organizations, loading: orgsLoading, update: updateOrg } = useOrganizations();

  const [savingKey, setSavingKey] = useState<string | null>(null);

  const globalFlagsOn = config
    ? (config.globalFeatureFlags.signupsEnabled ? 1 : 0) + (config.maintenanceMode ? 1 : 0)
    : 0;

  const orgsWithAllFlagsOff = useMemo(
    () => organizations.filter(o => TENANT_FLAGS.every(f => !o.featureFlags[f.key])).length,
    [organizations]
  );

  const mostEnabledFlag = useMemo(() => {
    if (organizations.length === 0) return null;
    let best: { label: string; count: number } | null = null;
    for (const f of TENANT_FLAGS) {
      const count = organizations.filter(o => o.featureFlags[f.key]).length;
      if (!best || count > best.count) best = { label: f.label, count };
    }
    return best;
  }, [organizations]);

  const toggleGlobalFlag = async (key: 'signupsEnabled' | 'maintenanceMode', next: boolean) => {
    if (!config) return;
    setSavingKey(key);
    try {
      if (key === 'signupsEnabled') {
        await updateConfig({
          globalFeatureFlags: { ...config.globalFeatureFlags, signupsEnabled: next },
        }, currentUser?._id, currentUser?.username);
      } else {
        await updateConfig({ maintenanceMode: next }, currentUser?._id, currentUser?.username);
      }
      showToast('Platform flag updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update flag.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleTenantFlag = async (org: OrganizationDoc, key: FlagKey, next: boolean) => {
    const cellKey = `${org._id}:${key}`;
    setSavingKey(cellKey);
    try {
      await updateOrg(org._id, { featureFlags: { ...org.featureFlags, [key]: next } }, currentUser?._id, currentUser?.username);
      showToast(`${TENANT_FLAGS.find(f => f.key === key)?.label} ${next ? 'enabled' : 'disabled'} for ${org.name}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update flag.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SaPage title="Feature Flags" subtitle="Platform-wide toggles and per-tenant feature enablement.">

      <div className="sa-stat-strip">
        <SaStat label="Global flags on" value={configLoading ? '…' : globalFlagsOn} />
        <SaStat label="Orgs total" value={orgsLoading ? '…' : organizations.length} />
        <SaStat label="Orgs with all flags off" value={orgsLoading ? '…' : orgsWithAllFlagsOff} tone={orgsWithAllFlagsOff > 0 ? 'warn' : 'ok'} />
        <SaStat label="Most-enabled flag" value={mostEnabledFlag ? mostEnabledFlag.label : '—'} note={mostEnabledFlag ? `${mostEnabledFlag.count} org${mostEnabledFlag.count === 1 ? '' : 's'}` : undefined} />
      </div>

      <SaCard title="Global platform flags">
        {configLoading || !config ? (
          <p className="sa-empty">Loading…</p>
        ) : (
          <>
            <div className="sa-policy-row">
              <span className="sa-policy-text">
                <strong>New signups enabled (platform-wide)</strong>
                <span>Controls whether new organizations can self-register across the entire platform.</span>
              </span>
              <button
                type="button"
                onClick={() => toggleGlobalFlag('signupsEnabled', !config.globalFeatureFlags.signupsEnabled)}
                disabled={savingKey === 'signupsEnabled'}
                aria-pressed={config.globalFeatureFlags.signupsEnabled}
              >
                {config.globalFeatureFlags.signupsEnabled ? (
                  <ToggleRight className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
                ) : (
                  <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
            </div>
            <div className="sa-policy-row">
              <span className="sa-policy-text">
                <strong>Maintenance mode (platform-wide)</strong>
                <span>When on, only super admins can sign in to any organization.</span>
              </span>
              <button
                type="button"
                onClick={() => toggleGlobalFlag('maintenanceMode', !config.maintenanceMode)}
                disabled={savingKey === 'maintenanceMode'}
                aria-pressed={config.maintenanceMode}
              >
                {config.maintenanceMode ? (
                  <ToggleRight className="w-8 h-8" style={{ color: 'var(--color-danger)' }} />
                ) : (
                  <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
            </div>
          </>
        )}
      </SaCard>

      <SaCard title="Per-tenant feature matrix">
        <SaTable
          columns={['Organization', ...TENANT_FLAGS.map(f => f.label)]}
          empty={orgsLoading ? 'Loading organizations…' : 'No organizations found.'}
          minWidth={880}
        >
          {organizations.map(org => (
            <tr key={org._id}>
              <td>
                <strong>{org.name}</strong>{' '}
                <SaPill tone={planTone(org.subscriptionPlan)}>{org.subscriptionPlan}</SaPill>
              </td>
              {TENANT_FLAGS.map(f => {
                const cellKey = `${org._id}:${f.key}`;
                const checked = org.featureFlags[f.key];
                return (
                  <td key={f.key} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={savingKey === cellKey}
                      onChange={e => toggleTenantFlag(org, f.key, e.target.checked)}
                      aria-label={`${f.label} for ${org.name}`}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </SaTable>
        <p className="sa-card-meta" style={{ padding: '10px 14px', margin: 0, borderTop: '1px solid var(--border-light)' }}>
          Changes apply on the tenant&apos;s next sync.
        </p>
      </SaCard>

    </SaPage>
  );
}
