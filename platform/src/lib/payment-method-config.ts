import { Banknote, Smartphone, CreditCard, Building2, Shield, Gift, FileText, type LucideIcon } from '@/components/icons/lucide';

export interface PaymentMethodConfig {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
}

export const PAYMENT_METHOD_CONFIG: Record<string, PaymentMethodConfig> = {
  cash: { label: 'Cash', shortLabel: 'Cash', icon: Banknote, color: 'var(--color-success)' },
  mpesa: { label: 'M-Pesa', shortLabel: 'M-Pesa', icon: Smartphone, color: '#4CAF50' },
  airtel: { label: 'Airtel Money', shortLabel: 'Airtel', icon: Smartphone, color: '#E53935' },
  mtn_momo: { label: 'MTN Mobile Money', shortLabel: 'MTN MoMo', icon: Smartphone, color: '#FFC107' },
  m_gurush: { label: 'm-GURUSH', shortLabel: 'm-GURUSH', icon: Smartphone, color: '#0EA5A4' },
  card: { label: 'Card (Flutterwave)', shortLabel: 'Card', icon: CreditCard, color: '#2196F3' },
  bank_transfer: { label: 'Bank Transfer', shortLabel: 'Bank', icon: Building2, color: '#607D8B' },
  insurance: { label: 'Insurance Payment', shortLabel: 'Insurance', icon: Shield, color: '#9C27B0' },
  waiver: { label: 'Fee Waiver', shortLabel: 'Waiver', icon: Gift, color: '#FF9800' },
  payment_plan: { label: 'Payment Plan', shortLabel: 'Plan', icon: FileText, color: '#00BCD4' },
};

export function getMethodConfig(method: string): PaymentMethodConfig {
  return PAYMENT_METHOD_CONFIG[method] || { label: method, shortLabel: method, icon: Banknote, color: 'var(--text-muted)' };
}
