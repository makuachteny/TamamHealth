'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign, Shield, CreditCard, AlertTriangle,
  ChevronRight, Clock, CheckCircle, Wallet, Building2,
} from '@/components/icons/lucide';
import { getMethodConfig } from '@/lib/payment-method-config';
import type { PaymentDoc, PaymentPlanDoc, ClaimDoc, InsurancePolicyDoc } from '@/lib/db-types-payments';

interface BillingSidebarCardProps {
  patientId: string;
  onPayClick?: () => void;
  onViewBilling?: () => void;
}

interface BillingSnapshot {
  balance: number;
  hasInsurance: boolean;
  primaryPayer: string | null;
  payerType: string | null;
  eligibilityStatus: string;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  lastPaymentMethod: string | null;
  activePlanCount: number;
  activePlanBalance: number;
  pendingClaimsCount: number;
}

export default function BillingSidebarCard({ patientId, onPayClick, onViewBilling }: BillingSidebarCardProps) {
  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [paymentSvc, ledgerSvc] = await Promise.all([
          import('@/lib/services/payment-service'),
          import('@/lib/services/ledger-service'),
        ]);

        const [balance, policies, payments, plans, claims] = await Promise.all([
          ledgerSvc.getPatientBalance(patientId),
          paymentSvc.getPatientInsurancePolicies(patientId),
          paymentSvc.getPaymentsByPatient(patientId),
          paymentSvc.getPaymentPlansByPatient(patientId),
          paymentSvc.getClaimsByPatient?.(patientId).catch(() => [] as ClaimDoc[]) ?? Promise.resolve([] as ClaimDoc[]),
        ]);

        const primary = policies.find((p: InsurancePolicyDoc) => p.isPrimary) || policies[0];
        const latestPayment = payments
          .filter((p: PaymentDoc) => p.status === 'posted')
          .sort((a: PaymentDoc, b: PaymentDoc) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())[0];
        const activePlans = plans.filter((p: PaymentPlanDoc) => p.status === 'active');
        const pendingClaims = claims.filter((c: ClaimDoc) => c.status === 'submitted' || c.status === 'draft');

        // Try to get eligibility
        let eligStatus = 'none';
        try {
          const elig = await paymentSvc.getLatestEligibility(patientId);
          if (elig) eligStatus = elig.status;
        } catch { /* ok */ }

        setData({
          balance: Math.max(0, balance),
          hasInsurance: policies.length > 0,
          primaryPayer: primary?.payerName || null,
          payerType: primary?.payerType || null,
          eligibilityStatus: eligStatus,
          lastPaymentAmount: latestPayment?.amount || null,
          lastPaymentDate: latestPayment?.processedAt || null,
          lastPaymentMethod: latestPayment?.method || null,
          activePlanCount: activePlans.length,
          activePlanBalance: activePlans.reduce((s: number, p: PaymentPlanDoc) => s + p.remainingBalance, 0),
          pendingClaimsCount: pendingClaims.length,
        });
      } catch (err) {
        console.error('BillingSidebarCard load error:', err);
        setData({
          balance: 0, hasInsurance: false, primaryPayer: null, payerType: null,
          eligibilityStatus: 'none', lastPaymentAmount: null, lastPaymentDate: null,
          lastPaymentMethod: null, activePlanCount: 0, activePlanBalance: 0, pendingClaimsCount: 0,
        });
      }
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="card-elevated">
        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
          <Wallet className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="font-semibold text-sm">Billing</h3>
        </div>
        <div className="p-5 text-center">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  const d = data!;
  const hasBalance = d.balance > 0;
  const fmt = (n: number) => `SSP ${n.toLocaleString()}`;

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="font-semibold text-sm">Billing & Payments</h3>
        </div>
        {onViewBilling && (
          <button
            onClick={onViewBilling}
            className="text-[11px] font-medium flex items-center gap-0.5 transition-colors"
            style={{ color: 'var(--accent-primary)' }}
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Balance Section — tinted hero tile, alarming if outstanding */}
      <div className="px-5 py-4" style={{
        background: hasBalance
          ? 'linear-gradient(135deg, rgba(196, 69, 54, 0.08) 0%, rgba(228, 168, 75, 0.06) 100%)'
          : 'linear-gradient(135deg, rgba(27, 158, 119, 0.08) 0%, rgba(27, 154, 170, 0.04) 100%)',
        borderBottom: '1px solid var(--border-light)',
        position: 'relative',
      }}>
        {hasBalance && <span className="data-tile__alarm-pulse" aria-hidden="true" />}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{
              color: hasBalance ? '#8B2E24' : '#15795C',
            }}>
              {hasBalance ? 'Outstanding Balance' : 'Account Status'}
            </div>
            <div className="text-2xl font-extrabold" style={{
              letterSpacing: -0.5,
              color: hasBalance ? '#8B2E24' : '#15795C',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {hasBalance ? fmt(d.balance) : 'Paid in Full'}
            </div>
            {hasBalance && (
              <div className="text-[11px] mt-1" style={{ color: '#8B2E24', opacity: 0.7 }}>
                Plan active · collect at checkout
              </div>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{
            background: hasBalance ? 'rgba(196, 69, 54, 0.15)' : 'rgba(27, 158, 119, 0.15)',
            border: `1px solid ${hasBalance ? 'rgba(196, 69, 54, 0.3)' : 'rgba(27, 158, 119, 0.3)'}`,
            flexShrink: 0,
          }}>
            {hasBalance
              ? <AlertTriangle size={56} style={{ color: '#C44536' }} />
              : <CheckCircle size={56} style={{ color: '#15795C' }} />
            }
          </div>
        </div>
        {hasBalance && onPayClick && (
          <button
            onClick={onPayClick}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #1B9AAA, #1E4D4A)',
              boxShadow: '0 2px 8px rgba(27, 154, 170,0.3)',
            }}
          >
            <CreditCard size={14} /> Collect Payment
          </button>
        )}
      </div>

      {/* Details — single stacked list with 1px inner dividers */}
      <div>
        {/* Insurance */}
        <div className="data-row">
          <div className="data-row__icon" style={d.hasInsurance ? { background: 'rgba(27, 154, 170, 0.12)', color: '#1B9AAA' } : undefined}>
            <Shield size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="data-row__label">Insurance</div>
            {d.hasInsurance ? (
              <>
                <div className="data-row__value truncate">{d.primaryPayer}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{d.payerType}</span>
                  {d.eligibilityStatus !== 'none' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                      background: d.eligibilityStatus === 'verified' ? 'rgba(27,158,119,0.16)' : d.eligibilityStatus === 'expired' ? 'rgba(196,69,54,0.16)' : 'rgba(228,168,75,0.18)',
                      color: d.eligibilityStatus === 'verified' ? '#15795C' : d.eligibilityStatus === 'expired' ? '#8B2E24' : '#B8741C',
                    }}>
                      {d.eligibilityStatus.toUpperCase()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Self-pay &mdash; No insurance on file</div>
            )}
          </div>
        </div>

        {/* Last Payment */}
        <div className="data-row" style={d.lastPaymentAmount ? { background: 'rgba(27, 158, 119, 0.04)' } : undefined}>
          <div className="data-row__icon" style={d.lastPaymentAmount ? { background: 'rgba(27, 158, 119, 0.14)', color: '#15795C' } : { background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
            <DollarSign size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="data-row__label">Last Payment</div>
            {d.lastPaymentAmount ? (
              <>
                <div className="data-row__value">{fmt(d.lastPaymentAmount)}</div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {d.lastPaymentMethod && (() => {
                    const mc = getMethodConfig(d.lastPaymentMethod);
                    const MIcon = mc.icon;
                    return (
                      <span className="flex items-center gap-1">
                        <MIcon size={10} style={{ color: mc.color }} />
                        {mc.shortLabel}
                      </span>
                    );
                  })()}
                  <span>&middot;</span>
                  <span>{new Date(d.lastPaymentDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              </>
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No payments recorded</div>
            )}
          </div>
        </div>

        {/* Active Plans */}
        {d.activePlanCount > 0 && (
          <div className="data-row data-row--warning">
            <div className="data-row__icon">
              <Clock size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="data-row__label">Payment Plan</div>
              <div className="data-row__value">{d.activePlanCount} active &middot; {fmt(d.activePlanBalance)} remaining</div>
            </div>
          </div>
        )}

        {/* Pending Claims */}
        {d.pendingClaimsCount > 0 && (
          <div className="data-row">
            <div className="data-row__icon" style={{ background: 'rgba(27, 154, 170, 0.12)', color: '#1B9AAA' }}>
              <Building2 size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="data-row__label">Pending Claims</div>
              <div className="data-row__value">{d.pendingClaimsCount} claim{d.pendingClaimsCount > 1 ? 's' : ''} awaiting adjudication</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
