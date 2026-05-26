/**
 * Drug Interaction Service Tests
 *
 * NOTE: This service has NO database dependency (pure functions).
 * Tests the core interaction checking logic directly.
 */

import {
  checkInteractions,
  checkNewPrescription,
  getInteractionsForDrug,
} from '@/lib/services/drug-interaction-service';

describe('drug-interaction-service', () => {
  describe('checkInteractions', () => {
    it('should return no interactions for single medication', () => {
      const result = checkInteractions(['Amoxicillin']);
      expect(result.hasInteractions).toBe(false);
      expect(result.interactions).toHaveLength(0);
      expect(result.highestSeverity).toBeNull();
    });

    it('should return no interactions for empty list', () => {
      const result = checkInteractions([]);
      expect(result.hasInteractions).toBe(false);
      expect(result.interactions).toHaveLength(0);
      expect(result.highestSeverity).toBeNull();
    });

    it('should detect contraindicated pair: artemether-lumefantrine + quinine', () => {
      const result = checkInteractions(['Artemether-Lumefantrine', 'Quinine']);
      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.length).toBeGreaterThan(0);
      expect(result.highestSeverity).toBe('contraindicated');

      const interaction = result.interactions.find(
        i => i.drug1.toLowerCase().includes('artemether') && i.drug2.toLowerCase().includes('quinine')
      );
      expect(interaction).toBeDefined();
      expect(interaction?.severity).toBe('contraindicated');
      expect(interaction?.description).toContain('QT interval');
    });

    it('should detect serious pair: gentamicin + furosemide', () => {
      const result = checkInteractions(['Gentamicin', 'Furosemide']);
      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.length).toBeGreaterThan(0);
      expect(result.highestSeverity).toBe('serious');

      const interaction = result.interactions[0];
      expect(interaction.severity).toBe('serious');
      expect(interaction.description.toLowerCase()).toContain('ototoxicity');
    });

    it('should detect moderate pair: amoxicillin + warfarin', () => {
      const result = checkInteractions(['Amoxicillin', 'Warfarin']);
      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.length).toBeGreaterThan(0);
      expect(result.highestSeverity).toBe('moderate');

      const interaction = result.interactions[0];
      expect(interaction.severity).toBe('moderate');
      expect(interaction.description.toLowerCase()).toContain('anticoagulant');
    });

    it('should work with reversed medication order', () => {
      const result1 = checkInteractions(['Amoxicillin', 'Warfarin']);
      const result2 = checkInteractions(['Warfarin', 'Amoxicillin']);
      expect(result1.hasInteractions).toBe(true);
      expect(result2.hasInteractions).toBe(true);
      expect(result1.interactions.length).toBe(result2.interactions.length);
    });

    it('should be case-insensitive', () => {
      const result1 = checkInteractions(['amoxicillin', 'warfarin']);
      const result2 = checkInteractions(['AMOXICILLIN', 'WARFARIN']);
      const result3 = checkInteractions(['AmOxIcIlLiN', 'WaRfArIn']);
      expect(result1.hasInteractions).toBe(true);
      expect(result2.hasInteractions).toBe(true);
      expect(result3.hasInteractions).toBe(true);
    });

    it('should handle whitespace in medication names', () => {
      const result = checkInteractions(['  Amoxicillin  ', '  Warfarin  ']);
      expect(result.hasInteractions).toBe(true);
    });

    it('should detect multiple interactions in one call', () => {
      const result = checkInteractions([
        'Amoxicillin',
        'Warfarin',
        'Gentamicin',
        'Furosemide',
      ]);
      expect(result.hasInteractions).toBe(true);
      // Should find at least: amoxicillin+warfarin and gentamicin+furosemide
      expect(result.interactions.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort interactions by severity (contraindicated > serious > moderate)', () => {
      const result = checkInteractions([
        'Amoxicillin', // moderate with warfarin
        'Warfarin',
        'Gentamicin', // serious with furosemide
        'Furosemide',
        'Artemether-Lumefantrine', // contraindicated with quinine
        'Quinine',
      ]);
      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.length).toBeGreaterThanOrEqual(3);

      // First should be contraindicated
      expect(result.interactions[0].severity).toBe('contraindicated');
      // Then serious
      const seriousIndex = result.interactions.findIndex(i => i.severity === 'serious');
      const moderateIndex = result.interactions.findIndex(i => i.severity === 'moderate');
      expect(seriousIndex).toBeGreaterThan(-1);
      if (moderateIndex >= 0) {
        expect(seriousIndex).toBeLessThan(moderateIndex);
      }
    });

    it('should not return duplicate interactions', () => {
      const result = checkInteractions(['Amoxicillin', 'Warfarin']);
      const interactionKeys = result.interactions.map(i => `${i.drug1}|${i.drug2}`);
      const uniqueKeys = new Set(interactionKeys);
      expect(interactionKeys.length).toBe(uniqueKeys.size);
    });

    it('should find morphine + diazepam serious interaction', () => {
      const result = checkInteractions(['Morphine', 'Diazepam']);
      expect(result.hasInteractions).toBe(true);
      expect(result.highestSeverity).toBe('serious');

      const interaction = result.interactions[0];
      expect(interaction.description.toLowerCase()).toContain('respiratory');
    });

    it('should find isoniazid + rifampicin serious TB drug interaction', () => {
      const result = checkInteractions(['Isoniazid', 'Rifampicin']);
      expect(result.hasInteractions).toBe(true);
      expect(result.highestSeverity).toBe('serious');

      const interaction = result.interactions[0];
      expect(interaction.description.toLowerCase()).toContain('hepatotoxic');
    });
  });

  describe('checkNewPrescription', () => {
    it('should check new drug against current medications', () => {
      const result = checkNewPrescription('Amoxicillin', ['Warfarin']);
      expect(result.hasInteractions).toBe(true);
      expect(result.highestSeverity).toBe('moderate');
    });

    it('should return no interactions if new drug is safe with all current meds', () => {
      const result = checkNewPrescription('Paracetamol', ['Ibuprofen']);
      expect(result.hasInteractions).toBe(false);
    });

    it('should work with empty current medications list', () => {
      const result = checkNewPrescription('Amoxicillin', []);
      expect(result.hasInteractions).toBe(false);
    });

    it('should detect interactions with multiple current medications', () => {
      const result = checkNewPrescription('Warfarin', [
        'Paracetamol',
        'Amoxicillin',
        'Ibuprofen',
      ]);
      expect(result.hasInteractions).toBe(true);
      // Should interact with amoxicillin
      expect(result.interactions.some(i =>
        (i.drug1.toLowerCase().includes('amoxicillin') && i.drug2.toLowerCase().includes('warfarin')) ||
        (i.drug2.toLowerCase().includes('amoxicillin') && i.drug1.toLowerCase().includes('warfarin'))
      )).toBe(true);
    });

    it('should find highest severity among multiple interactions', () => {
      const result = checkNewPrescription('Quinine', [
        'Artemether-Lumefantrine',
        'Amoxicillin',
      ]);
      expect(result.hasInteractions).toBe(true);
      // Should be contraindicated (artemether) not moderate (amoxicillin)
      expect(result.highestSeverity).toBe('contraindicated');
    });
  });

  describe('getInteractionsForDrug', () => {
    it('should return empty array for drug with no interactions', () => {
      const interactions = getInteractionsForDrug('Paracetamol');
      expect(Array.isArray(interactions)).toBe(true);
      expect(interactions.length).toBe(0);
    });

    it('should return all interactions for warfarin', () => {
      const interactions = getInteractionsForDrug('Warfarin');
      expect(interactions.length).toBeGreaterThan(0);
      // Should include metronidazole (contraindicated) and amoxicillin (moderate)
      expect(interactions.some(i => i.severity === 'contraindicated')).toBe(true);
      expect(interactions.some(i => i.severity === 'moderate')).toBe(true);
    });

    it('should return interactions for gentamicin', () => {
      const interactions = getInteractionsForDrug('Gentamicin');
      expect(interactions.length).toBeGreaterThan(0);
      // Should include furosemide and magnesium sulfate
      expect(interactions.some(i =>
        i.drug1.toLowerCase().includes('furosemide') || i.drug2.toLowerCase().includes('furosemide')
      )).toBe(true);
      expect(interactions.some(i =>
        i.drug1.toLowerCase().includes('magnesium') || i.drug2.toLowerCase().includes('magnesium')
      )).toBe(true);
    });

    it('should be case-insensitive', () => {
      const interactions1 = getInteractionsForDrug('warfarin');
      const interactions2 = getInteractionsForDrug('WARFARIN');
      const interactions3 = getInteractionsForDrug('WaRfArIn');
      expect(interactions1.length).toBe(interactions2.length);
      expect(interactions2.length).toBe(interactions3.length);
      expect(interactions1.length).toBeGreaterThan(0);
    });

    it('should return interactions for artemether-lumefantrine', () => {
      const interactions = getInteractionsForDrug('Artemether-Lumefantrine');
      expect(interactions.length).toBeGreaterThan(0);
      // Should include quinine (contraindicated) and phenobarbitone (serious)
      expect(interactions.some(i => i.severity === 'contraindicated')).toBe(true);
      expect(interactions.some(i => i.severity === 'serious')).toBe(true);
    });

    it('should handle whitespace', () => {
      const interactions = getInteractionsForDrug('  Warfarin  ');
      expect(interactions.length).toBeGreaterThan(0);
    });

    it('should return interactions for ciprofloxacin', () => {
      const interactions = getInteractionsForDrug('Ciprofloxacin');
      expect(interactions.length).toBeGreaterThan(0);
      // Should have contraindicated with tizanidine and serious with insulin
      expect(interactions.some(i =>
        (i.drug1.toLowerCase().includes('tizanidine') || i.drug2.toLowerCase().includes('tizanidine')) &&
        i.severity === 'contraindicated'
      )).toBe(true);
      expect(interactions.some(i =>
        (i.drug1.toLowerCase().includes('insulin') || i.drug2.toLowerCase().includes('insulin')) &&
        i.severity === 'serious'
      )).toBe(true);
    });

    it('should include all related interactions for a drug', () => {
      const interactions = getInteractionsForDrug('Amlodipine');
      expect(interactions.length).toBeGreaterThan(0);
      // Should find simvastatin interaction
      expect(interactions.some(i =>
        (i.drug1.toLowerCase().includes('simvastatin') || i.drug2.toLowerCase().includes('simvastatin')) &&
        i.severity === 'serious'
      )).toBe(true);
    });
  });

  describe('Contraindicated interactions', () => {
    const contraindications = [
      ['Methotrexate', 'Cotrimoxazole'],
      ['Warfarin', 'Metronidazole'],
      ['Artemether-Lumefantrine', 'Quinine'],
      ['Ciprofloxacin', 'Tizanidine'],
    ];

    contraindications.forEach(([drug1, drug2]) => {
      it(`should mark ${drug1} + ${drug2} as contraindicated`, () => {
        const result = checkInteractions([drug1, drug2]);
        expect(result.hasInteractions).toBe(true);
        expect(result.highestSeverity).toBe('contraindicated');
      });
    });
  });

  describe('Serious interactions', () => {
    const serious = [
      ['Gentamicin', 'Furosemide'],
      ['Morphine', 'Diazepam'],
      ['Amlodipine', 'Simvastatin'],
      ['Metformin', 'Contrast Dye'],
      ['Insulin', 'Ciprofloxacin'],
      ['Isoniazid', 'Rifampicin'],
      ['Phenobarbitone', 'Artemether-Lumefantrine'],
      ['Magnesium Sulfate', 'Gentamicin'],
    ];

    serious.forEach(([drug1, drug2]) => {
      it(`should mark ${drug1} + ${drug2} as serious`, () => {
        const result = checkInteractions([drug1, drug2]);
        expect(result.hasInteractions).toBe(true);
        expect(result.interactions.some(i => i.severity === 'serious')).toBe(true);
      });
    });
  });

  describe('Moderate interactions', () => {
    const moderate = [
      ['Amoxicillin', 'Warfarin'],
      ['Ibuprofen', 'Enalapril'],
      ['Ciprofloxacin', 'Iron Folate'],
      ['Doxycycline', 'Iron Folate'],
      ['Metformin', 'Enalapril'],
      ['Diclofenac', 'Ciprofloxacin'],
      ['Oral Rehydration Salts', 'Ciprofloxacin'],
    ];

    moderate.forEach(([drug1, drug2]) => {
      it(`should mark ${drug1} + ${drug2} as moderate`, () => {
        const result = checkInteractions([drug1, drug2]);
        expect(result.hasInteractions).toBe(true);
        expect(result.highestSeverity).toBe('moderate');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null input gracefully', () => {
      const result = checkInteractions(null as unknown as string[]);
      expect(result.hasInteractions).toBe(false);
      expect(result.interactions).toEqual([]);
      expect(result.highestSeverity).toBeNull();
    });

    it('should handle undefined input gracefully', () => {
      const result = checkInteractions(undefined as unknown as string[]);
      expect(result.hasInteractions).toBe(false);
      expect(result.interactions).toEqual([]);
      expect(result.highestSeverity).toBeNull();
    });

    it('should handle duplicate medications in list', () => {
      const result = checkInteractions(['Warfarin', 'Warfarin', 'Amoxicillin']);
      expect(result.hasInteractions).toBe(true);
      // Should still find the interaction
      expect(result.interactions.some(i =>
        (i.drug1.toLowerCase().includes('warfarin') && i.drug2.toLowerCase().includes('amoxicillin')) ||
        (i.drug2.toLowerCase().includes('warfarin') && i.drug1.toLowerCase().includes('amoxicillin'))
      )).toBe(true);
    });

    it('should return proper structure for interaction results', () => {
      const result = checkInteractions(['Gentamicin', 'Furosemide']);
      expect(typeof result.hasInteractions).toBe('boolean');
      expect(Array.isArray(result.interactions)).toBe(true);
      expect(['contraindicated', 'serious', 'moderate', null].includes(result.highestSeverity)).toBe(true);

      if (result.interactions.length > 0) {
        const interaction = result.interactions[0];
        expect(typeof interaction.drug1).toBe('string');
        expect(typeof interaction.drug2).toBe('string');
        expect(['contraindicated', 'serious', 'moderate'].includes(interaction.severity)).toBe(true);
        expect(typeof interaction.description).toBe('string');
        expect(typeof interaction.clinicalAdvice).toBe('string');
      }
    });

    it('should handle medications with similar names', () => {
      // These have different properties, so shouldn't interact
      // (unless explicitly in database)
      const result = checkInteractions(['Rifampicin', 'Rifabutin']);
      // No explicit interaction defined
      expect(typeof result.hasInteractions).toBe('boolean');
    });
  });

  describe('Clinical scenarios', () => {
    it('should flag TB drug combination for LFT monitoring', () => {
      const currentMeds = ['Isoniazid', 'Rifampicin', 'Pyrazinamide'];
      const result = checkNewPrescription('Streptomycin', currentMeds);
      // Isoniazid + Rifampicin is a known serious interaction
      expect(result.interactions.length).toBeGreaterThan(0);
    });

    it('should alert before adding antibiotic to anticoagulant', () => {
      const currentMeds = ['Warfarin'];
      const result = checkNewPrescription('Amoxicillin', currentMeds);
      expect(result.hasInteractions).toBe(true);
      expect(result.highestSeverity).toBe('moderate');
    });

    it('should prevent dangerous NSAID + ACE inhibitor combination', () => {
      const currentMeds = ['Enalapril'];
      const result = checkNewPrescription('Ibuprofen', currentMeds);
      expect(result.hasInteractions).toBe(true);
      expect(result.highestSeverity).toBe('moderate');
    });

    it('should allow safe combinations', () => {
      const result = checkInteractions([
        'Paracetamol',
        'Amoxicillin',
        'Diazepam',
      ]);
      // Paracetamol has no interactions, Amoxicillin + Diazepam have none
      // (Only with warfarin and morphine respectively)
      expect(result.hasInteractions).toBe(false);
    });
  });
});
