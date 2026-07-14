// Standard adult dosing presets for the most-used medicines (WHO Essential
// Medicines List aligned). Picking a drug in the consultation prescribe step
// auto-fills dose / route / frequency / duration so the clinician confirms
// rather than types. Route and frequency strings match the consultation's
// `routeOptions` / `frequencyOptions` exactly so the <select> shows the value.
//
// These are starting points for an adult; the clinician always reviews and can
// override (weight-based, paediatric, renal adjustment, etc.).

export type MedicationPreset = {
  dose: string;
  route: string;      // must be one of routeOptions
  frequency: string;  // must be one of frequencyOptions
  duration: string;
  atc?: string;       // WHO ATC class code (for class-based interaction logic)
};

// Keyed by a lowercase ingredient substring; the first key contained in the
// selected medication name wins. Order matters — put more specific keys first.
const PRESETS: [string, MedicationPreset][] = [
  // Antimalarials
  ['artemether-lumefantrine', { dose: '80/480 mg (4 tablets)', route: 'Oral', frequency: 'BD (Twice daily)', duration: '3 days', atc: 'P01BF01' }],
  ['artemether', { dose: '80/480 mg (4 tablets)', route: 'Oral', frequency: 'BD (Twice daily)', duration: '3 days', atc: 'P01BF01' }],
  ['artesunate', { dose: '2.4 mg/kg', route: 'IV', frequency: 'OD (Once daily)', duration: '3 days', atc: 'P01BE03' }],
  ['quinine', { dose: '10 mg/kg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '7 days', atc: 'P01BC01' }],
  // Antibiotics
  ['amoxicillin-clav', { dose: '625 mg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '7 days', atc: 'J01CR02' }],
  ['amoxicillin', { dose: '500 mg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '7 days', atc: 'J01CA04' }],
  ['azithromycin', { dose: '500 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '3 days', atc: 'J01FA10' }],
  ['ceftriaxone', { dose: '1 g', route: 'IV', frequency: 'OD (Once daily)', duration: '5 days', atc: 'J01DD04' }],
  ['ciprofloxacin', { dose: '500 mg', route: 'Oral', frequency: 'BD (Twice daily)', duration: '5 days', atc: 'J01MA02' }],
  ['metronidazole', { dose: '400 mg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '7 days', atc: 'J01XD01' }],
  ['doxycycline', { dose: '100 mg', route: 'Oral', frequency: 'BD (Twice daily)', duration: '7 days', atc: 'J01AA02' }],
  ['cotrimoxazole', { dose: '960 mg', route: 'Oral', frequency: 'BD (Twice daily)', duration: '5 days', atc: 'J01EE01' }],
  ['gentamicin', { dose: '5 mg/kg', route: 'IV', frequency: 'OD (Once daily)', duration: '5 days', atc: 'J01GB03' }],
  ['benzylpenicillin', { dose: '2 MU', route: 'IV', frequency: 'QDS (Four times daily)', duration: '7 days', atc: 'J01CE01' }],
  ['erythromycin', { dose: '500 mg', route: 'Oral', frequency: 'QDS (Four times daily)', duration: '7 days', atc: 'J01FA01' }],
  // Anti-TB
  ['rhze', { dose: '4 FDC tablets', route: 'Oral', frequency: 'OD (Once daily)', duration: '2 months', atc: 'J04AM06' }],
  ['isoniazid', { dose: '300 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '6 months', atc: 'J04AC01' }],
  ['rifampicin', { dose: '600 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '6 months', atc: 'J04AB02' }],
  // Analgesia / antipyretic
  ['paracetamol', { dose: '1 g', route: 'Oral', frequency: 'QDS (Four times daily)', duration: '5 days', atc: 'N02BE01' }],
  ['ibuprofen', { dose: '400 mg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '5 days', atc: 'M01AE01' }],
  ['diclofenac', { dose: '50 mg', route: 'Oral', frequency: 'BD (Twice daily)', duration: '5 days', atc: 'M01AB05' }],
  ['morphine', { dose: '5 mg', route: 'IV', frequency: 'PRN (As needed)', duration: 'As required', atc: 'N02AA01' }],
  ['tramadol', { dose: '50 mg', route: 'Oral', frequency: 'TDS (Three times daily)', duration: '5 days', atc: 'N02AX02' }],
  // GI / rehydration
  ['ors', { dose: '1 sachet in 1 L water', route: 'Oral', frequency: 'PRN (As needed)', duration: 'Until rehydrated', atc: 'A07CA' }],
  ['oral rehydration', { dose: '1 sachet in 1 L water', route: 'Oral', frequency: 'PRN (As needed)', duration: 'Until rehydrated', atc: 'A07CA' }],
  ['zinc', { dose: '20 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '10 days', atc: 'A12CB01' }],
  ['omeprazole', { dose: '20 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '14 days', atc: 'A02BC01' }],
  ['ondansetron', { dose: '4 mg', route: 'IV', frequency: 'TDS (Three times daily)', duration: '2 days', atc: 'A04AA01' }],
  // Chronic disease
  ['metformin', { dose: '500 mg', route: 'Oral', frequency: 'BD (Twice daily)', duration: '30 days', atc: 'A10BA02' }],
  ['amlodipine', { dose: '5 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'C08CA01' }],
  ['hydrochlorothiazide', { dose: '25 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'C03AA03' }],
  ['lisinopril', { dose: '10 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'C09AA03' }],
  ['atenolol', { dose: '50 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'C07AB03' }],
  // Respiratory
  ['salbutamol', { dose: '2 puffs (200 mcg)', route: 'Inhaled', frequency: 'PRN (As needed)', duration: 'As required', atc: 'R03AC02' }],
  ['prednisolone', { dose: '40 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '5 days', atc: 'H02AB06' }],
  // Haematinics / obstetric
  ['ferrous', { dose: '200 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'B03AA07' }],
  ['folic acid', { dose: '5 mg', route: 'Oral', frequency: 'OD (Once daily)', duration: '30 days', atc: 'B03BB01' }],
  ['oxytocin', { dose: '10 IU', route: 'IM', frequency: 'STAT (Immediately)', duration: 'Single dose', atc: 'H01BB02' }],
  ['magnesium sulfate', { dose: '4 g', route: 'IV', frequency: 'STAT (Immediately)', duration: 'Per protocol', atc: 'B05XA05' }],
  // Emergency / other
  ['diazepam', { dose: '10 mg', route: 'IV', frequency: 'PRN (As needed)', duration: 'As required', atc: 'N05BA01' }],
  ['hydrocortisone', { dose: '100 mg', route: 'IV', frequency: 'QDS (Four times daily)', duration: '2 days', atc: 'H02AB09' }],
  ['adrenaline', { dose: '0.5 mg (1:1000)', route: 'IM', frequency: 'STAT (Immediately)', duration: 'Single dose', atc: 'C01CA24' }],
];

/**
 * Return the standard-dose preset for a medication name, matched by ingredient
 * substring (case-insensitive). Returns undefined for unknown drugs so the
 * clinician fills the fields manually.
 */
export function presetForMedication(name: string): MedicationPreset | undefined {
  const n = (name || '').toLowerCase();
  for (const [key, preset] of PRESETS) {
    if (n.includes(key)) return preset;
  }
  return undefined;
}
