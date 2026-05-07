/**
 * TamamHealth Patient Data Access Layer — Offline-first with SQLite.
 *
 * All reads come from the local SQLite database.
 * Writes are persisted locally AND enqueued for sync to the platform API.
 * The sync engine (sync-engine.ts) handles push/pull when online.
 */

import type {
  MedicalRecord, LabResult, Prescription, Appointment,
  Immunization, Message, BillingSummary,
} from './types';

import * as db from './database';

// ---------------------------------------------------------------------------
// READ — always from local SQLite (instant, works offline)
// ---------------------------------------------------------------------------

export async function getMedicalRecords(): Promise<MedicalRecord[]> {
  return db.getMedicalRecords();
}

export async function getLabResults(): Promise<LabResult[]> {
  return db.getLabResults();
}

export async function getPrescriptions(): Promise<Prescription[]> {
  return db.getPrescriptions();
}

export async function getAppointments(): Promise<Appointment[]> {
  return db.getAppointments();
}

export async function getImmunizations(): Promise<Immunization[]> {
  return db.getImmunizations();
}

export async function getMessages(): Promise<Message[]> {
  return db.getMessages();
}

export async function getBilling(): Promise<BillingSummary> {
  return db.getBilling();
}
