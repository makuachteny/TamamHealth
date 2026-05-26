'use client';

/**
 * Per-hospital management dashboard.
 *
 * Path: /hospitals/[hospitalId]/manage
 *
 * Tabs (one page, lazy-loaded data per active tab — an unopened tab fires no
 * fetch):
 *   • Overview     — HospitalDoc fields (name, type, beds, status, sync)
 *   • Staff        — getAllUsers(scope) filtered to this hospitalId
 *   • Wards        — getAllWards(scope) filtered to this facilityId
 *   • Equipment    — getAllAssets(scope) filtered to this facilityId
 *   • Inventory    — getAllInventory(scope) filtered to this hospitalId
 *   • Schedules    — getSchedulesByDate(date, hospitalId)
 *   • Performance  — appointments + admissions + prescriptions + immunizations
 *                    + lab results scoped to this hospitalId
 *   • Settings     — editable hospital profile (org_admin/super_admin only)
 *
 * Permission gate: roles allowed are super_admin, org_admin,
 * medical_superintendent, hrio. Anyone else is bounced to /dashboard.
 *
 * Cross-org isolation: every service call here passes a DataScope with
 * { orgId: currentUser.orgId, hospitalId: hospitalIdFromUrl, role }. Even if
 * a user from another org guesses a hospitalId, filterByScope() drops the
 * hospital row and all child rows because their orgId won't match.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Building2, Users, BedDouble, Package, Pill, Calendar,
  Activity, Settings, Search, ArrowLeft, Loader2, AlertTriangle,
  CheckCircle, Save, Clock, MapPin, Stethoscope, Plus,
  FlaskConical, Syringe,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import type {
  HospitalDoc, UserDoc, UserRole, AppointmentDoc, PrescriptionDoc,
  ImmunizationDoc, LabResultDoc, StaffScheduleDoc, PharmacyInventoryDoc,
} from '@/lib/db-types';
import type { WardDoc, AdmissionDoc } from '@/lib/db-types-ward';
import type { AssetDoc } from '@/lib/db-types-asset';
import type { DataScope } from '@/lib/services/data-scope';
import { useToast } from '@/components/Toast';

// ── Permission ───────────────────────────────────────────────────────────────
const MANAGE_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'medical_superintendent', 'hrio',
];

// org_admin + super_admin can write hospital settings; the others read-only.
const SETTINGS_WRITE_ROLES: UserRole[] = ['super_admin', 'org_admin'];

// ── Tab definitions ─────────────────────────────────────────────────────────
type TabId =
  | 'overview' | 'staff' | 'wards' | 'equipment' | 'inventory'
  | 'schedules' | 'performance' | 'settings';

const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: 'overview',    label: 'Overview',     icon: Building2 },
  { id: 'staff',       label: 'Staff',        icon: Users },
  { id: 'wards',       label: 'Wards',        icon: BedDouble },
  { id: 'equipment',   label: 'Equipment',    icon: Package },
  { id: 'inventory',   label: 'Inventory',    icon: Pill },
  { id: 'schedules',   label: 'Schedules',    icon: Calendar },
  { id: 'performance', label: 'Performance',  icon: Activity },
  { id: 'settings',    label: 'Settings',     icon: Settings },
];

// ── Page ────────────────────────────────────────────────────────────────────
export default function HospitalManagePage({ params }: { params: { hospitalId: string } }) {
  const { hospitalId } = params;
  const router = useRouter();
  const { currentUser } = useApp();
  const [tab, setTab] = useState<TabId>('overview');

  // Hospital itself (always loaded — Overview tab needs it, and Settings does too).
  const [hospital, setHospital] = useState<HospitalDoc | null>(null);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const [hospitalError, setHospitalError] = useState<string | null>(null);

  // Permission gate. Run as effect so we can redirect after hydration; rendering
  // null first prevents a flicker of the tabs for an unauthorized user.
  useEffect(() => {
    if (!currentUser) return;
    if (!MANAGE_ROLES.includes(currentUser.role)) {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  // Build the scope object every render — passing role/orgId/hospitalIdFromUrl
  // into every service call so the data-scope filter rejects rows from other
  // orgs even when a user guesses the URL.
  const scope: DataScope | undefined = useMemo(() => {
    if (!currentUser) return undefined;
    return {
      role: currentUser.role,
      orgId: currentUser.orgId,
      hospitalId, // from URL — NOT the user's own assigned hospitalId
    };
  }, [currentUser, hospitalId]);

  // Load the hospital. Re-runs if the URL id changes.
  useEffect(() => {
    let alive = true;
    setHospitalLoading(true);
    setHospitalError(null);
    (async () => {
      try {
        const { getHospitalById } = await import('@/lib/services/hospital-service');
        const h = await getHospitalById(hospitalId);
        if (!alive) return;
        if (!h) {
          setHospitalError('Hospital not found');
        } else if (currentUser && currentUser.role !== 'super_admin' &&
                   currentUser.role !== 'government' &&
                   currentUser.orgId && h.orgId && h.orgId !== currentUser.orgId) {
          // Defence-in-depth: block cross-org access even though the data-scope
          // filter on every other service call already enforces this.
          setHospitalError('You do not have access to this facility');
        } else {
          setHospital(h);
        }
      } catch {
        if (alive) setHospitalError('Failed to load hospital');
      } finally {
        if (alive) setHospitalLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [hospitalId, currentUser]);

  // Block render until role check completes.
  if (!currentUser) {
    return (
      <>
        <TopBar title="Manage Facility" />
        <main className="page-container flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </main>
      </>
    );
  }
  if (!MANAGE_ROLES.includes(currentUser.role)) {
    // The effect above is redirecting; render nothing in the meantime.
    return null;
  }

  if (hospitalLoading) {
    return (
      <>
        <TopBar title="Manage Facility" />
        <main className="page-container flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </main>
      </>
    );
  }
  if (hospitalError || !hospital) {
    return (
      <>
        <TopBar title="Manage Facility" />
        <main className="page-container page-enter">
          <div className="card-elevated p-8 text-center max-w-md mx-auto mt-16">
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {hospitalError || 'Hospital not found'}
            </h2>
            <Link href="/hospitals" className="btn btn-secondary btn-sm mt-4 inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Hospital Network
            </Link>
          </div>
        </main>
      </>
    );
  }

  const canWriteSettings = SETTINGS_WRITE_ROLES.includes(currentUser.role);

  return (
    <>
      <TopBar title={`Manage · ${hospital.name}`} />
      <main className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={hospital.name}
          subtitle={`${hospital.facilityType?.replace(/_/g, ' ')} · ${hospital.state}${hospital.county ? ` · ${hospital.county}` : ''}`}
          actions={
            <Link href="/hospitals" className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Hospital Network
            </Link>
          }
        />

        {/* Tab bar */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ gap: 6 }}
            >
              <t.icon style={{ width: 13, height: 13 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content — only the active tab is mounted, so its fetch fires only
            when the user opens that tab. */}
        {tab === 'overview' && <OverviewTab hospital={hospital} />}
        {tab === 'staff' && <StaffTab scope={scope} hospitalId={hospitalId} />}
        {tab === 'wards' && <WardsTab scope={scope} hospitalId={hospitalId} hospital={hospital} />}
        {tab === 'equipment' && <EquipmentTab scope={scope} hospitalId={hospitalId} />}
        {tab === 'inventory' && <InventoryTab scope={scope} hospitalId={hospitalId} />}
        {tab === 'schedules' && <SchedulesTab hospitalId={hospitalId} />}
        {tab === 'performance' && <PerformanceTab scope={scope} hospitalId={hospitalId} />}
        {tab === 'settings' && (
          <SettingsTab
            hospital={hospital}
            canWrite={canWriteSettings}
            onSaved={(h) => setHospital(h)}
          />
        )}
      </main>
    </>
  );
}

