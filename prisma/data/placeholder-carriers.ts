// Placeholder carrier names, used only so the "Carrier" autocomplete has
// something to suggest before the real list is supplied. Replace or extend
// this list (and re-run `npm run db:seed`) once the actual carriers per
// benefit type are known.
export const PLACEHOLDER_CARRIERS: Record<string, string[]> = {
  Medical: ["Aetna", "Cigna", "UnitedHealthcare", "Blue Cross Blue Shield", "Kaiser Permanente"],
  Dental: ["Delta Dental", "MetLife", "Guardian", "Principal"],
  Vision: ["VSP", "EyeMed", "Davis Vision"],
  BasicLife: ["The Standard", "Unum", "Lincoln Financial Group", "MetLife"],
  VoluntaryLife: ["The Standard", "Unum", "Lincoln Financial Group", "MetLife"],
  STD: ["The Standard", "Unum", "The Hartford"],
  LTD: ["The Standard", "Unum", "The Hartford"],
  VoluntaryOfferings: ["Aflac", "Colonial Life", "Allstate"],
};
