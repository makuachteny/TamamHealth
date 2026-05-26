/**
 * HR types — leave requests + payroll-related extensions for staff records.
 * Staff identity itself lives in `UserDoc` (db-types.ts); this file adds
 * the workflow surfaces that only HR cares about.
 */
import type { BaseDoc } from './db-types';

export type PayrollStatus = 'draft' | 'approved' | 'paid' | 'reversed';

export interface PayrollEntryDoc extends BaseDoc {
  type: 'payroll_entry';
  userId: string;
  userName: string;
  role: string;
  facilityId: string;
  facilityName: string;
  period: string;            // YYYY-MM
  baseSalary: number;
  allowances: number;        // housing, transport, hardship, etc — single sum to keep payroll simple
  deductions: number;        // tax + statutory + advances
  netPay: number;            // baseSalary + allowances - deductions
  currency: string;          // SSP, USD
  status: PayrollStatus;
  paidAt?: string;
  paidBy?: string;
  paidByName?: string;
  notes?: string;
  orgId?: string;
}

export type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'study' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'taken';

export interface LeaveRequestDoc extends BaseDoc {
  type: 'leave_request';
  userId: string;
  userName: string;
  role: string;
  facilityId: string;
  facilityName: string;
  leaveType: LeaveType;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  days: number;          // computed at request time, snapshotted
  reason?: string;
  status: LeaveStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decidedByName?: string;
  decisionNotes?: string;
  orgId?: string;
}
