/**
 * Patient feedback service — collect ratings + comments, summarise sentiment,
 * and track follow-up resolution.
 */
import { patientFeedbackDB } from '../db';
import type { PatientFeedbackDoc, FeedbackSentiment, FeedbackCategory } from '../db-types-feedback';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';

function deriveSentiment(rating: number): FeedbackSentiment {
  if (rating <= 2) return 'negative';
  if (rating >= 4) return 'positive';
  return 'neutral';
}

export async function getAllFeedback(scope?: DataScope): Promise<PatientFeedbackDoc[]> {
  const db = patientFeedbackDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as PatientFeedbackDoc)
    .filter(d => d && d.type === 'patient_feedback')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return scope ? filterByScope(all, scope) : all;
}

export interface CreateFeedbackInput {
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  facilityId: string;
  facilityName: string;
  department?: string;
  visitDate?: string;
  rating: number;
  npsScore?: number;
  category: FeedbackCategory;
  comment?: string;
  channel: PatientFeedbackDoc['channel'];
  followUpRequired?: boolean;
  collectedBy?: string;
  collectedByName?: string;
  state?: string;
  county?: string;
  orgId?: string;
}

export async function submitFeedback(input: CreateFeedbackInput): Promise<PatientFeedbackDoc> {
  const db = patientFeedbackDB();
  const now = new Date().toISOString();

  // Negative feedback auto-flags follow-up regardless of caller intent so
  // nothing gets lost when a kiosk submission only sets rating + comment.
  const sentiment = deriveSentiment(input.rating);
  const followUpRequired = input.followUpRequired ?? sentiment === 'negative';

  const doc: PatientFeedbackDoc = {
    _id: `fb-${uuidv4().slice(0, 8)}`,
    type: 'patient_feedback',
    ...input,
    sentiment,
    followUpRequired,
    followUpStatus: followUpRequired ? 'open' : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  if (followUpRequired) {
    await logAuditSafe('FEEDBACK_NEGATIVE', input.collectedBy || 'system', input.collectedByName || 'Patient',
      `Negative feedback (${input.rating}/5) at ${input.facilityName} — ${input.category}`);
  }

  return doc;
}

export async function resolveFeedback(
  id: string,
  resolution: { status: NonNullable<PatientFeedbackDoc['followUpStatus']>; notes?: string; resolvedBy: string; resolvedByName: string },
): Promise<PatientFeedbackDoc | null> {
  const db = patientFeedbackDB();
  try {
    const existing = await db.get(id) as PatientFeedbackDoc;
    const now = new Date().toISOString();
    existing.followUpStatus = resolution.status;
    existing.followUpNotes = resolution.notes;
    existing.followUpAssignedTo = resolution.resolvedBy;
    existing.followUpAssignedToName = resolution.resolvedByName;
    if (resolution.status === 'resolved' || resolution.status === 'wont_fix') {
      existing.resolvedAt = now;
    }
    existing.updatedAt = now;
    const resp = await db.put(existing);
    existing._rev = resp.rev;
    return existing;
  } catch {
    return null;
  }
}

export interface FeedbackSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  averageRating: number;
  npsAverage: number | null;
  openFollowUps: number;
  byCategory: Record<string, number>;
}

export async function getFeedbackSummary(scope?: DataScope): Promise<FeedbackSummary> {
  const all = await getAllFeedback(scope);
  const npsScores = all.map(f => f.npsScore).filter((n): n is number => typeof n === 'number');
  const summary: FeedbackSummary = {
    total: all.length,
    positive: all.filter(f => f.sentiment === 'positive').length,
    neutral: all.filter(f => f.sentiment === 'neutral').length,
    negative: all.filter(f => f.sentiment === 'negative').length,
    averageRating: all.length > 0 ? all.reduce((s, f) => s + f.rating, 0) / all.length : 0,
    npsAverage: npsScores.length > 0 ? npsScores.reduce((s, n) => s + n, 0) / npsScores.length : null,
    openFollowUps: all.filter(f => f.followUpRequired && (f.followUpStatus === 'open' || f.followUpStatus === 'in_progress')).length,
    byCategory: {},
  };
  for (const f of all) summary.byCategory[f.category] = (summary.byCategory[f.category] || 0) + 1;
  return summary;
}
