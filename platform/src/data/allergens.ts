/**
 * Common allergens for the Add Allergy type-ahead. Not a coded reference
 * system (allergies aren't ICD-coded) — `classification` doubles as the
 * badge shown in the dropdown and auto-fills the classification select
 * when a clinician picks a listed substance. Free-text entry (anything not
 * in this list) is still allowed — real patients have idiosyncratic
 * allergies no fixed list will ever fully cover.
 */

export type AllergenClassification = 'drug' | 'food' | 'environmental' | 'biologic' | 'other';

export interface Allergen {
  substance: string;
  classification: AllergenClassification;
}

export const COMMON_ALLERGENS: Allergen[] = [
  // Drug
  { substance: 'Penicillin', classification: 'drug' },
  { substance: 'Amoxicillin', classification: 'drug' },
  { substance: 'Sulfa drugs (sulfonamides)', classification: 'drug' },
  { substance: 'Aspirin', classification: 'drug' },
  { substance: 'NSAIDs (ibuprofen, diclofenac)', classification: 'drug' },
  { substance: 'Cephalosporins', classification: 'drug' },
  { substance: 'Tetracycline', classification: 'drug' },
  { substance: 'Quinine', classification: 'drug' },
  { substance: 'Sulfadoxine-pyrimethamine', classification: 'drug' },
  { substance: 'Iodine / contrast dye', classification: 'drug' },
  { substance: 'Local anaesthetics (lidocaine)', classification: 'drug' },
  { substance: 'ACE inhibitors', classification: 'drug' },
  { substance: 'Codeine', classification: 'drug' },
  // Food
  { substance: 'Peanuts', classification: 'food' },
  { substance: 'Tree nuts', classification: 'food' },
  { substance: 'Shellfish', classification: 'food' },
  { substance: 'Fish', classification: 'food' },
  { substance: 'Eggs', classification: 'food' },
  { substance: 'Milk / dairy', classification: 'food' },
  { substance: 'Soy', classification: 'food' },
  { substance: 'Wheat / gluten', classification: 'food' },
  // Environmental
  { substance: 'Latex', classification: 'environmental' },
  { substance: 'Pollen', classification: 'environmental' },
  { substance: 'Dust mites', classification: 'environmental' },
  { substance: 'Mould', classification: 'environmental' },
  { substance: 'Animal dander', classification: 'environmental' },
  { substance: 'Insect stings (bee, wasp)', classification: 'environmental' },
  // Biologic
  { substance: 'Blood products', classification: 'biologic' },
  { substance: 'Vaccines (egg-based)', classification: 'biologic' },
];
