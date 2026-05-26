/**
 * Patient feedback / CRM types.
 * Supports anonymous + identified responses, NPS-style scoring, and
 * facility-level satisfaction trending.
 */
import type { BaseDoc } from './db-types';

export type FeedbackChannel = 'in_person' | 'sms' | 'whatsapp' | 'phone' | 'kiosk' | 'web';
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';
export type FeedbackCategory =
  | 'wait_time'
  | 'staff_courtesy'
  | 'cleanliness'
  | 'medication_availability'
  | 'cost'
  | 'clinical_quality'
  | 'communication'
  | 'other';

export interface PatientFeedbackDoc extends BaseDoc {
  type: 'patient_feedback';
  patientId?: string;          // optional — anonymous feedback is allowed
  patientName?: string;
  hospitalNumber?: string;
  facilityId: string;
  facilityName: string;
  department?: string;
  visitDate?: string;
  // Scoring
  rating: number;              // 1–5
  npsScore?: number;           // 0–10 (would-recommend), optional
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  comment?: string;
  // Channel + handling
  channel: FeedbackChannel;
  followUpRequired: boolean;
  followUpAssignedTo?: string;
  followUpAssignedToName?: string;
  followUpStatus?: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  followUpNotes?: string;
  resolvedAt?: string;
  // Submitter (when collected on patient's behalf by staff)
  collectedBy?: string;
  collectedByName?: string;
  // Org / scope
  state?: string;
  county?: string;
  orgId?: string;
}
