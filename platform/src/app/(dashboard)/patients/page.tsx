'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { Search, Filter, ChevronRight, UserPlus, Users, ScanLine, Hash, X, ArrowRight } from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { states } from '@/data/mock';
import QRScanner from '@/components/QRScanner';

// Pagination cap — capped to keep DOM-node count manageable on low-end devices.
// Each row produces ~20 DOM nodes; 100 rows ≈ 2k nodes which renders smoothly.
// At 10k+ patients we render in pages instead of dumping the whole list.
const PAGE_SIZE = 100;

export default function PatientsPage() {
  const router = useRouter();
  const { globalSearch } = useApp();
  const { patients } = usePatients();
  const { canRegisterPatients } = usePermissions();
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showFindPatient, setShowFindPatient] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupError, setLookupError] = useState('');
  // Cap how many rows are rendered at once. "Load more" extends the window
  // by another PAGE_SIZE; switching filter/search resets the window.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handleLookup = () => {
    const q = lookupId.trim().toLowerCase();
    if (!q) { setLookupError('Enter a Hospital Number or Geocode ID'); return; }
    const match = patients.find(p =>
      p.hospitalNumber?.toLowerCase() === q ||
      p.geocodeId?.toLowerCase() === q ||
      p.nationalId?.toLowerCase() === q ||
      p._id?.toLowerCase() === q
    );
    if (match) {
      setShowFindPatient(false);
      setLookupId('');
      setLookupError('');
      router.push(`/patients/${match._id}`);
    } else {
      setLookupError(`No patient found with ID "${lookupId.trim()}"`);
    }
  };

  const filtered = patients.filter(p => {
    const q = search || globalSearch;
    const matchSearch = !q ||
      `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q.toLowerCase()) ||
      (p.hospitalNumber || '').toLowerCase().includes(q.toLowerCase()) ||
      (p.phone || '').includes(q);
    const matchState = !filterState || p.state === filterState;
    const matchGender = !filterGender || p.gender === filterGender;
    return matchSearch && matchState && matchGender;
  });

  // Reset the visible window whenever the filter or search changes — otherwise
  // narrowing the result set would leave the user looking at a stale "Load more"
  // count that doesn't correspond to the new filtered.length.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterState, filterGender, globalSearch]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  return (
    <>
      <TopBar title="Patients" />
      <main className="page-container page-enter">
          <PageHeader
            icon={Users}
            title="Patient Registry"
            subtitle={`${filtered.length} patients found`}
            actions={
              <div className="flex gap-2">
                <button onClick={() => setShowFindPatient(true)} className="btn btn-secondary">
                  <Hash className="w-4 h-4" />
                  Find Patient
                </button>
                {canRegisterPatients && (
                  <button onClick={() => router.push('/patients/new')} className="btn btn-primary">
                    <UserPlus className="w-4 h-4" />
                    Register New Patient
                  </button>
                )}
              </div>
            }
          />

          {/* Summary KPI strip */}
          {(() => {
            const now = Date.now();
            const MS30 = 30 * 24 * 60 * 60 * 1000;
            const visitedRecently = patients.filter(p => p.lastConsultedAt && (now - new Date(p.lastConsultedAt).getTime()) < MS30).length;
            const withConditions = patients.filter(p => p.chronicConditions?.length && p.chronicConditions[0] !== 'None').length;
            const withAllergies = patients.filter(p => p.allergies?.length && p.allergies[0] !== 'None known').length;
            const kpis = [
              { label: 'Total Patients', value: patients.length, accent: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.08)', border: 'rgba(27, 154, 170, 0.22)' },
              { label: 'Visited · last 30d', value: visitedRecently, accent: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.08)', border: 'rgba(27, 154, 170, 0.22)' },
              { label: 'Chronic Conditions', value: withConditions, accent: '#B8741C', bg: 'rgba(228, 168, 75, 0.10)', border: 'rgba(228, 168, 75, 0.28)' },
              { label: 'Allergies Flagged', value: withAllergies, accent: '#C44536', bg: 'rgba(196, 69, 54, 0.08)', border: 'rgba(196, 69, 54, 0.28)' },
            ];
            return (
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'stretch' }}>
                {kpis.map(k => (
                  <div key={k.label} style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: k.bg, border: `1px solid ${k.border}`,
                    height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>
                      {k.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Search & Filter */}
          <div className="dash-card p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  placeholder="Search by name, hospital number, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 search-icon-input"
                  style={{ background: 'var(--overlay-subtle)' }}
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm">
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <div className="w-full sm:w-48">
                  <label>State</label>
                  <select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                    <option value="">All States</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-36">
                  <label>Gender</label>
                  <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                    <option value="">All</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilterState(''); setFilterGender(''); }} className="btn btn-secondary btn-sm">
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Patient Table */}
          <div className="dash-card overflow-hidden">
            <div className="patient-table-wrap">
              <table className="data-table patient-table">
                <thead>
                  <tr>
                    <th className="col-patient">Patient</th>
                    <th className="col-hospital">Hospital No.</th>
                    <th className="col-age">Age / Gender</th>
                    <th className="col-state">State</th>
                    <th className="col-phone hide-mobile">Phone</th>
                    <th className="col-visit hide-mobile">Last Visit</th>
                    <th className="col-cond hide-mobile">Conditions</th>
                    <th className="col-arrow"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(patient => {
                    const age = patient.estimatedAge || (patient.dateOfBirth ? (new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0);
                    const isFemale = patient.gender === 'Female';
                    const initials = `${(patient.firstName || '?')[0]}${(patient.surname || '?')[0]}`.toUpperCase();
                    const hasAllergy = patient.allergies?.length && patient.allergies[0] !== 'None known';
                    const chronic = (patient.chronicConditions || []).filter(c => c && c !== 'None');
                    const hasChronic = chronic.length > 0;
                    const lastVisit = patient.lastConsultedAt
                      ? new Date(patient.lastConsultedAt)
                      : null;
                    const daysAgo = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / 86400000) : null;
                    // Data-freshness indicator: how long ago was this record's data last
                    // touched (locally or via sync replication)? Offline edits bump
                    // updatedAt instantly; replicated changes arrive with the origin
                    // updatedAt intact, so this is a real "data vintage" signal.
                    const updatedAt = patient.updatedAt ? new Date(patient.updatedAt) : null;
                    const updatedMinsAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null;
                    const freshnessLabel = updatedMinsAgo == null
                      ? '—'
                      : updatedMinsAgo < 2 ? 'just now'
                      : updatedMinsAgo < 60 ? `${updatedMinsAgo}m ago`
                      : updatedMinsAgo < 1440 ? `${Math.floor(updatedMinsAgo / 60)}h ago`
                      : `${Math.floor(updatedMinsAgo / 1440)}d ago`;
                    const isStale = updatedMinsAgo != null && updatedMinsAgo > 60 * 24 * 30; // >30d
                    const isVeryStale = updatedMinsAgo != null && updatedMinsAgo > 60 * 24 * 90; // >90d
                    return (
                      <tr key={patient._id} className="cursor-pointer" onClick={() => router.push(`/patients/${patient._id}`)}>
                        <td className="col-patient">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                              style={{
                                background: isFemale
                                  ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)'
                                  : 'linear-gradient(135deg, #1B9AAA 0%, #1A3A3A 100%)',
                                letterSpacing: 0.3,
                              }}
                              aria-hidden
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {patient.firstName} {patient.surname}
                              </p>
                              <p className="text-[11px] truncate flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                <span>{patient.tribe || '—'}</span>
                                <span
                                  aria-hidden
                                  className="w-1 h-1 rounded-full flex-shrink-0"
                                  style={{ background: 'var(--border-medium)' }}
                                />
                                <span
                                  title={`Last updated ${patient.updatedAt || 'unknown'}`}
                                  style={{
                                    fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
                                    color: isVeryStale ? '#C44536' : isStale ? '#B8741C' : 'var(--text-muted)',
                                  }}
                                >
                                  {freshnessLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="col-hospital">
                          <span
                            className="font-mono text-[11px] whitespace-nowrap px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(27, 154, 170, 0.10)', color: '#1B9AAA', border: '1px solid rgba(27, 154, 170, 0.20)', fontWeight: 600 }}
                          >
                            {patient.hospitalNumber}
                          </span>
                        </td>
                        <td className="col-age whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                            <span
                              aria-hidden
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: isFemale ? '#D96E59' : '#1B9AAA' }}
                            />
                            <span className="font-semibold">{age}y</span>
                            <span style={{ color: 'var(--text-muted)' }}>· {patient.gender?.[0] ?? '?'}</span>
                          </span>
                        </td>
                        <td className="col-state text-xs" style={{ color: 'var(--text-secondary)' }}>{patient.state || '—'}</td>
                        <td className="col-phone hide-mobile font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{patient.phone || '—'}</td>
                        <td className="col-visit hide-mobile text-xs">
                          {lastVisit ? (
                            <div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {lastVisit.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              {daysAgo != null && (
                                <div className="text-[10px]" style={{ color: daysAgo > 90 ? '#C44536' : daysAgo > 30 ? '#B8741C' : 'var(--text-muted)' }}>
                                  {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>{patient.lastVisitDate || '—'}</span>
                          )}
                        </td>
                        <td className="col-cond hide-mobile">
                          <div className="flex flex-wrap items-center gap-1">
                            {hasAllergy && (
                              <span
                                className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{ background: 'rgba(196, 69, 54, 0.14)', color: '#8B2E24', border: '1px solid rgba(196, 69, 54, 0.30)' }}
                                title={`Allergy: ${patient.allergies.join(', ')}`}
                              >
                                ⚠ Allergy
                              </span>
                            )}
                            {hasChronic ? (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{ background: 'rgba(228, 168, 75, 0.14)', color: '#B8741C', border: '1px solid rgba(228, 168, 75, 0.30)' }}
                                title={chronic.join(', ')}
                              >
                                {chronic[0]}{chronic.length > 1 ? ` +${chronic.length - 1}` : ''}
                              </span>
                            ) : !hasAllergy ? (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="col-arrow"><ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} patients
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
      </main>

      {/* Find Patient Modal — Hospital ID lookup + QR scan */}
      {showFindPatient && !showQRScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg, var(--bg-card))' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-semibold">Find Patient</h3>
              <button onClick={() => { setShowFindPatient(false); setLookupId(''); setLookupError(''); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Hospital ID / Geocode ID Lookup */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Enter Hospital Number, Geocode ID, or National ID
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={lookupId}
                      onChange={(e) => { setLookupId(e.target.value); setLookupError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                      placeholder="e.g. JTH-0001 or BOMA-XY-HH1001"
                      className="pl-9 w-full"
                      autoFocus
                      style={{ background: 'var(--overlay-subtle)' }}
                    />
                  </div>
                  <button onClick={handleLookup} className="btn btn-primary btn-sm px-4">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {lookupError && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-danger)' }}>{lookupError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
              </div>

              {/* QR Code Scan Option */}
              <button
                onClick={() => setShowQRScanner(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--accent-light)]"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                  <ScanLine className="w-5 h-5" style={{ color: 'var(--tamamhealth-blue)' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Scan QR Code</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Use device camera to scan patient QR code</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRScanner && (
        <QRScanner
          onScan={(data) => {
            setShowQRScanner(false);
            setShowFindPatient(false);
            router.push(`/patients/${data.id}`);
          }}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </>
  );
}
