/**
 * Drug Interaction Checking Service
 *
 * Provides clinical decision support by checking for known dangerous
 * drug-drug interactions. Focused on medications commonly used in
 * South Sudanese hospitals.
 *
 * Interaction severity levels:
 * - CONTRAINDICATED: Must not be co-administered
 * - SERIOUS: May cause significant harm; consider alternatives
 * - MODERATE: Monitor closely; adjust dose if needed
 *
 * Based on WHO Essential Medicines interactions and BNF/BNFC guidelines.
 */

export type InteractionSeverity = 'contraindicated' | 'serious' | 'moderate';

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  clinicalAdvice: string;
}

export interface InteractionCheckResult {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  highestSeverity: InteractionSeverity | null;
}

// Normalized drug name lookup (lowercase, trimmed)
function normalize(name: string): string {
  return name.toLowerCase().trim();
}

// Known drug interactions database
// This covers the most clinically significant interactions for medications
// commonly available in South Sudanese hospital pharmacies.
const INTERACTION_DATABASE: DrugInteraction[] = [
  // === CONTRAINDICATED ===
  {
    drug1: 'methotrexate',
    drug2: 'cotrimoxazole',
    severity: 'contraindicated',
    description: 'Cotrimoxazole increases methotrexate toxicity by reducing renal clearance.',
    clinicalAdvice: 'Do NOT co-prescribe. Use alternative antibiotic.',
  },
  {
    drug1: 'warfarin',
    drug2: 'metronidazole',
    severity: 'contraindicated',
    description: 'Metronidazole significantly increases warfarin anticoagulant effect, risking haemorrhage.',
    clinicalAdvice: 'Avoid combination. If essential, reduce warfarin dose by 30-50% and monitor INR daily.',
  },
  {
    drug1: 'artemether-lumefantrine',
    drug2: 'quinine',
    severity: 'contraindicated',
    description: 'Both prolong QT interval; combined use risks fatal cardiac arrhythmia.',
    clinicalAdvice: 'Never co-administer. Wait at least 12 hours after quinine before starting AL.',
  },
  {
    drug1: 'ciprofloxacin',
    drug2: 'tizanidine',
    severity: 'contraindicated',
    description: 'Ciprofloxacin inhibits CYP1A2, dramatically increasing tizanidine levels.',
    clinicalAdvice: 'Do NOT co-prescribe. Use alternative muscle relaxant.',
  },

  // === SERIOUS ===
  {
    drug1: 'gentamicin',
    drug2: 'furosemide',
    severity: 'serious',
    description: 'Combined ototoxicity and nephrotoxicity. Hearing loss may be irreversible.',
    clinicalAdvice: 'Monitor renal function and hearing. Avoid if possible; if essential, use lowest effective doses.',
  },
  {
    drug1: 'morphine',
    drug2: 'diazepam',
    severity: 'serious',
    description: 'Combined respiratory depression; risk of respiratory arrest especially in malnourished patients.',
    clinicalAdvice: 'Use with extreme caution. Reduce doses. Have naloxone and flumazenil available.',
  },
  {
    drug1: 'amlodipine',
    drug2: 'simvastatin',
    severity: 'serious',
    description: 'Amlodipine increases simvastatin levels, increasing risk of rhabdomyolysis.',
    clinicalAdvice: 'Limit simvastatin to 20mg daily when co-prescribed with amlodipine.',
  },
  {
    drug1: 'metformin',
    drug2: 'contrast dye',
    severity: 'serious',
    description: 'Risk of lactic acidosis with iodinated contrast media.',
    clinicalAdvice: 'Withhold metformin 48h before and after contrast administration. Check renal function.',
  },
  {
    drug1: 'insulin',
    drug2: 'ciprofloxacin',
    severity: 'serious',
    description: 'Fluoroquinolones can cause both hypo- and hyperglycaemia.',
    clinicalAdvice: 'Monitor blood glucose closely. Adjust insulin doses as needed.',
  },
  {
    drug1: 'isoniazid',
    drug2: 'rifampicin',
    severity: 'serious',
    description: 'Both are hepatotoxic. Combined use increases risk of drug-induced liver injury.',
    clinicalAdvice: 'Standard TB treatment — monitor LFTs baseline and monthly. Stop if ALT >5x ULN.',
  },
  {
    drug1: 'phenobarbitone',
    drug2: 'artemether-lumefantrine',
    severity: 'serious',
    description: 'Phenobarbitone induces CYP3A4, reducing lumefantrine levels and antimalarial efficacy.',
    clinicalAdvice: 'Consider artesunate monotherapy or quinine for epileptic patients on phenobarbitone.',
  },
  {
    drug1: 'magnesium sulfate',
    drug2: 'gentamicin',
    severity: 'serious',
    description: 'Additive neuromuscular blockade; risk of respiratory paralysis.',
    clinicalAdvice: 'Avoid if possible. If co-administration required, monitor closely for respiratory depression.',
  },

  // === MODERATE ===
  {
    drug1: 'amoxicillin',
    drug2: 'warfarin',
    severity: 'moderate',
    description: 'Amoxicillin may enhance anticoagulant effect of warfarin.',
    clinicalAdvice: 'Monitor INR more frequently during antibiotic course.',
  },
  {
    drug1: 'ibuprofen',
    drug2: 'enalapril',
    severity: 'moderate',
    description: 'NSAIDs reduce antihypertensive effect and increase nephrotoxicity risk.',
    clinicalAdvice: 'Use paracetamol as alternative analgesic. If NSAID needed, monitor BP and renal function.',
  },
  {
    drug1: 'ciprofloxacin',
    drug2: 'iron folate',
    severity: 'moderate',
    description: 'Iron chelates ciprofloxacin, reducing its absorption and efficacy.',
    clinicalAdvice: 'Give ciprofloxacin 2 hours before or 6 hours after iron supplements.',
  },
  {
    drug1: 'doxycycline',
    drug2: 'iron folate',
    severity: 'moderate',
    description: 'Iron reduces doxycycline absorption.',
    clinicalAdvice: 'Separate doses by at least 2-3 hours.',
  },
  {
    drug1: 'metformin',
    drug2: 'enalapril',
    severity: 'moderate',
    description: 'ACE inhibitors may increase risk of hypoglycaemia.',
    clinicalAdvice: 'Monitor blood glucose, especially when starting or adjusting ACE inhibitor.',
  },
  {
    drug1: 'diclofenac',
    drug2: 'ciprofloxacin',
    severity: 'moderate',
    description: 'Increased risk of seizures with NSAID + fluoroquinolone combination.',
    clinicalAdvice: 'Use paracetamol instead if possible. Avoid in patients with seizure history.',
  },
  {
    drug1: 'oral rehydration salts',
    drug2: 'ciprofloxacin',
    severity: 'moderate',
    description: 'Minerals in ORS can chelate ciprofloxacin, reducing absorption.',
    clinicalAdvice: 'Give ciprofloxacin 2h before ORS or 2h after.',
  },
];

