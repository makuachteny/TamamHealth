'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Users, Building2, UserCheck, CreditCard, Shield,
  TrendingUp, TrendingDown, CheckCircle, XCircle, Zap, BarChart3,
  Activity, Clock, ArrowUpDown, Minus, AlertTriangle, Palette, Settings,
} from '@/components/icons/lucide';
import type { OrganizationDoc, AuditLogDoc, HospitalDoc } from '@/lib/db-types';

interface OrgStats {
  userCount: number;
  hospitalCount: number;
  patientCount: number;
}

export default function OrgAdminDashboardPage() {
  return (
    <RoleGuard>
      <OrgAdminDashboard />
    </RoleGuard>
  );
}

function OrgAdminDashboard() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const router = useRouter();
  const [stats, setStats] = useState<OrgStats>({ userCount: 0, hospitalCount: 0, patientCount: 0 });
  const [org, setOrg] = useState<OrganizationDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // New state for features
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [orgHospitals, setOrgHospitals] = useState<HospitalDoc[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [facilitySortCol, setFacilitySortCol] = useState<string>('patients');
  const [facilitySortAsc, setFacilitySortAsc] = useState(false);
  const [lastMonthPatients, setLastMonthPatients] = useState(0);
  const [thisMonthConsultations, setThisMonthConsultations] = useState(0);
  const [thisMonthReferrals, setThisMonthReferrals] = useState(0);

  const brandColor = currentUser?.branding?.primaryColor || '#7C3AED';

  useEffect(() => {
    if (!currentUser?.orgId) return;
    const load = async () => {
      try {
        const { getOrganizationStats } = await import('@/lib/services/organization-service');
        const { getOrganizationById } = await import('@/lib/services/organization-service');
        const [s, o] = await Promise.all([
          getOrganizationStats(currentUser.orgId!),
          getOrganizationById(currentUser.orgId!),
        ]);
        setStats(s);
        if (o) setOrg(o);
      } catch (err) {
        console.error('Failed to load org stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.orgId]);

  // Load audit logs
  useEffect(() => {
    const loadAudit = async () => {
      try {
        const { getRecentAuditLogs } = await import('@/lib/services/audit-service');
        const logs = await getRecentAuditLogs(50);
        setAuditLogs(logs);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setAuditLoading(false);
      }
    };
    loadAudit();
  }, []);

  // Load org hospitals for facility comparison
  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const { getAllHospitals } = await import('@/lib/services/hospital-service');
        const all = await getAllHospitals();
        // Filter by org if user has orgId
        const filtered = currentUser?.orgId
          ? all.filter(h => h.orgId === currentUser.orgId)
          : all;
        setOrgHospitals(filtered.length > 0 ? filtered : all);
      } catch (err) {
        console.error('Failed to load hospitals:', err);
      } finally {
        setHospitalsLoading(false);
      }
    };
    loadHospitals();
  }, [currentUser?.orgId]);

  // Load usage metrics
  useEffect(() => {
    const loadUsage = async () => {
      try {
        const { getAllPatients } = await import('@/lib/services/patient-service');
        const { getAllReferrals } = await import('@/lib/services/referral-service');
        const [patients, referrals] = await Promise.all([getAllPatients(), getAllReferrals()]);

        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

        const thisMonthPats = patients.filter(p => p.createdAt?.startsWith(thisMonth)).length;
        const lastMonthPats = patients.filter(p => p.createdAt?.startsWith(lastMonth)).length;
        setLastMonthPatients(lastMonthPats);

        // Estimate consultations from medical records count this month
        try {
          const { getDB } = await import('@/lib/db');
          const db = getDB('tamamhealth_medical_records');
          const result = await db.allDocs({ include_docs: true });
          const thisMonthRecs = result.rows.filter(r => {
            const doc = r.doc as { createdAt?: string };
            return doc?.createdAt?.startsWith(thisMonth);
          }).length;
          setThisMonthConsultations(thisMonthRecs);
        } catch {
          setThisMonthConsultations(thisMonthPats);
        }

        const thisMonthRefs = referrals.filter(r => r.createdAt?.startsWith(thisMonth)).length;
        setThisMonthReferrals(thisMonthRefs);
      } catch (err) {
        console.error('Failed to load usage:', err);
      }
    };
    loadUsage();
  }, []);

  // Facility comparison sorting
  const sortedFacilities = useMemo(() => {
    const sorted = [...orgHospitals];
    sorted.sort((a, b) => {
      let aVal = 0, bVal = 0;
      switch (facilitySortCol) {
        case 'patients': aVal = a.patientCount; bVal = b.patientCount; break;
        case 'staff': aVal = a.doctors + a.nurses + a.clinicalOfficers; bVal = b.doctors + b.nurses + b.clinicalOfficers; break;
        case 'occupancy': aVal = a.totalBeds > 0 ? a.patientCount / a.totalBeds : 0; bVal = b.totalBeds > 0 ? b.patientCount / b.totalBeds : 0; break;
        default: aVal = a.patientCount; bVal = b.patientCount;
      }
      return facilitySortAsc ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [orgHospitals, facilitySortCol, facilitySortAsc]);

  const handleFacilitySort = useCallback((col: string) => {
    if (facilitySortCol === col) {
      setFacilitySortAsc(prev => !prev);
    } else {
      setFacilitySortCol(col);
      setFacilitySortAsc(false);
    }
  }, [facilitySortCol]);

  // Top/bottom performer detection
  const topFacilityId = sortedFacilities.length > 0 ? sortedFacilities[0]._id : '';
  const bottomFacilityId = sortedFacilities.length > 1 ? sortedFacilities[sortedFacilities.length - 1]._id : '';

  // Inactive users from audit logs: users with no login in 7+ days
  const inactiveUsers = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const userLastAction: Record<string, string> = {};
    auditLogs.forEach(log => {
      if (log.username && (!userLastAction[log.username] || log.createdAt > userLastAction[log.username])) {
        userLastAction[log.username] = log.createdAt;
      }
    });
    return Object.entries(userLastAction)
      .filter(([, lastAction]) => new Date(lastAction) < sevenDaysAgo)
      .map(([username]) => username);
  }, [auditLogs]);

  const statCards = [
    {
      label: 'Total Users',
      displayLabel: t('orgAdmin.statTotalUsers'),
      value: stats.userCount,
      icon: Users,
      color: brandColor,
      bgOpacity: '15',
    },
    {
      label: 'Hospitals',
      displayLabel: t('orgAdmin.statHospitals'),
      value: stats.hospitalCount,
      icon: Building2,
      color: 'var(--accent-primary)',
      bgOpacity: '15',
    },
    {
      label: 'Patients',
      displayLabel: t('orgAdmin.statPatients'),
      value: stats.patientCount,
      icon: UserCheck,
      color: 'var(--accent-primary)',
      bgOpacity: '15',
    },
    {
      label: 'Subscription',
      displayLabel: t('orgAdmin.statSubscription'),
      value: org?.subscriptionStatus === 'active' ? t('orgAdmin.statusActive') : org?.subscriptionStatus || t('orgAdmin.notAvailable'),
      icon: CreditCard,
      color: org?.subscriptionStatus === 'active' ? 'var(--accent-primary)' : 'var(--color-warning)',
      bgOpacity: '15',
    },
  ];

  const featureFlags = org?.featureFlags ? [
    { key: 'epidemicIntelligence', label: t('orgAdmin.featureEpidemicIntelligence'), enabled: org.featureFlags.epidemicIntelligence },
    { key: 'mchAnalytics', label: t('orgAdmin.featureMchAnalytics'), enabled: org.featureFlags.mchAnalytics },
    { key: 'dhis2Export', label: t('orgAdmin.featureDhis2Export'), enabled: org.featureFlags.dhis2Export },
    { key: 'aiClinicalSupport', label: t('orgAdmin.featureAiClinicalSupport'), enabled: org.featureFlags.aiClinicalSupport },
    { key: 'communityHealth', label: t('orgAdmin.featureCommunityHealth'), enabled: org.featureFlags.communityHealth },
    { key: 'facilityAssessments', label: t('orgAdmin.featureFacilityAssessments'), enabled: org.featureFlags.facilityAssessments },
  ] : [];

  const planLabels: Record<string, string> = {
    basic: t('orgAdmin.planBasic'),
    professional: t('orgAdmin.planProfessional'),
    enterprise: t('orgAdmin.planEnterprise'),
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={t('orgAdmin.pageTitle')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={t('orgAdmin.pageTitle')} />

      <div className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={org?.name || currentUser?.branding?.name || t('orgAdmin.organization')}
          subtitle={t('orgAdmin.subtitle')}
          actions={org?.subscriptionPlan ? (
            <div
              className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
              style={{
                background: `${brandColor}18`,
                color: brandColor,
                border: `1px solid ${brandColor}30`,
              }}
            >
              {t('orgAdmin.planBadge', { plan: planLabels[org.subscriptionPlan] || org.subscriptionPlan })}
            </div>
          ) : null}
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="p-5 rounded-xl cursor-pointer"
                onClick={() => {
                  const routes: Record<string, string> = { 'Total Users': '/org-admin/users', 'Hospitals': '/org-admin/hospitals', 'Patients': '/patients', 'Subscription': '/org-admin/settings' };
                  if (routes[card.label]) router.push(routes[card.label]);
                }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="icon-box-sm"
                    style={{ background: `${card.color}${card.bgOpacity}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {card.displayLabel}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* USAGE DASHBOARD */}
        <div className="p-5 rounded-xl mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" style={{ color: brandColor }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('orgAdmin.usageThisMonth')}
            </h2>
          </div>
          <hr className="section-divider" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Patients registered */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.patientsRegistered')}</span>
                {stats.patientCount > lastMonthPatients ? (
                  <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                ) : stats.patientCount < lastMonthPatients ? (
                  <TrendingDown className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                ) : (
                  <Minus className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                )}
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.patientCount}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('orgAdmin.vsLastMonth', { count: lastMonthPatients })}
              </p>
            </div>

            {/* Consultations */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.consultations')}</span>
                <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{thisMonthConsultations}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.thisMonth')}</p>
            </div>

            {/* Referrals */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.referrals')}</span>
                <TrendingUp className="w-4 h-4" style={{ color: '#7C3AED' }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{thisMonthReferrals}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.thisMonth')}</p>
            </div>
          </div>
        </div>

        {/* FACILITY PERFORMANCE COMPARISON */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: brandColor }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgAdmin.facilityComparison')}</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    { key: 'name', label: t('orgAdmin.colFacility') },
                    { key: 'patients', label: t('orgAdmin.colPatients') },
                    { key: 'staff', label: t('orgAdmin.colStaff') },
                    { key: 'occupancy', label: t('orgAdmin.colOccupancy') },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="text-left px-4 py-3 text-xs uppercase tracking-wider cursor-pointer select-none"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}
                      onClick={() => col.key !== 'name' && handleFacilitySort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key !== 'name' && <ArrowUpDown className="w-3 h-3" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hospitalsLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.loading')}</td></tr>
                ) : sortedFacilities.map(h => {
                  const isTop = h._id === topFacilityId && sortedFacilities.length > 1;
                  const isBottom = h._id === bottomFacilityId && sortedFacilities.length > 1;
                  const staffCount = h.doctors + h.nurses + h.clinicalOfficers;
                  const occupancy = h.totalBeds > 0 ? Math.round((h.patientCount / h.totalBeds) * 100) : 0;
                  return (
                    <tr key={h._id} style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isTop ? 'rgba(31, 157, 111,0.04)' : isBottom ? 'rgba(239,68,68,0.04)' : 'transparent',
                    }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                          {isTop && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(31, 157, 111,0.12)', color: 'var(--color-success)' }}>{t('orgAdmin.badgeTop')}</span>}
                          {isBottom && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>{t('orgAdmin.badgeLow')}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.patientCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{staffCount}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                          background: occupancy > 90 ? 'rgba(239,68,68,0.12)' : occupancy > 70 ? 'rgba(245,158,11,0.12)' : 'rgba(31, 157, 111,0.12)',
                          color: occupancy > 90 ? 'var(--color-danger)' : occupancy > 70 ? 'var(--color-warning)' : 'var(--color-success)',
                        }}>{occupancy}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan & Limits + Feature Flags */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Plan Details */}
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" style={{ color: brandColor }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('orgAdmin.subscriptionDetails')}
              </h2>
            </div>

            <div className="data-row-divider-sm">
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.rowPlan')}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {planLabels[org?.subscriptionPlan || ''] || t('orgAdmin.notAvailable')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.rowStatus')}</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: org?.subscriptionStatus === 'active' ? 'rgba(59, 130, 246,0.12)' : 'rgba(245,158,11,0.12)',
                    color: org?.subscriptionStatus === 'active' ? 'var(--accent-primary)' : 'var(--color-warning)',
                  }}
                >
                  {org?.subscriptionStatus || t('orgAdmin.notAvailable')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.rowMaxUsers')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {stats.userCount} / {org?.maxUsers || '---'}
                  </span>
                  {org?.maxUsers && stats.userCount >= org.maxUsers && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>
                      {t('orgAdmin.limitReached')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.rowMaxHospitals')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {stats.hospitalCount} / {org?.maxHospitals || '---'}
                  </span>
                  {org?.maxHospitals && stats.hospitalCount >= org.maxHospitals && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>
                      {t('orgAdmin.limitReached')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.rowOrgType')}</span>
                <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                  {org?.orgType || t('orgAdmin.notAvailable')}
                </span>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('orgAdmin.enabledFeatures')}
              </h2>
            </div>

            <div className="data-row-divider-sm">
              {featureFlags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {flag.label}
                  </span>
                  {flag.enabled ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>{t('orgAdmin.enabled')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.disabled')}</span>
                    </div>
                  )}
                </div>
              ))}

              {featureFlags.length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('orgAdmin.noFeatureFlags')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* USER ACTIVITY LOG */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgAdmin.userActivityLog')}</span>
            </div>
            {inactiveUsers.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                <AlertTriangle className="w-3 h-3" />
                {t('orgAdmin.inactiveUsers', { count: inactiveUsers.length })}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[t('orgAdmin.colUser'), t('orgAdmin.colAction'), t('orgAdmin.colTimestamp'), t('orgAdmin.colStatus')].map(header => (
                    <th key={header} className="text-left px-4 py-3 text-xs uppercase tracking-wider sticky top-0" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.loading')}</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('orgAdmin.noActivity')}</td></tr>
                ) : auditLogs.slice(0, 20).map(log => {
                  const isInactive = log.username ? inactiveUsers.includes(log.username) : false;
                  return (
                    <tr key={log._id} style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isInactive ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.username || t('orgAdmin.system')}</span>
                          {isInactive && (
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>{t('orgAdmin.badgeInactive')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{log.action}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                          background: log.success ? 'rgba(31, 157, 111,0.12)' : 'rgba(239,68,68,0.12)',
                          color: log.success ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {log.success ? t('orgAdmin.statusSuccess') : t('orgAdmin.statusFailed')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" style={{ color: brandColor }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('dashboard.quickActions')}
            </h2>
          </div>

          <hr className="section-divider" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { href: '/org-admin/users', label: t('orgAdmin.actionManageUsers'), icon: Users, desc: t('orgAdmin.actionManageUsersDesc') },
              { href: '/org-admin/hospitals', label: t('orgAdmin.actionFacilities'), icon: Building2, desc: t('orgAdmin.actionFacilitiesDesc') },
              { href: '/org-admin/branding', label: t('orgAdmin.actionBranding'), icon: Palette, desc: t('orgAdmin.actionBrandingDesc') },
              { href: '/org-admin/analytics', label: t('orgAdmin.actionAnalytics'), icon: BarChart3, desc: t('orgAdmin.actionAnalyticsDesc') },
              { href: '/org-admin/settings', label: t('orgAdmin.actionSettings'), icon: Settings, desc: t('orgAdmin.actionSettingsDesc') },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-4 rounded-lg transition-all hover:scale-[1.01]"
                  style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    className="icon-box-sm flex-shrink-0"
                    style={{ background: `${brandColor}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
