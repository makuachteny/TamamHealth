/**
 * Asset Management types — track facility equipment, vehicles, beds,
 * lab/imaging machines, and other capital items. Supports maintenance
 * scheduling, warranty tracking, and a simple status lifecycle.
 */
import type { BaseDoc, FacilityLevel } from './db-types';

export type AssetCategory =
  | 'medical_equipment'   // BP cuffs, oximeters, ECG, ultrasound
  | 'imaging'             // X-ray, CT, MRI
  | 'lab'                 // microscope, hematology analyzer, centrifuge
  | 'surgical'            // OT lights, anesthesia machine
  | 'vehicle'             // ambulance, motorbike, bicycle
  | 'it'                  // laptops, tablets, printers, network gear
  | 'furniture'           // beds, chairs, cupboards
  | 'utility'             // generator, oxygen concentrator, solar panel
  | 'cold_chain'          // vaccine fridge, freezer
  | 'other';

export type AssetStatus =
  | 'operational'
  | 'needs_service'
  | 'under_repair'
  | 'decommissioned'
  | 'lost_or_stolen';

export type AssetCondition = 'new' | 'good' | 'fair' | 'poor';

export interface AssetMaintenanceLog {
  date: string;
  performedBy: string;
  performedByName: string;
  type: 'inspection' | 'repair' | 'calibration' | 'service';
  cost?: number;
  notes: string;
}

export interface AssetDoc extends BaseDoc {
  type: 'asset';
  // Identity
  name: string;
  serialNumber?: string;
  assetTag: string;            // facility-issued tag
  category: AssetCategory;
  manufacturer?: string;
  model?: string;
  // Placement
  facilityId: string;
  facilityName: string;
  facilityLevel: FacilityLevel;
  department?: string;         // e.g. Maternity Ward, Lab, OPD
  location?: string;           // free-text for room / shelf
  // Lifecycle
  status: AssetStatus;
  condition: AssetCondition;
  acquiredDate?: string;
  costCurrency?: string;       // SSP, USD, etc
  cost?: number;
  donor?: string;              // donor agency or "Procured"
  // Warranty + service
  warrantyExpiresAt?: string;
  lastServicedAt?: string;
  nextServiceDueAt?: string;
  serviceIntervalMonths?: number;
  maintenanceLog?: AssetMaintenanceLog[];
  // Misc
  notes?: string;
  // Org / scope
  state?: string;
  county?: string;
  orgId?: string;
}
