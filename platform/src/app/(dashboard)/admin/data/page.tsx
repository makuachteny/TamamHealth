'use client';

/**
 * Super-admin → Data Governance.
 * MPI duplicate review, facility completeness, and validity scanning —
 * everything computed client-side from the real patient/hospital stores on
 * a single load. No fabricated counts: every number here is derived from
 * getAllPatients()/useHospitals() or the conflicts API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SaPage, SaCard, SaTable, SaPill } from '@/components/admin/sa-ui';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { getAllPatients } from '@/lib/services/patient-service';
import type { PatientDoc } from '@/lib/db-types';
import { ArrowRight, Copy, BarChart3, AlertTriangle, GitCompareArrows } from '@/components/icons/lucide';

const ROW_CAP = 50;

type SectionId = 'duplicates' | 'completeness' | 'invalid' | 'reconciliation';

function patientName(p: PatientDoc): string {
  const name = [p.firstName, p.surname].filter(Boolean).join(' ').trim();
  return name || p.hospitalNumber || p._id;
}

function normPhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 ? digits : null;
}

interface DupPair {
  a: PatientDoc;
  b: PatientDoc;
  basis: string;
}

export default function AdminDataGovernancePage() {
  const router = useRouter();
  const { hospitals, loading: hospitalsLoading } = useHospitals();

  const [patients, setPatients] = useState<PatientDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingConflicts, setPendingConflicts] = useState<number | null>(null);
  const [conflictsError, setConflictsError] = useState(false);

  // Section switching is in-page state only (URL never changes) — the page
  // bundles four distinct governance topics rather than one list.
  const [activeSection, setActiveSection] = useState<SectionId>('duplicates');

  const loadPatients = useCallback(async () => {
    try {
      const all = await getAllPatients();
      setPatients(all);
    } catch (err) {
      console.error('Failed to load patients for data governance', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConflicts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/conflicts?status=pending');
      if (!res.ok) { setConflictsError(true); return; }
      const body = await res.json();
      setPendingConflicts(Array.isArray(body.conflicts) ? body.conflicts.length : 0);
      setConflictsError(false);
    } catch {
      setConflictsError(true);
    }
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);
  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  const hospitalName = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hospitals) map.set(h._id, h.name);
    return map;
  }, [hospitals]);

  // ── Duplicate candidates: group by (surname+firstName+dob) OR identical phone ──
  const duplicates = useMemo<DupPair[]>(() => {
    const pairKeys = new Set<string>();
    const pairs: DupPair[] = [];

    const addGroupPairs = (group: PatientDoc[], basis: string) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = [group[i]._id, group[j]._id].sort().join('|');
          if (pairKeys.has(key)) continue;
          pairKeys.add(key);
          pairs.push({ a: group[i], b: group[j], basis });
        }
      }
    };

    const byNameDob = new Map<string, PatientDoc[]>();
    const byPhone = new Map<string, PatientDoc[]>();

    for (const p of patients) {
      const surname = (p.surname || '').trim().toLowerCase();
      const first = (p.firstName || '').trim().toLowerCase();
      const dob = (p.dateOfBirth || '').trim();
      if (surname && first && dob) {
        const key = `${surname}|${first}|${dob}`;
        const arr = byNameDob.get(key) || [];
        arr.push(p);
        byNameDob.set(key, arr);
      }
      const phone = normPhone(p.phone);
      if (phone) {
        const arr = byPhone.get(phone) || [];
        arr.push(p);
        byPhone.set(phone, arr);
      }
    }

    for (const group of byNameDob.values()) {
      if (group.length > 1) addGroupPairs(group, 'Name + DOB match');
    }
    for (const group of byPhone.values()) {
      if (group.length > 1) addGroupPairs(group, 'Same phone number');
    }

    return pairs;
  }, [patients]);

  // ── Missing / invalid value scan ──
  const validity = useMemo(() => {
    const now = Date.now();
    let missingDob = 0;
    let missingGender = 0;
    let missingPhone = 0;
    let futureDob = 0;
    let missingAny = 0;

    for (const p of patients) {
      let missing = false;
      if (!p.dateOfBirth) { missingDob++; missing = true; }
      else {
        const d = new Date(p.dateOfBirth).getTime();
        if (!Number.isNaN(d) && d > now) futureDob++;
      }
      if (p.gender !== 'Male' && p.gender !== 'Female') { missingGender++; missing = true; }
      if (!p.phone) { missingPhone++; missing = true; }
      if (missing) missingAny++;
    }

    return { missingDob, missingGender, missingPhone, futureDob, missingAny };
  }, [patients]);

  // ── Completeness by facility ──
  const completeness = useMemo(() => {
    const byHospital = new Map<string, PatientDoc[]>();
    for (const p of patients) {
      const hid = p.registrationHospital;
      if (!hid) continue;
      const arr = byHospital.get(hid) || [];
      arr.push(p);
      byHospital.set(hid, arr);
    }

    const rows = hospitals
      .map(h => {
        const list = byHospital.get(h._id) || [];
        const complete = list.filter(p => !!p.dateOfBirth && (p.gender === 'Male' || p.gender === 'Female') && !!p.phone).length;
        const score = list.length > 0 ? Math.round((complete / list.length) * 100) : null;
        return { hospitalId: h._id, name: h.name, total: list.length, complete, score };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100));

    const belowThreshold = rows.filter(r => r.score !== null && r.score < 80).length;
    return { rows, belowThreshold };
  }, [patients, hospitals]);

  const busy = loading || hospitalsLoading;

  const sections: { id: SectionId; label: string; icon: typeof Copy; count: number }[] = [
    { id: 'duplicates', label: 'Duplicate review', icon: Copy, count: duplicates.length },
    { id: 'completeness', label: 'Completeness', icon: BarChart3, count: completeness.rows.length },
    { id: 'invalid', label: 'Invalid values', icon: AlertTriangle, count: validity.missingAny },
    { id: 'reconciliation', label: 'Reconciliation', icon: GitCompareArrows, count: conflictsError ? 0 : pendingConflicts ?? 0 },
  ];

  return (
    <SaPage>
      <div className="saside-shell">
        <nav className="saside-nav" aria-label="Data governance sections">
          <span className="saside-nav-title">Data Governance</span>
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={`saside-nav-item${activeSection === s.id ? ' is-active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <Icon className="w-4 h-4" />
                <span>{s.label}</span>
                <b>{busy && s.id !== 'invalid' ? '…' : s.count}</b>
              </button>
            );
          })}
        </nav>

        <div className="saside-content">
          {activeSection === 'duplicates' && (
            <SaCard>
              <EhrListHeader
                title="Duplicate patient review (MPI)"
                stats={[
                  { label: 'Patients total', value: busy ? '…' : patients.length, color: LIST_STAT_COLORS.muted },
                  { label: 'Possible duplicates', value: busy ? '…' : duplicates.length, color: duplicates.length > 0 ? LIST_STAT_COLORS.amber : LIST_STAT_COLORS.muted },
                ]}
              />
              <SaTable
                columns={['Patient A', 'Patient B', 'Match basis', 'Facility']}
                empty={busy ? 'Loading…' : 'No duplicate candidates detected.'}
                minWidth={680}
              >
                {duplicates.slice(0, ROW_CAP).map(({ a, b, basis }) => {
                  const facA = (a.registrationHospital && hospitalName.get(a.registrationHospital)) || a.registrationHospital || '—';
                  const facB = (b.registrationHospital && hospitalName.get(b.registrationHospital)) || b.registrationHospital || '—';
                  return (
                    <tr key={`${a._id}|${b._id}`}>
                      <td><strong>{patientName(a)}</strong> <span style={{ color: 'var(--text-muted)' }}>{a.hospitalNumber}</span></td>
                      <td><strong>{patientName(b)}</strong> <span style={{ color: 'var(--text-muted)' }}>{b.hospitalNumber}</span></td>
                      <td>{basis}</td>
                      <td>{facA === facB ? facA : `${facA} / ${facB}`}</td>
                    </tr>
                  );
                })}
              </SaTable>
              {!busy && duplicates.length > ROW_CAP && (
                <p className="sa-card-meta" style={{ padding: '10px 14px', margin: 0, borderTop: '1px solid var(--border-light)' }}>
                  Showing first {ROW_CAP} of {duplicates.length}.
                </p>
              )}
            </SaCard>
          )}

          {activeSection === 'completeness' && (
            <SaCard>
              <EhrListHeader
                title="Data completeness by facility"
                stats={[{ label: 'Facilities below 80% completeness', value: busy ? '…' : completeness.belowThreshold, color: completeness.belowThreshold > 0 ? 'var(--color-danger)' : LIST_STAT_COLORS.muted }]}
              />
              <SaTable
                columns={['Facility', 'Patients', 'Complete', 'Score']}
                empty={busy ? 'Loading…' : 'No facilities with registered patients yet.'}
                minWidth={520}
              >
                {completeness.rows.slice(0, ROW_CAP).map(r => (
                  <tr key={r.hospitalId}>
                    <td><strong>{r.name}</strong></td>
                    <td className="sa-num">{r.total}</td>
                    <td className="sa-num">{r.complete}</td>
                    <td className="sa-num">
                      <SaPill tone={r.score! >= 90 ? 'ok' : r.score! >= 70 ? 'warn' : 'danger'}>{r.score}%</SaPill>
                    </td>
                  </tr>
                ))}
              </SaTable>
            </SaCard>
          )}

          {activeSection === 'invalid' && (
            <SaCard title="Invalid & missing values" meta={busy ? undefined : `${patients.length} records scanned · ${validity.missingAny} with missing/invalid fields`}>
              <div className="sa-kv">
                <div className="sa-kv-row"><span>Missing date of birth</span><span>{busy ? '—' : validity.missingDob}</span></div>
                <div className="sa-kv-row"><span>Missing gender</span><span>{busy ? '—' : validity.missingGender}</span></div>
                <div className="sa-kv-row"><span>Missing phone</span><span>{busy ? '—' : validity.missingPhone}</span></div>
                <div className="sa-kv-row"><span>Future date of birth</span><span>{busy ? '—' : validity.futureDob}</span></div>
              </div>
            </SaCard>
          )}

          {activeSection === 'reconciliation' && (
            <SaCard title="Reconciliation & requests">
              <div className="sa-kv">
                <div className="sa-kv-row">
                  <span>Pending sync conflicts</span>
                  <span>{conflictsError ? '—' : pendingConflicts ?? '…'}</span>
                </div>
              </div>
              <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="sa-btn primary" onClick={() => router.push('/admin/conflicts')}>
                  Open reconciliation queue
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="sa-kv">
                <div className="sa-kv-row">
                  <span>Export / deletion requests</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 600 }}>None — policy-gated, no request store configured</span>
                </div>
              </div>
              <div style={{ padding: '0 14px 14px' }}>
                <button type="button" className="sa-btn" onClick={() => router.push('/admin/security')}>
                  Review data policy
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </SaCard>
          )}
        </div>
      </div>

      <style jsx>{`
        .saside-shell {
          display: flex;
          gap: 14px;
        }
        .saside-nav {
          display: flex;
          flex-direction: column;
          flex: 0 0 220px;
          min-width: 0;
          gap: 2px;
          padding: 8px;
          border: 1px solid var(--ehr-border);
          border-radius: 12px;
          background: #fff;
          align-self: flex-start;
        }
        .saside-nav-title {
          padding: 6px 10px 4px;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .saside-nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .saside-nav-item:hover {
          background: var(--overlay-subtle, rgba(0, 0, 0, 0.04));
        }
        .saside-nav-item.is-active {
          background: var(--accent-primary);
          color: #fff;
        }
        .saside-nav-item span {
          flex: 1;
          min-width: 0;
        }
        .saside-nav-item b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.08);
          font-size: 10px;
          font-weight: 800;
        }
        .saside-nav-item.is-active b {
          background: rgba(255, 255, 255, 0.22);
        }
        .saside-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          gap: 14px;
        }
        @media (max-width: 860px) {
          .saside-shell {
            flex-direction: column;
          }
          .saside-nav {
            flex-direction: row;
            flex: 0 0 auto;
            overflow-x: auto;
          }
          .saside-nav-title {
            display: none;
          }
          .saside-nav-item {
            flex: 0 0 auto;
            white-space: nowrap;
          }
        }
      `}</style>
    </SaPage>
  );
}