/**
 * Check for drug interactions between a list of medications.
 */
export function checkInteractions(medications: string[]): InteractionCheckResult {
  if (!medications || medications.length < 2) {
    return { hasInteractions: false, interactions: [], highestSeverity: null };
  }

  const normalized = medications.map(normalize);
  const found: DrugInteraction[] = [];

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const med1 = normalized[i];
      const med2 = normalized[j];

      for (const interaction of INTERACTION_DATABASE) {
        const d1 = normalize(interaction.drug1);
        const d2 = normalize(interaction.drug2);

        // Check both directions: (med1↔d1, med2↔d2) or (med1↔d2, med2↔d1)
        if (
          (med1.includes(d1) && med2.includes(d2)) ||
          (med1.includes(d2) && med2.includes(d1)) ||
          (d1.includes(med1) && d2.includes(med2)) ||
          (d1.includes(med2) && d2.includes(med1))
        ) {
          // Avoid duplicate entries
          const key = `${interaction.drug1}|${interaction.drug2}`;
          if (!found.some(f => `${f.drug1}|${f.drug2}` === key)) {
            found.push(interaction);
          }
        }
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<InteractionSeverity, number> = {
    contraindicated: 0,
    serious: 1,
    moderate: 2,
  };
  found.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    hasInteractions: found.length > 0,
    interactions: found,
    highestSeverity: found.length > 0 ? found[0].severity : null,
  };
}

/**
 * Check a new prescription against a patient's existing medications.
 * Returns any interactions found between the new drug and current meds.
 */
export function checkNewPrescription(
  newMedication: string,
  currentMedications: string[]
): InteractionCheckResult {
  return checkInteractions([newMedication, ...currentMedications]);
}

/**
 * Get all known interactions for a specific medication.
 */
export function getInteractionsForDrug(medication: string): DrugInteraction[] {
  const med = normalize(medication);
  return INTERACTION_DATABASE.filter(i =>
    normalize(i.drug1).includes(med) || normalize(i.drug2).includes(med) ||
    med.includes(normalize(i.drug1)) || med.includes(normalize(i.drug2))
  );
}
