/**
 * Billing & Payments types for private-sector facilities.
 * Supports consultation fees, lab charges, pharmacy charges, and
 * insurance-based billing common in East African healthcare.
 */
import type { BaseDoc, FacilityLevel } from './db-types';

export type BillingStatus = 'draft' | 'pending' | 'partial' | 'paid' | 'waived' | 'cancelled' | 'insurance_pending' | 'insurance_approved' | 'insurance_rejected';
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'insurance' | 'credit' | 'waiver';
export type ChargeCategory = 'consultation' | 'laboratory' | 'pharmacy' | 'radiology' | 'procedure' | 'bed_charge' | 'surgery' | 'ambulance' | 'other';

export interface BillLineItem {
  id: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  referenceId?: string;     // Links to lab order, prescription, etc.
  referenceType?: string;   // 'lab_result' | 'prescription' | 'appointment'
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;       // Receipt number, mobile money transaction ID, etc.
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  notes?: string;
}

export interface BillingDoc extends BaseDoc {
  type: 'billing';
  // Patient
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  // Facility
  facilityId: string;
  facilityName: string;
  facilityLevel: FacilityLevel;
  // Visit context
  encounterDate: string;
  encounterId?: string;     // Link to medical record
  appointmentId?: string;
  // Line items
  items: BillLineItem[];
  // Totals
  subtotal: number;
  discount: number;
  discountReason?: string;
  taxRate: number;           // Percentage (0 for public, varies for private)
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  // Currency
  currency: string;          // SSP (South Sudanese Pound), USD, etc.
  // Payments
  payments: PaymentRecord[];
  // Insurance
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCoveragePercent?: number;
  insuranceClaimStatus?: 'none' | 'submitted' | 'approved' | 'rejected' | 'partial';
  insuranceApprovedAmount?: number;
  // Status
  status: BillingStatus;
  // Audit
  generatedBy: string;
  generatedByName: string;
  invoiceNumber: string;
  // Administrative
  state: string;
  county?: string;
  orgId?: string;
  notes?: string;
}

/**
 * Fee schedule item — defines standard charges per facility.
 */
export interface FeeScheduleDoc extends BaseDoc {
  type: 'fee_schedule';
  facilityId: string;
  facilityName: string;
  category: ChargeCategory;
  serviceCode: string;
  serviceName: string;
  unitPrice: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  orgId?: string;
}