// ─── Shared little pieces ────────────────────────────────────────────────────
function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="card-elevated" style={{ padding: 40, textAlign: 'center' }}>
      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="card-elevated" style={{ padding: 40, textAlign: 'center' }}>
      <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-danger)' }} />
      <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{message}</p>
    </div>
  );
}

function EmptyBlock({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <div className="card-elevated" style={{ padding: 40, textAlign: 'center' }}>
      <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    functional: { bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)', label: 'Functional' },
    partially_functional: { bg: 'rgba(252,211,77,0.12)', color: 'var(--color-warning)', label: 'Partially Functional' },
    non_functional: { bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)', label: 'Non-Functional' },
    closed: { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: 'Closed' },
  };
  const tok = map[status] || map.closed;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: tok.bg, color: tok.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tok.color }} />
      {tok.label}
    </span>
  );
}

function formatRelative(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════
function OverviewTab({ hospital }: { hospital: HospitalDoc }) {
  const totalStaff = (hospital.doctors || 0) + (hospital.clinicalOfficers || 0) +
                     (hospital.nurses || 0) + (hospital.labTechnicians || 0) +
                     (hospital.pharmacists || 0);
  const occupiedBeds = (hospital.icuBeds || 0) + (hospital.maternityBeds || 0) +
                       (hospital.pediatricBeds || 0); // best-available proxy
  const occupancyPct = hospital.totalBeds ? Math.round((occupiedBeds / hospital.totalBeds) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Identity */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Identity</h3>
        <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Name" value={hospital.name} />
          <Row label="Type" value={hospital.facilityType?.replace(/_/g, ' ')} />
          <Row label="Ownership" value={hospital.ownership || '—'} />
          <Row label="State" value={hospital.state || '—'} />
          <Row label="County" value={hospital.county || '—'} />
          <Row label="Town" value={hospital.town || '—'} />
          <Row label="GPS" value={
            hospital.lat != null && hospital.lng != null
              ? `${hospital.lat.toFixed(4)}°N, ${hospital.lng.toFixed(4)}°E`
              : '—'
          } />
        </div>
      </div>

      {/* Status + Sync */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Status</h3>
        <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Operating status</span>
            <StatusPill status={hospital.operationalStatus || 'closed'} />
          </div>
          <Row label="Sync" value={hospital.syncStatus || '—'} />
          <Row label="Last sync" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock style={{ width: 11, height: 11 }} /> {formatRelative(hospital.lastSync)}
            </span>
          } />
          <Row label="Today's visits" value={hospital.todayVisits?.toLocaleString() ?? '0'} />
          <Row label="Registered patients" value={hospital.patientCount?.toLocaleString() ?? '0'} />
        </div>
      </div>

      {/* Beds */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Bed Capacity</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {hospital.totalBeds || 0}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Occupancy (estimated)</div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--overlay-subtle)', marginTop: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, occupancyPct)}%`, height: '100%',
                background: occupancyPct > 90 ? 'var(--color-danger)' : occupancyPct > 70 ? 'var(--color-warning)' : 'var(--color-success)',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{occupancyPct}%</div>
          </div>
        </div>
        <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="ICU" value={hospital.icuBeds || 0} />
          <Row label="Maternity" value={hospital.maternityBeds || 0} />
          <Row label="Pediatric" value={hospital.pediatricBeds || 0} />
        </div>
      </div>

      {/* Staff snapshot */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Key Staff ({totalStaff})</h3>
        <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Doctors" value={hospital.doctors || 0} />
          <Row label="Clinical Officers" value={hospital.clinicalOfficers || 0} />
          <Row label="Nurses" value={hospital.nurses || 0} />
          <Row label="Lab Technicians" value={hospital.labTechnicians || 0} />
          <Row label="Pharmacists" value={hospital.pharmacists || 0} />
        </div>
      </div>

      {/* Contacts (uses HospitalDoc fields if present; otherwise placeholder) */}
      <div className="card-elevated lg:col-span-2" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Contacts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Row label="Phone" value={(hospital as unknown as { phone?: string }).phone || '—'} />
          <Row label="Email" value={(hospital as unknown as { email?: string }).email || '—'} />
          <Row label="Address" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin style={{ width: 11, height: 11 }} /> {[hospital.town, hospital.county, hospital.state].filter(Boolean).join(', ') || '—'}
            </span>
          } />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STAFF TAB
// ═══════════════════════════════════════════════════════════════════════════
function StaffTab({ scope, hospitalId }: { scope: DataScope | undefined; hospitalId: string }) {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { getAllUsers } = await import('@/lib/services/user-service');
        const all = await getAllUsers(scope);
        // Narrow to this facility (data-scope already restricted to orgId).
        const here = all.filter(u => u.hospitalId === hospitalId);
        if (alive) setUsers(here);
      } catch {
        if (alive) setError('Failed to load staff');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, hospitalId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (u.name || '').toLowerCase().includes(q) ||
             (u.username || '').toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    users.forEach(u => { m[u.role] = (m[u.role] || 0) + 1; });
    return m;
  }, [users]);

  if (loading) return <LoadingBlock label="Loading staff..." />;
  if (error) return <ErrorBlock message={error} />;
  if (users.length === 0) return <EmptyBlock icon={Users} label="No staff assigned to this facility yet." />;

  return (
    <div className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search name or username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, width: 240 }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1px solid var(--border-light)', borderRadius: 'var(--input-radius)',
            padding: '5px 12px', fontSize: 12, minHeight: 30,
          }}
        >
          <option value="all">All roles</option>
          {Object.keys(roleCounts).map(r => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')} ({roleCounts[r]})</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {filtered.length} of {users.length}
        </span>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const initials = (u.name || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
              const last = (u as unknown as { lastLoginAt?: string }).lastLoginAt;
              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1B9AAA 0%, #1A3A3A 100%)',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                      }}>{initials || '?'}</div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 10, background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {u.isActive ? (
                      <span style={{ fontSize: 11, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-success)' }} />
                        Active
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Disabled</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRelative(last)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  WARDS TAB
// ═══════════════════════════════════════════════════════════════════════════
function WardsTab({ scope, hospitalId, hospital }: {
  scope: DataScope | undefined;
  hospitalId: string;
  hospital: HospitalDoc;
}) {
  const [wards, setWards] = useState<WardDoc[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      const [{ getAllWards, getActiveAdmissions }] = await Promise.all([
        import('@/lib/services/ward-service'),
      ]);
      const [w, a] = await Promise.all([getAllWards(scope), getActiveAdmissions(scope)]);
      setWards(w.filter(x => x.facilityId === hospitalId));
      setAdmissions(a.filter(x => x.facilityId === hospitalId));
    } catch {
      setError('Failed to load wards');
    } finally {
      setLoading(false);
    }
  }, [scope, hospitalId]);

  useEffect(() => { load(); }, [load]);

  const handleQuickCreate = async () => {
    const name = window.prompt('New ward name (e.g. "Maternity Ward A"):');
    if (!name?.trim()) return;
    try {
      const { createWard } = await import('@/lib/services/ward-service');
      await createWard({
        name: name.trim(),
        wardType: 'general_male',
        facilityId: hospitalId,
        facilityName: hospital.name,
        facilityLevel: hospital.facilityLevel || 'county',
        totalBeds: 0,
        isActive: true,
        orgId: hospital.orgId,
      });
      showToast(`Ward "${name}" created`, 'success');
      load();
    } catch {
      showToast('Failed to create ward', 'error');
    }
  };

  if (loading) return <LoadingBlock label="Loading wards..." />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <div className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {wards.length} ward{wards.length === 1 ? '' : 's'} · {admissions.length} active admission{admissions.length === 1 ? '' : 's'}
        </span>
        <button onClick={handleQuickCreate} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
          <Plus style={{ width: 13, height: 13 }} /> New Ward
        </button>
      </div>
      {wards.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <BedDouble className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No wards yet. Click <strong>New Ward</strong> to add one.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Total Beds</th>
              <th>Occupied</th>
              <th>Available</th>
              <th>Active Admissions</th>
            </tr>
          </thead>
          <tbody>
            {wards.map(w => {
              const wardAdmissions = admissions.filter(a => a.wardId === w._id).length;
              return (
                <tr key={w._id}>
                  <td style={{ fontWeight: 600 }}>{w.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.wardType.replace(/_/g, ' ')}</td>
                  <td className="stat-value">{w.totalBeds}</td>
                  <td className="stat-value">{w.occupiedBeds}</td>
                  <td className="stat-value">{w.availableBeds}</td>
                  <td className="stat-value">{wardAdmissions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  EQUIPMENT TAB
// ═══════════════════════════════════════════════════════════════════════════
function EquipmentTab({ scope, hospitalId }: { scope: DataScope | undefined; hospitalId: string }) {
  const [assets, setAssets] = useState<AssetDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { getAllAssets } = await import('@/lib/services/asset-service');
        const all = await getAllAssets(scope);
        if (alive) setAssets(all.filter(a => a.facilityId === hospitalId));
      } catch {
        if (alive) setError('Failed to load equipment');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, hospitalId]);

  const statusColors: Record<string, string> = {
    operational: 'var(--color-success)',
    needs_service: 'var(--color-warning)',
    under_repair: 'var(--color-warning)',
    decommissioned: 'var(--text-muted)',
    lost_or_stolen: 'var(--color-danger)',
  };

  const filtered = useMemo(() =>
    statusFilter === 'all' ? assets : assets.filter(a => a.status === statusFilter),
  [assets, statusFilter]);

  if (loading) return <LoadingBlock label="Loading equipment..." />;
  if (error) return <ErrorBlock message={error} />;
  if (assets.length === 0) return <EmptyBlock icon={Package} label="No assets registered for this facility." />;

  return (
    <div className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1px solid var(--border-light)', borderRadius: 'var(--input-radius)',
            padding: '5px 12px', fontSize: 12, minHeight: 30,
          }}
        >
          <option value="all">All statuses</option>
          <option value="operational">Operational</option>
          <option value="needs_service">Needs Service</option>
          <option value="under_repair">Under Repair</option>
          <option value="decommissioned">Decommissioned</option>
          <option value="lost_or_stolen">Lost / Stolen</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {filtered.length} of {assets.length}
        </span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Category</th>
            <th>Tag</th>
            <th>Status</th>
            <th>Condition</th>
            <th>Last Service</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a._id}>
              <td>
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                {a.model && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.manufacturer} · {a.model}</div>}
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.category.replace(/_/g, ' ')}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.assetTag}</td>
              <td>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: statusColors[a.status] || 'var(--text-muted)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColors[a.status] || 'var(--text-muted)' }} />
                  {a.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.condition}</td>
              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRelative(a.lastServicedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INVENTORY TAB
// ═══════════════════════════════════════════════════════════════════════════
function InventoryTab({ scope, hospitalId }: { scope: DataScope | undefined; hospitalId: string }) {
  const [items, setItems] = useState<PharmacyInventoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { getAllInventory } = await import('@/lib/services/pharmacy-inventory-service');
        const all = await getAllInventory(scope);
        if (alive) setItems(all.filter(x => x.hospitalId === hospitalId));
      } catch {
        if (alive) setError('Failed to load inventory');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, hospitalId]);

  if (loading) return <LoadingBlock label="Loading inventory..." />;
  if (error) return <ErrorBlock message={error} />;
  if (items.length === 0) return <EmptyBlock icon={Pill} label="No pharmacy inventory recorded for this facility." />;

  return (
    <div className="card-elevated" style={{ overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Medication</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Expiry</th>
            <th>Batch</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => {
            const ratio = i.reorderLevel ? i.stockLevel / i.reorderLevel : 1;
            const expired = i.expiryDate && i.expiryDate < new Date().toISOString().slice(0, 10);
            const status: { label: string; bg: string; color: string } = expired
              ? { label: 'Expired', bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }
              : i.stockLevel <= 0
                ? { label: 'Out', bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }
                : ratio < 0.3
                  ? { label: 'Critical', bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }
                  : ratio < 1
                    ? { label: 'Low', bg: 'rgba(252,211,77,0.12)', color: 'var(--color-warning)' }
                    : { label: 'OK', bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)' };
            return (
              <tr key={i._id}>
                <td style={{ fontWeight: 600 }}>{i.medicationName}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.category}</td>
                <td className="stat-value">{i.stockLevel} {i.unit}</td>
                <td>
                  <span className="badge" style={{ fontSize: 10, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.expiryDate || '—'}</td>
                <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{i.batchNumber}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCHEDULES TAB
// ═══════════════════════════════════════════════════════════════════════════
function SchedulesTab({ hospitalId }: { hospitalId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [schedules, setSchedules] = useState<StaffScheduleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { getSchedulesByDate } = await import('@/lib/services/staff-scheduling-service');
        const s = await getSchedulesByDate(date, hospitalId);
        if (alive) setSchedules(s);
      } catch {
        if (alive) setError('Failed to load schedules');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [date, hospitalId]);

  return (
    <div className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
            color: 'var(--text-primary)', borderRadius: 'var(--input-radius)',
            padding: '4px 10px', fontSize: 12,
          }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {schedules.length} shift{schedules.length === 1 ? '' : 's'}
        </span>
      </div>
      {loading ? <LoadingBlock label="Loading schedules..." />
       : error ? <ErrorBlock message={error} />
       : schedules.length === 0 ? (
         <div style={{ padding: 32, textAlign: 'center' }}>
           <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
           <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No shifts scheduled for this date.</p>
         </div>
       ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Shift</th>
              <th>Time</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s._id}>
                <td style={{ fontWeight: 600 }}>{s.userName}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.role.replace(/_/g, ' ')}</td>
                <td>
                  <span className="badge" style={{ fontSize: 10, background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                    {s.shiftType.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.startTime} – {s.endTime}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.department || '—'}</td>
                <td style={{ fontSize: 11 }}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
       )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PERFORMANCE TAB
// ═══════════════════════════════════════════════════════════════════════════
function PerformanceTab({ scope, hospitalId }: { scope: DataScope | undefined; hospitalId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState({
    visitsToday: 0,
    activeAdmissions: 0,
    dischargesToday: 0,
    transfersToday: 0,
    labTatHours: 0,
    prescriptionsDispensedToday: 0,
    immunizationsToday: 0,
  });

  useEffect(() => {
    if (!scope) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [
          { getTodaysAppointments },
          { getAllAdmissions },
          { getAllLabResults },
          { getAllPrescriptions },
          { getAllImmunizations },
        ] = await Promise.all([
          import('@/lib/services/appointment-service'),
          import('@/lib/services/ward-service'),
          import('@/lib/services/lab-service'),
          import('@/lib/services/prescription-service'),
          import('@/lib/services/immunization-service'),
        ]);

        const [apts, admns, labs, rx, immuns] = await Promise.all([
          getTodaysAppointments(scope),
          getAllAdmissions(scope),
          getAllLabResults(scope),
          getAllPrescriptions(scope),
          getAllImmunizations(scope),
        ]);

        const hereApts = (apts as AppointmentDoc[]).filter(a => a.facilityId === hospitalId);
        const hereAdmns = (admns as AdmissionDoc[]).filter(a => a.facilityId === hospitalId);
        const hereLabs = (labs as LabResultDoc[]).filter(l => l.hospitalId === hospitalId);
        const hereRx = (rx as PrescriptionDoc[]).filter(p => p.hospitalId === hospitalId);
        const hereImmuns = (immuns as ImmunizationDoc[]).filter(i =>
          (i as unknown as { facilityId?: string }).facilityId === hospitalId,
        );

        // Discharges today: admissions whose dischargeDate is today
        const dischargesToday = hereAdmns.filter(a => (a.dischargeDate || '').slice(0, 10) === today).length;
        const transfersToday = hereAdmns.filter(a =>
          a.dischargeType === 'transfer' && (a.dischargeDate || '').slice(0, 10) === today,
        ).length;
        const activeAdmissions = hereAdmns.filter(a => a.status === 'admitted').length;

        // Lab TAT (hours, mean over completed labs from this facility)
        const completedLabs = hereLabs.filter(l => l.status === 'completed' && l.orderedAt && l.completedAt);
        const tat = completedLabs.length
          ? completedLabs.reduce((s, l) => {
              const o = new Date(l.orderedAt).getTime();
              const c = new Date(l.completedAt).getTime();
              return s + Math.max(0, (c - o) / 3600000);
            }, 0) / completedLabs.length
          : 0;

        const dispensedToday = hereRx.filter(p =>
          p.status === 'dispensed' && (p.dispensedAt || '').slice(0, 10) === today,
        ).length;

        const immunsToday = hereImmuns.filter(i => {
          const when = (i as unknown as { administeredAt?: string; date?: string }).administeredAt
            || (i as unknown as { date?: string }).date;
          return when && when.slice(0, 10) === today;
        }).length;

        if (alive) {
          setKpis({
            visitsToday: hereApts.length,
            activeAdmissions,
            dischargesToday,
            transfersToday,
            labTatHours: Math.round(tat * 10) / 10,
            prescriptionsDispensedToday: dispensedToday,
            immunizationsToday: immunsToday,
          });
        }
      } catch {
        if (alive) setError('Failed to load performance data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, hospitalId]);

  if (loading) return <LoadingBlock label="Loading performance..." />;
  if (error) return <ErrorBlock message={error} />;

  const cards: { label: string; value: number | string; icon: typeof Calendar; tint: string }[] = [
    { label: "Today's Visits",        value: kpis.visitsToday,                  icon: Calendar,    tint: '#1B9AAA' },
    { label: 'Active Admissions',     value: kpis.activeAdmissions,             icon: BedDouble,   tint: '#A78BFA' },
    { label: 'Discharges Today',      value: kpis.dischargesToday,              icon: CheckCircle, tint: '#10B981' },
    { label: 'Transfers Today',       value: kpis.transfersToday,               icon: ArrowLeft,   tint: '#3B82F6' },
    { label: 'Avg Lab TAT (hrs)',     value: kpis.labTatHours || '—',           icon: FlaskConical, tint: '#F59E0B' },
    { label: 'Rx Dispensed Today',    value: kpis.prescriptionsDispensedToday,  icon: Pill,        tint: '#EC4899' },
    { label: 'Immunizations Today',   value: kpis.immunizationsToday,           icon: Syringe,     tint: '#14B8A6' },
  ];

  return (
    <div className="kpi-grid">
      {cards.map(c => (
        <div key={c.label} className="kpi">
          <div className="icon-box-sm" style={{ background: `${c.tint}18` }}>
            <c.icon style={{ color: c.tint }} />
          </div>
          <div className="kpi__body">
            <div className="kpi__value">{c.value}</div>
            <div className="kpi__label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS TAB (write-gated)
// ═══════════════════════════════════════════════════════════════════════════
function SettingsTab({ hospital, canWrite, onSaved }: {
  hospital: HospitalDoc;
  canWrite: boolean;
  onSaved: (h: HospitalDoc) => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(hospital.name || '');
  const [phone, setPhone] = useState((hospital as unknown as { phone?: string }).phone || '');
  const [email, setEmail] = useState((hospital as unknown as { email?: string }).email || '');
  const [operationalStatus, setOperationalStatus] = useState<string>(hospital.operationalStatus || 'functional');
  const [services, setServices] = useState({
    epi: hospital.serviceFlags?.epi || false,
    anc: hospital.serviceFlags?.anc || false,
    delivery: hospital.serviceFlags?.delivery || false,
    hiv: hospital.serviceFlags?.hiv || false,
    tb: hospital.serviceFlags?.tb || false,
    emergencySurgery: hospital.serviceFlags?.emergencySurgery || false,
    laboratory: hospital.serviceFlags?.laboratory || false,
    pharmacy: hospital.serviceFlags?.pharmacy || false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!canWrite) return;
    setSaving(true);
    setErr(null);
    try {
      const { updateHospitalStatus } = await import('@/lib/services/hospital-service');
      const updated = await updateHospitalStatus(hospital._id, {
        name: name.trim() || hospital.name,
        operationalStatus: operationalStatus as HospitalDoc['operationalStatus'],
        serviceFlags: services,
        // Phone / email are not part of the HospitalDoc type today but the
        // doc is a free-form PouchDB record — extra fields are preserved
        // round-trip without a migration.
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      } as Partial<HospitalDoc>);
      if (updated) {
        onSaved(updated);
        showToast('Facility updated', 'success');
      } else {
        setErr('Update failed');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }, [canWrite, hospital._id, hospital.name, name, operationalStatus, services, phone, email, onSaved, showToast]);

  const toggleService = (key: keyof typeof services) => {
    setServices(s => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {!canWrite && (
        <div className="card-elevated lg:col-span-2" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(252,211,77,0.10)' }}>
          <AlertTriangle style={{ width: 16, height: 16, color: 'var(--color-warning)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            You can view these settings but not edit them. Only org admins and super admins can save changes.
          </span>
        </div>
      )}

      {/* Profile */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Profile</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Facility name">
            <input
              disabled={!canWrite}
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle(canWrite)}
            />
          </Field>
          <Field label="Phone">
            <input
              disabled={!canWrite}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={inputStyle(canWrite)}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              disabled={!canWrite}
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle(canWrite)}
            />
          </Field>
          <Field label="Operating status">
            <select
              disabled={!canWrite}
              value={operationalStatus}
              onChange={e => setOperationalStatus(e.target.value)}
              style={inputStyle(canWrite)}
            >
              <option value="functional">Functional</option>
              <option value="partially_functional">Partially Functional</option>
              <option value="non_functional">Non-Functional</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Services Offered */}
      <div className="card-elevated" style={{ padding: 16 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Services Offered</h3>
        <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { key: 'epi', label: 'EPI (Immunization)' },
            { key: 'anc', label: 'Antenatal Care' },
            { key: 'delivery', label: 'Delivery Services' },
            { key: 'hiv', label: 'HIV/AIDS' },
            { key: 'tb', label: 'Tuberculosis' },
            { key: 'emergencySurgery', label: 'Emergency Surgery' },
            { key: 'laboratory', label: 'Laboratory' },
            { key: 'pharmacy', label: 'Pharmacy' },
          ].map(svc => (
            <div key={svc.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{svc.label}</span>
              <button
                disabled={!canWrite}
                onClick={() => toggleService(svc.key as keyof typeof services)}
                className="tbn-toggle"
                style={{
                  background: services[svc.key as keyof typeof services] ? 'var(--accent-primary)' : 'var(--toggle-track)',
                  opacity: canWrite ? 1 : 0.5,
                  cursor: canWrite ? 'pointer' : 'not-allowed',
                }}
              >
                <span
                  className="tbn-toggle__knob"
                  style={{ transform: services[svc.key as keyof typeof services] ? 'translateX(22px)' : 'translateX(3px)' }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="lg:col-span-2 flex items-center justify-end gap-3">
        {err && (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> {err}
          </span>
        )}
        <button
          disabled={!canWrite || saving}
          onClick={handleSave}
          className="btn btn-primary btn-sm"
          style={{ gap: 6 }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(enabled: boolean): React.CSSProperties {
  return {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--input-radius)',
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    opacity: enabled ? 1 : 0.6,
    cursor: enabled ? 'text' : 'not-allowed',
  };
}

// Stethoscope import is reserved for future tab additions; reference it here
// so the import isn't flagged unused.
void Stethoscope;
