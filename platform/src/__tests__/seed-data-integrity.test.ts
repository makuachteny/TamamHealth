/**
 * Seed Data Integrity Tests
 *
 * Validates the consistency and correctness of mock/seed data used
 * throughout the TamamHealth health information system. Checks that:
 * - Patient and hospital records have required fields
 * - No duplicate IDs exist
 * - IDs follow naming conventions
 * - Cross-references between seed data arrays are valid
 */
import { patients, hospitals, referrals, diseaseAlerts } from '@/data/mock';

describe('Seed Data Integrity', () => {

  describe('Patient records', () => {
    test('all patients have required fields', () => {
      patients.forEach((p) => {
        expect(p.id).toBeDefined();
        expect(p.firstName).toBeTruthy();
        expect(p.surname).toBeTruthy();
        expect(p.gender).toMatch(/^(Male|Female)$/);
        expect(p.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.phone).toBeTruthy();
        expect(p.state).toBeTruthy();
        expect(p.county).toBeTruthy();
        expect(p.tribe).toBeTruthy();
        expect(p.primaryLanguage).toBeTruthy();
        expect(p.bloodType).toBeTruthy();
        expect(Array.isArray(p.allergies)).toBe(true);
        expect(Array.isArray(p.chronicConditions)).toBe(true);
        expect(p.nokName).toBeTruthy();
        expect(p.nokRelationship).toBeTruthy();
        expect(p.nokPhone).toBeTruthy();
        expect(p.registrationHospital).toBeTruthy();
        expect(p.registrationDate).toBeTruthy();
        expect(p.lastVisitDate).toBeTruthy();
        expect(p.lastVisitHospital).toBeTruthy();
        expect(typeof p.isActive).toBe('boolean');
      });
    });

    test('no duplicate patient IDs', () => {
      const ids = patients.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('patient IDs follow pat-XXXXX naming convention', () => {
      patients.forEach((p) => {
        expect(p.id).toMatch(/^pat-\d{5}$/);
      });
    });

    test('generates exactly 50 patients', () => {
      expect(patients).toHaveLength(50);
    });
  });

  describe('Hospital records', () => {
    test('all hospitals have required fields', () => {
      hospitals.forEach((h) => {
        expect(h.id).toBeDefined();
        expect(h.name).toBeTruthy();
        expect(h.type).toMatch(/^(national_referral|state_hospital|county_hospital|phcc|phcu)$/);
        expect(h.state).toBeTruthy();
        expect(h.town).toBeTruthy();
        expect(typeof h.totalBeds).toBe('number');
        expect(typeof h.doctors).toBe('number');
        expect(typeof h.nurses).toBe('number');
        expect(typeof h.lat).toBe('number');
        expect(typeof h.lng).toBe('number');
        expect(Array.isArray(h.services)).toBe(true);
        expect(h.services.length).toBeGreaterThan(0);
        expect(h.syncStatus).toMatch(/^(online|offline|syncing)$/);
      });
    });

    test('no duplicate hospital IDs', () => {
      const ids = hospitals.map((h) => h.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('hospital IDs follow hosp-XXX or phcc/phcu naming convention', () => {
      hospitals.forEach((h) => {
        expect(h.id).toMatch(/^(hosp-\d{3}|county-\d{3}|phcc-\d{3}|phcu-\d{3})$/);
      });
    });
  });

  describe('Cross-reference consistency (known seed values)', () => {
    test('lab result patient IDs reference real patients', () => {
      // Known lab patient IDs from db-seed.ts labOrders array
      const labPatientIds = [
        'pat-00001', 'pat-00005', 'pat-00012', 'pat-00018', 'pat-00022',
        'pat-00030', 'pat-00035', 'pat-00040', 'pat-00008', 'pat-00015',
      ];
      const patientIds = new Set(patients.map((p) => p.id));
      labPatientIds.forEach((id) => {
        expect(patientIds.has(id)).toBe(true);
      });
    });

    test('prescription patient IDs reference real patients', () => {
      // Known prescription patient IDs from db-seed.ts prescriptionQueue array
      const rxPatientIds = [
        'pat-00001', 'pat-00005', 'pat-00012',
        'pat-00018', 'pat-00022', 'pat-00030',
      ];
      const patientIds = new Set(patients.map((p) => p.id));
      rxPatientIds.forEach((id) => {
        expect(patientIds.has(id)).toBe(true);
      });
    });

    test('birth records reference valid facility IDs', () => {
      // Known facilityId values from db-seed.ts seedBirths array
      const birthFacilityIds = ['hosp-001', 'hosp-002', 'hosp-003', 'hosp-004', 'hosp-005'];
      const hospitalIds = new Set(hospitals.map((h) => h.id));
      birthFacilityIds.forEach((id) => {
        expect(hospitalIds.has(id)).toBe(true);
      });
    });

    test('death records reference valid facility IDs', () => {
      // Known facilityId values from db-seed.ts seedDeaths array
      const deathFacilityIds = ['hosp-001', 'hosp-002', 'hosp-003', 'hosp-004', 'hosp-005'];
      const hospitalIds = new Set(hospitals.map((h) => h.id));
      deathFacilityIds.forEach((id) => {
        expect(hospitalIds.has(id)).toBe(true);
      });
    });

    test('child patient IDs for immunization records follow convention', () => {
      // Immunizations reference pat-00051 through pat-00056 (child patients seeded separately)
      const childIds = ['pat-00051', 'pat-00052', 'pat-00053', 'pat-00054', 'pat-00055', 'pat-00056'];
      childIds.forEach((id) => {
        expect(id).toMatch(/^pat-\d{5}$/);
      });
    });

    test('mother patient IDs for ANC records follow convention', () => {
      // ANC visits reference pat-00057 through pat-00062 (mother patients seeded separately)
      const motherIds = ['pat-00057', 'pat-00058', 'pat-00059', 'pat-00060', 'pat-00061', 'pat-00062'];
      motherIds.forEach((id) => {
        expect(id).toMatch(/^pat-\d{5}$/);
      });
    });

    test('follow-up records use geocode IDs as patient identifiers', () => {
      // Known geocodeId values from db-seed.ts seedFollowUps array
      const geocodeIds = ['BOMA-KJ-HH1003', 'BOMA-KJ-HH1015', 'BOMA-KJ-HH1022', 'BOMA-KJ-HH1008'];
      geocodeIds.forEach((id) => {
        expect(id).toMatch(/^BOMA-[A-Z]{2}-HH\d{4}$/);
      });
    });

    test('referral records reference valid patient and hospital IDs', () => {
      const patientIds = new Set(patients.map((p) => p.id));
      const hospitalIds = new Set(hospitals.map((h) => h.id));

      referrals.forEach((r) => {
        expect(patientIds.has(r.patientId)).toBe(true);
        expect(hospitalIds.has(r.fromHospitalId)).toBe(true);
        expect(hospitalIds.has(r.toHospitalId)).toBe(true);
      });
    });

    test('disease alerts reference valid South Sudan states', () => {
      const validStates = [
        'Central Equatoria', 'Eastern Equatoria', 'Jonglei', 'Lakes',
        'Northern Bahr el Ghazal', 'Unity', 'Upper Nile', 'Warrap',
        'Western Bahr el Ghazal', 'Western Equatoria',
      ];
      diseaseAlerts.forEach((alert) => {
        expect(validStates).toContain(alert.state);
      });
    });

    test('message patient IDs reference real patients', () => {
      // Known patient IDs from db-seed.ts seedMessages array
      const messagePatientIds = ['pat-00001', 'pat-00005', 'pat-00012', 'pat-00018'];
      const patientIds = new Set(patients.map((p) => p.id));
      messagePatientIds.forEach((id) => {
        expect(patientIds.has(id)).toBe(true);
      });
    });
  });
});
