'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { useApp } from '@/lib/context';
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
      value: stats.userCount,
      icon: Users,
      color: brandColor,
      bgOpacity: '15',
    },
    {
      label: 'Hospitals',
      value: stats.hospitalCount,
      icon: Building2,
      color: 'var(--accent-primary)',
      bgOpacity: '15',
    },
    {
      label: 'Patients',
      value: stats.patientCount,
      icon: UserCheck,
      color: 'var(--accent-primary)',
      bgOpacity: '15',
    },
    {
      label: 'Subscription',
      value: org?.subscriptionStatus === 'active' ? 'Active' : org?.subscriptionStatus || 'N/A',
      icon: CreditCard,
      color: org?.subscriptionStatus === 'active' ? 'var(--accent-primary)' : 'var(--color-warning)',
      bgOpacity: '15',
    },
  ];

  const featureFlags = org?.featureFlags ? [
    { key: 'epidemicIntelligence', label: 'Epidemic Intelligence', enabled: org.featureFlags.epidemicIntelligence },
    { key: 'mchAnalytics', label: 'MCH Analytics', enabled: org.featureFlags.mchAnalytics },
    { key: 'dhis2Export', label: 'DHIS2 Export', enabled: org.featureFlags.dhis2Export },
    { key: 'aiClinicalSupport', label: 'AI Clinical Support', enabled: org.featureFlags.aiClinicalSupport },
    { key: 'communityHealth', label: 'Community Health', enabled: org.featureFlags.communityHealth },
    { key: 'facilityAssessments', label: 'Facility Assessments', enabled: org.featureFlags.facilityAssessments },
  ] : [];

  const planLabels: Record<string, string> = {
    basic: 'Basic',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Organization Dashboard" />
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
      <TopBar title="Organization Dashboard" />

      <div className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={org?.name || currentUser?.branding?.name || 'Organization'}
          subtitle="Your organization at a glance."
          actions={org?.subscriptionPlan ? (
            <div
              className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
              style={{
                background: `${brandColor}18`,
                color: brandColor,
                border: `1px solid ${brandColor}30`,
              }}
            >
              {planLabels[org.subscriptionPlan] || org.subscriptionPlan} Plan
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
                    {card.label}
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
              Usage This Month
            </h2>
          </div>
          <hr className="section-divider" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Patients registered */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Patients Registered</span>
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
                vs {lastMonthPatients} last month
              </p>
            </div>

            {/* Consultations */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Consultations</span>
                <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{thisMonthConsultations}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>This month</p>
            </div>

            {/* Referrals */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Referrals</span>
                <TrendingUp className="w-4 h-4" style={{ color: '#7C3AED' }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{thisMonthReferrals}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>This month</p>
            </div>
          </div>
        </div>

        {/* FACILITY PERFORMANCE COMPARISON */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: brandColor }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Facility Performance Comparison</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    { key: 'name', label: 'Facility' },
                    { key: 'patients', label: 'Patients' },
                    { key: 'staff', label: 'Staff' },
                    { key: 'occupancy', label: 'Occupancy' },
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
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : sortedFacilities.map(h => {
                  const isTop = h._id === topFacilityId && sortedFacilities.length > 1;
                  const isBottom = h._id === bottomFacilityId && sortedFacilities.length > 1;
                  const staffCount = h.doctors + h.nurses + h.clinicalOfficers;
                  const occupancy = h.totalBeds > 0 ? Math.round((h.patientCount / h.totalBeds) * 100) : 0;
                  return (
                    <tr key={h._id} style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isTop ? 'rgba(16,185,129,0.04)' : isBottom ? 'rgba(239,68,68,0.04)' : 'transparent',
                    }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                          {isTop && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-success)' }}>TOP</span>}
                          {isBottom && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>LOW</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.patientCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{staffCount}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                          background: occupancy > 90 ? 'rgba(239,68,68,0.12)' : occupancy > 70 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
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
                Subscription Details
              </h2>
            </div>

            <div className="data-row-divider-sm">
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Plan</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {planLabels[org?.subscriptionPlan || ''] || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Status</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: org?.subscriptionStatus === 'active' ? 'rgba(43,111,224,0.12)' : 'rgba(245,158,11,0.12)',
                    color: org?.subscriptionStatus === 'active' ? 'var(--accent-primary)' : 'var(--color-warning)',
                  }}
                >
                  {org?.subscriptionStatus || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Max Users</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {stats.userCount} / {org?.maxUsers || '---'}
                  </span>
                  {org?.maxUsers && stats.userCount >= org.maxUsers && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>
                      Limit reached
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Max Hospitals</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {stats.hospitalCount} / {org?.maxHospitals || '---'}
                  </span>
                  {org?.maxHospitals && stats.hospitalCount >= org.maxHospitals && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>
                      Limit reached
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Organization Type</span>
                <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                  {org?.orgType || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Enabled Features
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
                      <span className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>Enabled</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Disabled</span>
                    </div>
                  )}
                </div>
              ))}

              {featureFlags.length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No feature flags configured.
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
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>User Activity Log</span>
            </div>
            {inactiveUsers.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                <AlertTriangle className="w-3 h-3" />
                {inactiveUsers.length} inactive user{inactiveUsers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {['User', 'Action', 'Timestamp', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider sticky top-0" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No activity recorded yet.</td></tr>
                ) : auditLogs.slice(0, 20).map(log => {
                  const isInactive = log.username ? inactiveUsers.includes(log.username) : false;
                  return (
                    <tr key={log._id} style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isInactive ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.username || 'System'}</span>
                          {isInactive && (
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>INACTIVE</span>
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
                          background: log.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: log.success ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {log.success ? 'Success' : 'Failed'}
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
              Quick Actions
            </h2>
          </div>

          <hr className="section-divider" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { href: '/org-admin/users', label: 'Manage Users', icon: Users, desc: 'Create, edit, or deactivate users' },
              { href: '/org-admin/hospitals', label: 'Facilities', icon: Building2, desc: 'View and add hospitals' },
              { href: '/org-admin/branding', label: 'Branding', icon: Palette, desc: 'Colors, logo, and identity' },
              { href: '/org-admin/analytics', label: 'Analytics', icon: BarChart3, desc: 'Organization-wide insights' },
              { href: '/org-admin/settings', label: 'Settings', icon: Settings, desc: 'Plan, limits, and preferences' },
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
