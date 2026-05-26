'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Edit3, Building2 } from '@/components/icons/lucide';
import EligibilityBadge from './EligibilityBadge';

interface InsuranceSnapshotProps {
  patientId: string;
  editable?: boolean;
  onAddInsurance?: () => void;
  onEditInsurance?: (policyId: string) => void;
}

interface Policy {
  _id: string;
  payerType: string;
  payerName: string;
  memberId?: string;
  groupNumber?: string;
  isPrimary: boolean;
  effectiveDate: string;
  terminationDate?: string;
  copayAmount?: number;
  coinsurancePct?: number;
  donorCoverageType?: string;
}

export default function InsuranceSnapshot({ patientId, editable, onAddInsurance, onEditInsurance }: InsuranceSnapshotProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [eligStatus, setEligStatus] = useState<'verified' | 'unverified' | 'expired' | 'denied' | 'cached' | 'none'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { getPatientInsurancePolicies, getLatestEligibility } = await import('@/lib/services/payment-service');
        const [pols, elig] = await Promise.all([
          getPatientInsurancePolicies(patientId),
          getLatestEligibility(patientId),
        ]);
        setPolicies(pols);
        setEligStatus(elig?.status || 'none');
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>Loading insurance...</div>;
  }

  if (policies.length === 0) {
    return (
      <div style={{
        padding: 16, borderRadius: 12,
        border: '1px dashed var(--border-medium)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <span className="icon-box-sm" style={{ color: 'var(--teal, #14b8a6)' }}>
            <Shield size={16} />
          </span>
          No insurance on file — Self-pay
        </div>
        {editable && onAddInsurance && (
          <button onClick={onAddInsurance} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 16, border: '1px solid var(--accent)',
            background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={12} /> Add Insurance
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {policies.map(policy => (
        <div key={policy._id} style={{
          padding: '12px 16px', borderRadius: 12,
          background: 'var(--bg-card)',
          border: `1px solid ${policy.isPrimary ? 'var(--accent)' : 'var(--border-medium)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span className="icon-box-sm" style={{ color: 'var(--teal, #14b8a6)', flexShrink: 0 }}>
            <Building2 size={44} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{policy.payerName}</span>
              {policy.isPrimary && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary</span>
              )}
              <EligibilityBadge status={eligStatus} compact />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {policy.memberId && <span>ID: {policy.memberId}</span>}
              {policy.copayAmount != null && <span>Copay: ${policy.copayAmount}</span>}
              {policy.coinsurancePct != null && <span>Coinsurance: {policy.coinsurancePct}%</span>}
              {policy.donorCoverageType && <span>Coverage: {policy.donorCoverageType}</span>}
              <span>Eff: {policy.effectiveDate}</span>
            </div>
          </div>
          {editable && onEditInsurance && (
            <button onClick={() => onEditInsurance(policy._id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
            }}>
              <Edit3 size={14} />
            </button>
          )}
        </div>
      ))}

      <hr className="section-divider" />

      {editable && onAddInsurance && (
        <button onClick={onAddInsurance} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: '8px 0', borderRadius: 12, border: '1px dashed var(--border-medium)',
          background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
        }}>
          <Plus size={12} /> Add Another Plan
        </button>
      )}
    </div>
  );
}
