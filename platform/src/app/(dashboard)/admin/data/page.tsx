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
import { SaPage, SaCard, SaStat, SaPill, SaTable } from '@/components/admin/sa-ui';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { getAllPatients } from '@/lib/services/patient-service';
import type { PatientDoc } from '@/lib/db-types';
import { ArrowRight } from '@/components/icons/lucide';

const ROW_CAP = 50;

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

  return (
    <SaPage title="Data Governance" subtitle="Master patient index review, facility data completeness, and validity scanning across the local patient store.">
      <div className="sa-stat-strip">
        <SaStat label="Patients total" value={busy ? '—' : patients.length} />
        <SaStat label="Possible duplicates" value={busy ? '—' : duplicates.length} tone={duplicates.length > 0 ? 'warn' : 'ok'} />
        <SaStat label="Missing required fields" value={busy ? '—' : validity.missingAny} tone={validity.missingAny > 0 ? 'warn' : 'ok'} />
        <SaStat label="Pending conflicts" value={conflictsError ? '—' : pendingConflicts ?? '…'} tone={pendingConflicts && pendingConflicts > 0 ? 'warn' : 'ok'} />
        <SaStat label="Facilities below 80% completeness" value={busy ? '—' : completeness.belowThreshold} tone={completeness.belowThreshold > 0 ? 'danger' : 'ok'} />
      </div>

      <SaCard
        title="Duplicate patient review (MPI)"
        meta={busy ? undefined : `${Math.min(duplicates.length, ROW_CAP)} shown${duplicates.length > ROW_CAP ? ` of ${duplicates.length} (showing first ${ROW_CAP})` : ''}`}
      >
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
      </SaCard>

      <SaCard
        title="Data completeness by facility"
        meta={busy ? undefined : `${Math.min(completeness.rows.length, ROW_CAP)} facilities`}
      >
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

      <SaCard title="Invalid & missing values" meta={busy ? undefined : `${patients.length} records scanned`}>
        <div className="sa-kv">
          <div className="sa-kv-row"><span>Missing date of birth</span><span>{busy ? '—' : validity.missingDob}</span></div>
          <div className="sa-kv-row"><span>Missing gender</span><span>{busy ? '—' : validity.missingGender}</span></div>
          <div className="sa-kv-row"><span>Missing phone</span><span>{busy ? '—' : validity.missingPhone}</span></div>
          <div className="sa-kv-row"><span>Future date of birth</span><span>{busy ? '—' : validity.futureDob}</span></div>
        </div>
      </SaCard>

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
    </SaPage>
  );
}
