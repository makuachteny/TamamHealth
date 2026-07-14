'use client';

import { useState, useEffect } from 'react';
import { X, Banknote, Smartphone, CreditCard, Building2, Shield, CheckCircle2, Loader2, Printer, Mail } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { PAYOR_LABELS, type PaymentMethodKey } from '@/lib/settings/facility-settings';
import Modal from '@/components/Modal';
import { formatMoney } from '@/lib/format-utils';
import type { PaymentDoc } from '@/lib/db-types-payments';
import type { FeeScheduleDoc } from '@/lib/db-types-billing';

interface PaymentPanelProps {
  patientId: string;
  patientName: string;
  encounterId?: string;
  amountDue: number;
  currency?: string;
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
}

type TabType = 'cash' | 'mobile' | 'card' | 'bank' | 'insurance';

export default function PaymentPanel({
  patientId, patientName, encounterId, amountDue, currency = 'SSP', onSuccess, onCancel
}: PaymentPanelProps) {
  const { currentUser } = useApp();
  const { t } = useTranslation();
  const settings = useSettings();
  const [tab, setTab] = useState<TabType>('cash');
  const [amount, setAmount] = useState(amountDue > 0 ? amountDue.toString() : '');

  // Self-load balance if amountDue wasn't provided
  useEffect(() => {
    if (amountDue > 0) return;
    (async () => {
      try {
        const { getPatientBalance } = await import('@/lib/services/ledger-service');
        const bal = await getPatientBalance(patientId);
        if (bal > 0) setAmount(bal.toString());
      } catch { /* offline fallback */ }
    })();
  }, [patientId, amountDue]);

  // Service price catalog — lets the cashier pick a catalogued service to
  // populate the amount, so charges reflect real pricing instead of 0.
  const [fees, setFees] = useState<FeeScheduleDoc[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { getActiveFees } = await import('@/lib/services/fee-schedule-service');
        const scope = currentUser
          ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role }
          : undefined;
        setFees(await getActiveFees(scope));
      } catch { /* offline — catalog optional */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [paymentDoc, setPaymentDoc] = useState<PaymentDoc | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Cash fields
  const [receiptNumber, setReceiptNumber] = useState('');

  // Mobile Money fields
  const [mobileProvider, setMobileProvider] = useState<'mpesa' | 'airtel' | 'mtn_momo'>('mpesa');
  const [phone, setPhone] = useState('');
  const [mobileReference, setMobileReference] = useState('');

  // Card fields
  const [cardLast4, setCardLast4] = useState('');
  const [authCode, setAuthCode] = useState('');

  // Bank Transfer fields
  const [bankName, setBankName] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [transferDate, setTransferDate] = useState('');

  // Insurance / Waiver fields
  const [insuranceWaiverMode, setInsuranceWaiverMode] = useState<'insurance' | 'waiver'>('insurance');
  const [payerName, setPayerName] = useState('');
  const [claimReference, setClaimReference] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');

  // Concrete payment methods are gated by the facility's enabled methods
  // (set in Facility Settings). The insurance/waiver path is always available
  // since it's a payor/exemption flow, not a tender type.
  const tabMethod: Record<TabType, PaymentMethodKey | null> = {
    cash: 'cash', mobile: 'mobile_money', card: 'card', bank: 'bank_transfer', insurance: null,
  };
  const allTabs: { key: TabType; label: string; icon: typeof Banknote }[] = [
    { key: 'cash', label: t('payments.methodCash'), icon: Banknote },
    { key: 'mobile', label: t('payments.methodMobileMoney'), icon: Smartphone },
    { key: 'card', label: t('payments.methodCard'), icon: CreditCard },
    { key: 'bank', label: t('payments.methodBankTransfer'), icon: Building2 },
    { key: 'insurance', label: t('payments.methodInsuranceWaiver'), icon: Shield },
  ];
  const tabs = allTabs.filter(tb => {
    const m = tabMethod[tb.key];
    return m === null || settings.paymentMethods.includes(m);
  });
  // If the active tab was disabled in settings, fall back to the first enabled.
  useEffect(() => {
    if (tabs.length && !tabs.some(tb => tb.key === tab)) setTab(tabs[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.paymentMethods]);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t('payments.errorValidAmount'));
      return;
    }

    // Validate tab-specific required fields
    if (tab === 'mobile' && !phone) {
      setError(t('payments.errorPhoneRequired'));
      return;
    }
    if (tab === 'mobile' && !mobileReference) {
      setError(t('payments.errorTransactionRefRequired'));
      return;
    }
    if (tab === 'card' && !cardLast4) {
      setError(t('payments.errorLast4Required'));
      return;
    }
    if (tab === 'bank' && !bankName) {
      setError(t('payments.errorBankNameRequired'));
      return;
    }
    if (tab === 'bank' && !transferReference) {
      setError(t('payments.errorTransferRefRequired'));
      return;
    }
    if (tab === 'bank' && !transferDate) {
      setError(t('payments.errorTransferDateRequired'));
      return;
    }
    if (tab === 'insurance' && !payerName) {
      setError(t('payments.errorPayerNameRequired'));
      return;
    }
    if (tab === 'insurance' && !claimReference) {
      setError(t('payments.errorClaimRefRequired'));
      return;
    }
    if (tab === 'insurance' && insuranceWaiverMode === 'waiver' && !waiverReason) {
      setError(t('payments.errorWaiverReasonRequired'));
      return;
    }
    if (tab === 'insurance' && insuranceWaiverMode === 'waiver' && !approvedBy) {
      setError(t('payments.errorApprovedByRequired'));
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const { collectPayment } = await import('@/lib/services/payment-service');

      // Determine method and reference based on tab
      let method: 'cash' | 'mpesa' | 'airtel' | 'mtn_momo' | 'card' | 'bank_transfer' | 'waiver' | 'insurance';
      let reference: string | undefined;
      let mobileMoneyPhone: string | undefined;
      let cardLast4Digits: string | undefined;

      if (tab === 'cash') {
        method = 'cash';
        reference = receiptNumber || undefined;
      } else if (tab === 'mobile') {
        method = mobileProvider;
        reference = mobileReference;
        mobileMoneyPhone = phone;
      } else if (tab === 'card') {
        method = 'card';
        reference = authCode;
        cardLast4Digits = cardLast4;
      } else if (tab === 'bank') {
        method = 'bank_transfer';
        reference = `${bankName}:${transferReference}:${transferDate}`;
      } else {
        // Insurance/Waiver
        method = insuranceWaiverMode === 'insurance' ? 'insurance' : 'waiver';
        reference = insuranceWaiverMode === 'insurance' ? claimReference : waiverReason;
      }

      const pmt = await collectPayment({
        patientId,
        patientName,
        encounterId,
        method,
        amount: numAmount,
        currency,
        reference,
        mobileMoneyPhone,
        cardLast4: cardLast4Digits,
        notes: notes || undefined,
        processedBy: currentUser?._id || 'system',
        processedByName: currentUser ? currentUser.name : 'System',
        facilityId: currentUser?.hospitalId || '',
        orgId: currentUser?.orgId,
      });

      setPaymentDoc(pmt);
      setSuccess(true);
    } catch (err) {
      setError(t('payments.errorPaymentFailed'));
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (!paymentDoc) return;
    const { buildReceiptData, printReceipt } = await import('@/lib/services/receipt-service');
    const receipt = buildReceiptData(paymentDoc, currentUser?.hospital?.name || currentUser?.hospitalName);
    printReceipt(receipt);
  };

  const handleEmailReceipt = async () => {
    if (!paymentDoc || !emailAddress) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const { buildReceiptData, emailReceipt } = await import('@/lib/services/receipt-service');
      const receipt = buildReceiptData(paymentDoc, currentUser?.hospital?.name || currentUser?.hospitalName);
      // emailReceipt returns the API's honest `delivered` flag — only claim
      // "Sent" when the provider actually accepted the email.
      const delivered = await emailReceipt(receipt, emailAddress);
      if (delivered) {
        setEmailSent(true);
      } else {
        setEmailError('Email could not be delivered — print the receipt or try again.');
      }
    } catch (err) {
      console.error(err);
      setEmailError('Email could not be delivered — print the receipt or try again.');
    } finally {
      setEmailSending(false);
    }
  };

  if (success && paymentDoc) {
    return (
      <Modal onClose={() => onSuccess(paymentDoc._id)} width={420} disableBackdropClose>
        <div className="modal-content" style={{ width: '100%' }}>
          {/* Success header */}
          <div style={{
            padding: '28px 20px', textAlign: 'center',
            background: 'var(--accent-light)',
            borderBottom: '1px solid var(--border-medium)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
              background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={56} style={{ color: 'var(--color-success)' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t('payments.paymentRecorded')}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, color: 'var(--color-success)' }}>
              {formatMoney(parseFloat(amount), { currency })}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{patientName}</p>
          </div>

          {/* Receipt details */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('payments.receiptNumberLabel'), value: paymentDoc.reference || paymentDoc._id },
                { label: t('payments.dateLabel'), value: new Date(paymentDoc.processedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                { label: t('payments.methodLabel'), value: tab === 'cash' ? t('payments.methodCash') : tab === 'mobile' ? (mobileProvider === 'mpesa' ? t('payments.methodMpesa') : mobileProvider === 'airtel' ? t('payments.methodAirtelMoney') : t('payments.methodMtnMomo')) : tab === 'card' ? t('payments.methodCard') : tab === 'bank' ? t('payments.methodBankTransfer') : insuranceWaiverMode === 'insurance' ? t('billing.insurance') : t('payments.methodWaiver') },
                { label: t('payments.processedByLabel'), value: paymentDoc.processedByName },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-medium)',
              background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Printer size={14} /> {t('payments.printReceipt')}
            </button>
            <button onClick={() => setShowEmailInput(!showEmailInput)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border-medium)',
              background: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Mail size={14} /> {emailSent ? t('payments.sent') : t('payments.emailReceipt')}
            </button>
          </div>

          {/* Email input (shown when email button clicked) */}
          {showEmailInput && !emailSent && (
            <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
              <input type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)}
                placeholder="support.tamam@gmail.com"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
              <button onClick={handleEmailReceipt} disabled={emailSending || !emailAddress} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'var(--accent-primary)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: emailSending ? 'not-allowed' : 'pointer', opacity: emailSending ? 0.7 : 1,
              }}>
                {emailSending ? t('payments.sending') : t('payments.send')}
              </button>
            </div>
          )}

          {emailSent && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ fontSize: 12, color: 'var(--accent-primary)', padding: '6px 12px', background: 'rgba(33, 145, 208, 0.08)', borderRadius: 8, textAlign: 'center' }}>
                {t('payments.receiptSentTo', { email: emailAddress })}
              </div>
            </div>
          )}

          {emailError && !emailSent && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ fontSize: 12, color: 'var(--color-danger)', padding: '6px 12px', background: 'rgba(229, 46, 66, 0.08)', borderRadius: 8, textAlign: 'center' }}>
                {emailError}
              </div>
            </div>
          )}

          {/* Done button */}
          <div style={{ padding: '0 20px 20px' }}>
            <button onClick={() => onSuccess(paymentDoc._id)} style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              {t('payments.done')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onCancel} width={480}>
      <div className="modal-content pp-pay" style={{ width: '100%' }}>
        <style>{`
          .pp-pay input:not([type=checkbox]):not([type=radio]), .pp-pay select, .pp-pay textarea {
            width:100% !important; padding:11px 13px !important; border-radius:10px !important;
            border:1px solid var(--border-light) !important; background:var(--bg-card, #fff) !important;
            color:var(--text-primary) !important; font-size:14px !important;
            transition:border-color .15s, box-shadow .15s !important;
          }
          .pp-pay select { -webkit-appearance:none; appearance:none; background-image:none; }
          .pp-pay input:focus, .pp-pay select:focus, .pp-pay textarea:focus {
            outline:none !important; border-color:var(--accent-primary) !important;
            box-shadow: none;
          }
          .pp-pay label { font-size:11px !important; font-weight:700 !important; letter-spacing:.03em; text-transform:uppercase; color:var(--text-muted) !important; }
          .pp-pay .pp-field-label { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px; display:block; }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('billing.collectPayment')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patientName}</p>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{ background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Amount hero */}
        <div style={{ padding: '18px 22px', background: 'var(--accent-light)', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('payments.amountDueLabel')}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent-text)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{formatMoney(amountDue, { currency })}</div>
        </div>

        {/* Payment method selector */}
        <div style={{ padding: '16px 22px 4px' }}>
          <span className="pp-field-label">Payment method</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 8 }}>
            {tabs.map(tabItem => {
              const Icon = tabItem.icon;
              const active = tab === tabItem.key;
              return (
                <button key={tabItem.key} type="button" onClick={() => setTab(tabItem.key)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '12px 6px', borderRadius: 12, cursor: 'pointer', minHeight: 72, textAlign: 'center', lineHeight: 1.2,
                  border: active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-light)',
                  background: active ? 'var(--accent-light)' : 'var(--bg-card, #fff)',
                  color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 600, transition: 'all .15s',
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--accent-primary)' : 'var(--overlay-subtle)', color: active ? '#fff' : 'var(--text-muted)' }}>
                    <Icon size={16} />
                  </span>
                  <span>{tabItem.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Service picker — fills the amount from the price catalog */}
          {fees.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>{t('billing.service', { defaultValue: 'Service' })}</label>
                {/* Deselect the chosen catalog service — clears the picker and the
                    amount it auto-filled so the cashier can start over. */}
                {selectedFeeId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedFeeId(''); setAmount(amountDue > 0 ? amountDue.toString() : ''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', padding: 0 }}
                  >
                    {t('action.clear')}
                  </button>
                )}
              </div>
              <select
                value={selectedFeeId}
                onChange={e => {
                  const id = e.target.value;
                  setSelectedFeeId(id);
                  const fee = fees.find(f => f._id === id);
                  if (fee) setAmount(String(fee.unitPrice));
                  else setAmount(amountDue > 0 ? amountDue.toString() : '');
                }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <option value="">Select a service…</option>
                {fees.map(f => (
                  <option key={f._id} value={f._id}>{f.serviceName} — {formatMoney(f.unitPrice, { currency: f.currency, decimals: 2 })}</option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.amountWithCurrency', { currency })}</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 16, fontWeight: 600, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Tab-specific fields */}
          {tab === 'cash' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.receiptNumberOptional')}</label>
              <input type="text" value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} placeholder={t('payments.receiptNumberPlaceholder')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          {tab === 'mobile' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.provider')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['mpesa', 'airtel', 'mtn_momo'] as const).map(p => (
                    <button key={p} onClick={() => setMobileProvider(p)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: mobileProvider === p ? '2px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                      background: mobileProvider === p ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
                      color: mobileProvider === p ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>
                      {p === 'mpesa' ? t('payments.methodMpesa') : p === 'airtel' ? t('payments.methodAirtel') : t('payments.methodMtnMomo')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.phoneNumber')}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+211 9XX XXX XXX"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.transactionReference')}</label>
                <input type="text" value={mobileReference} onChange={e => setMobileReference(e.target.value)} placeholder={t('payments.transactionReferencePlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {tab === 'card' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.last4Digits')}</label>
                <input type="text" value={cardLast4} onChange={e => setCardLast4(e.target.value)} placeholder="1234" maxLength={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.authorizationCode')}</label>
                <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder={t('payments.authorizationCodePlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'color-mix(in srgb, var(--accent-primary) 5%, transparent)', padding: '8px 12px', borderRadius: 6 }}>
                {t('payments.processedViaFlutterwave')}
              </div>
            </>
          )}

          {tab === 'bank' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.bankName')}</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder={t('payments.bankNamePlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.transferReference')}</label>
                <input type="text" value={transferReference} onChange={e => setTransferReference(e.target.value)} placeholder={t('payments.transferReferencePlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.dateOfTransfer')}</label>
                <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {tab === 'insurance' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>{t('payments.type')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['insurance', 'waiver'] as const).map(mode => (
                    <button key={mode} onClick={() => setInsuranceWaiverMode(mode)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: insuranceWaiverMode === mode ? '2px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                      background: insuranceWaiverMode === mode ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
                      color: insuranceWaiverMode === mode ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>
                      {mode === 'insurance' ? t('billing.insurance') : t('payments.methodWaiver')}
                    </button>
                  ))}
                </div>
              </div>

              {insuranceWaiverMode === 'insurance' ? (
                <>
                  {settings.payors.filter(p => p !== 'out_of_pocket').length > 0 && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.payor', { defaultValue: 'Payor' })}</label>
                      <select
                        value={payerName}
                        onChange={e => setPayerName(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      >
                        <option value="">Select payor…</option>
                        {settings.payors.filter(p => p !== 'out_of_pocket').map(p => (
                          <option key={p} value={PAYOR_LABELS[p]}>{PAYOR_LABELS[p]}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.payerName')}</label>
                    <input type="text" value={payerName} onChange={e => setPayerName(e.target.value)} placeholder={t('payments.payerNamePlaceholder')}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.claimReference')}</label>
                    <input type="text" value={claimReference} onChange={e => setClaimReference(e.target.value)} placeholder={t('payments.claimReferencePlaceholder')}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.reasonForWaiver')}</label>
                    <input type="text" value={waiverReason} onChange={e => setWaiverReason(e.target.value)} placeholder={t('payments.reasonForWaiverPlaceholder')}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('payments.approvedBy')}</label>
                    <input type="text" value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder={t('payments.approvedByPlaceholder')}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 14, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Notes field (available on all tabs) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{t('nurse.notesOptional')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('payments.notesPlaceholder')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', minHeight: 60, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          {error && <div style={{ fontSize: 13, color: 'var(--error)', padding: '8px 12px', background: 'color-mix(in srgb, var(--error) 8%, transparent)', borderRadius: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10, position: 'sticky', bottom: 0, background: 'var(--bg-card-solid, #fff)', borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px 0', borderRadius: 11, border: '1px solid var(--border-medium)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{t('action.cancel')}</button>
          <button onClick={handleSubmit} disabled={processing} style={{
            flex: 2, padding: '13px 0', borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover, #015697))',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: 'none',
          }}>
            {processing ? <><Loader2 size={14} className="animate-spin" /> {t('payments.processing')}</> : t('payments.recordAmount', { amount: parseFloat(amount).toLocaleString(), currency })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
