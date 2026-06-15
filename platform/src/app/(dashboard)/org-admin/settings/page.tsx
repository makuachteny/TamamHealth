'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import {
  Settings, Mail, CreditCard, Building2,
  CheckCircle, XCircle, Zap, Lock, Info, Shield, Timer,
} from '@/components/icons/lucide';
import type { OrganizationDoc } from '@/lib/db-types';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function OrgSettingsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const [org, setOrg] = useState<OrganizationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockTimeout, setLockTimeout] = useState<number>(1);
  const [savingTimeout, setSavingTimeout] = useState(false);

  const brandColor = currentUser?.branding?.primaryColor || '#7C3AED';

  useEffect(() => {
    if (!currentUser?.orgId) return;
    const load = async () => {
      try {
        const { getOrganizationById } = await import('@/lib/services/organization-service');
        const o = await getOrganizationById(currentUser.orgId!);
        if (o) { setOrg(o); setLockTimeout(o.lockTimeoutMinutes ?? 1); }
      } catch (err) {
        console.error('Failed to load org settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.orgId]);

  const planLabels: Record<string, string> = {
    basic: t('orgSettings.planBasic'),
    professional: t('orgSettings.planProfessional'),
    enterprise: t('orgSettings.planEnterprise'),
  };

  const statusColors: Record<string, string> = {
    active: 'var(--accent-primary)',
    trial: 'var(--color-warning)',
    suspended: 'var(--color-danger)',
    cancelled: '#6B7280',
  };

  const featureFlags = org?.featureFlags ? [
    { key: 'epidemicIntelligence', label: t('orgSettings.flagEpidemicIntelligence'), desc: t('orgSettings.flagEpidemicIntelligenceDesc') },
    { key: 'mchAnalytics', label: t('orgSettings.flagMchAnalytics'), desc: t('orgSettings.flagMchAnalyticsDesc') },
    { key: 'dhis2Export', label: t('orgSettings.flagDhis2Export'), desc: t('orgSettings.flagDhis2ExportDesc') },
    { key: 'aiClinicalSupport', label: t('orgSettings.flagAiClinicalSupport'), desc: t('orgSettings.flagAiClinicalSupportDesc') },
    { key: 'communityHealth', label: t('orgSettings.flagCommunityHealth'), desc: t('orgSettings.flagCommunityHealthDesc') },
    { key: 'facilityAssessments', label: t('orgSettings.flagFacilityAssessments'), desc: t('orgSettings.flagFacilityAssessmentsDesc') },
  ] : [];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={t('orgSettings.title')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Organization Settings" />

      <div className="page-container page-enter">
        <PageHeader
          icon={Settings}
          title={t('orgSettings.title')}
          subtitle={t('orgSettings.subtitle')}
        />

        {/* Read-only notice */}
        <div className="mb-6 p-3 rounded-lg flex items-center gap-2" style={{ background: `${brandColor}08`, border: `1px solid ${brandColor}20` }}>
          <Lock className="w-4 h-4 flex-shrink-0" style={{ color: brandColor }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('orgSettings.readOnlyNotice')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Info */}
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5" style={{ color: brandColor }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.organizationInfo')}</h2>
            </div>

            <div className="space-y-3">
              <InfoRow label={t('orgSettings.fieldName')} value={org?.name || '-'} />
              <InfoRow label={t('orgSettings.fieldSlug')} value={org?.slug || '-'} mono />
              <InfoRow label={t('orgSettings.fieldType')} value={org?.orgType === 'public' ? t('orgSettings.publicSector') : t('orgSettings.privateSector')} />
              <InfoRow label={t('orgSettings.fieldCountry')} value={org?.country || '-'} />
              <InfoRow label={t('orgSettings.fieldContactEmail')} value={org?.contactEmail || '-'} icon={<Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />} />
              <InfoRow
                label={t('orgSettings.fieldStatus')}
                value={org?.isActive ? t('orgSettings.statusActive') : t('orgSettings.statusInactive')}
                badge
                badgeColor={org?.isActive ? 'var(--accent-primary)' : 'var(--color-danger)'}
              />
            </div>
          </div>

          {/* Subscription */}
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.subscription')}</h2>
            </div>

            <div className="space-y-3">
              <InfoRow
                label={t('orgSettings.fieldPlan')}
                value={planLabels[org?.subscriptionPlan || ''] || '-'}
                badge
                badgeColor={brandColor}
              />
              <InfoRow
                label={t('orgSettings.fieldStatus')}
                value={org?.subscriptionStatus || '-'}
                badge
                badgeColor={statusColors[org?.subscriptionStatus || ''] || '#6B7280'}
              />
              <InfoRow label={t('orgSettings.fieldMaxUsers')} value={String(org?.maxUsers || '-')} />
              <InfoRow label={t('orgSettings.fieldMaxHospitals')} value={String(org?.maxHospitals || '-')} />
              <InfoRow
                label={t('orgSettings.fieldCreated')}
                value={org?.createdAt ? new Date(org.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              />
              <InfoRow
                label={t('orgSettings.fieldLastUpdated')}
                value={org?.updatedAt ? new Date(org.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              />
            </div>
          </div>

          {/* Security — Screen Lock */}
          <div className="lg:col-span-2 p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.security')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lock timeout setting */}
              <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.screenLockTimeout')}</span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {t('orgSettings.screenLockTimeoutDesc')}
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={lockTimeout}
                    onChange={e => setLockTimeout(Number(e.target.value))}
                    className="text-sm"
                    style={{ width: 'auto', padding: '6px 32px 6px 10px' }}
                  >
                    <option value={1}>{t('orgSettings.minuteOne')}</option>
                    <option value={2}>{t('orgSettings.minutes', { count: 2 })}</option>
                    <option value={5}>{t('orgSettings.minutes', { count: 5 })}</option>
                    <option value={10}>{t('orgSettings.minutes', { count: 10 })}</option>
                    <option value={15}>{t('orgSettings.minutes', { count: 15 })}</option>
                    <option value={30}>{t('orgSettings.minutes', { count: 30 })}</option>
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={savingTimeout || lockTimeout === (org?.lockTimeoutMinutes ?? 1)}
                    onClick={async () => {
                      if (!org) return;
                      setSavingTimeout(true);
                      try {
                        const { updateOrganization } = await import('@/lib/services/organization-service');
                        await updateOrganization(org._id, { lockTimeoutMinutes: lockTimeout });
                        setOrg({ ...org, lockTimeoutMinutes: lockTimeout });
                        // Also persist to localStorage for immediate effect
                        localStorage.setItem('tamamhealth-lock-timeout', String(lockTimeout * 60_000));
                        showToast(t('orgSettings.toastTimeoutUpdated'), 'success');
                      } catch {
                        showToast(t('orgSettings.toastTimeoutFailed'), 'error');
                      } finally {
                        setSavingTimeout(false);
                      }
                    }}
                  >
                    {savingTimeout ? t('orgSettings.saving') : t('action.save')}
                  </button>
                </div>
              </div>

              {/* Lock behavior info */}
              <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.lockBehavior')}</span>
                </div>
                <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <li className="flex items-start gap-1.5">
                    <span style={{ color: 'var(--accent-primary)' }}>&#8226;</span>
                    {t('orgSettings.lockBehaviorImmediate')}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span style={{ color: 'var(--accent-primary)' }}>&#8226;</span>
                    {lockTimeout === 1 ? t('orgSettings.lockBehaviorAfterOne') : t('orgSettings.lockBehaviorAfter', { count: lockTimeout })}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span style={{ color: 'var(--accent-primary)' }}>&#8226;</span>
                    {t('orgSettings.lockBehaviorPin')}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span style={{ color: 'var(--accent-primary)' }}>&#8226;</span>
                    {t('orgSettings.lockBehaviorSwitchUser')}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="lg:col-span-2 p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgSettings.featureFlags')}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full ml-2" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                {t('orgSettings.readOnlyBadge')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featureFlags.map((flag) => {
                const enabled = org?.featureFlags?.[flag.key as keyof typeof org.featureFlags] || false;
                return (
                  <div
                    key={flag.key}
                    className="flex items-start gap-3 p-3 rounded-lg"
                    style={{
                      background: enabled ? 'rgba(59, 130, 246,0.05)' : 'var(--overlay-subtle)',
                      border: `1px solid ${enabled ? 'rgba(59, 130, 246,0.15)' : 'var(--border-light)'}`,
                    }}
                  >
                    <div className="pt-0.5">
                      {enabled ? (
                        <CheckCircle className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                      ) : (
                        <XCircle className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {flag.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {flag.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

              {featureFlags.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('orgSettings.noFeatureFlags')}
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg flex items-start gap-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('orgSettings.featureFlagsInfo')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for read-only info rows
function InfoRow({
  label,
  value,
  mono,
  icon,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  badge?: boolean;
  badgeColor?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        {badge ? (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
            style={{
              background: `${badgeColor}15`,
              color: badgeColor,
            }}
          >
            {value}
          </span>
        ) : (
          <span
            className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}
            style={{ color: 'var(--text-primary)' }}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
