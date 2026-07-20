// Header names are matched case/punctuation-insensitively against these aliases,
// so a differently-formatted census (different carrier export) still has a shot
// at auto-mapping instead of silently dropping columns.

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type MedDenVisionField =
  | "employeeNumber"
  | "employmentStatus"
  | "ssn"
  | "lastName"
  | "firstName"
  | "birthDate"
  | "gender"
  | "depLastName"
  | "depFirstName"
  | "depBirthDate"
  | "depGender"
  | "relationshipType"
  | "depSSN"
  | "hireDate"
  | "benPlanType"
  | "benPlanName"
  | "benPlanOption"
  | "baseSalary"
  | "postalCode";

export const MED_DEN_VISION_ALIASES: Record<MedDenVisionField, string[]> = {
  employeeNumber: ["employee number", "employee id", "emp id", "employee no"],
  employmentStatus: ["employment status name", "employment status"],
  ssn: ["employee ssn sin", "employee ssn", "ssn"],
  lastName: ["employee last name"],
  firstName: ["employee first name"],
  birthDate: ["employee birth date", "date of birth", "dob"],
  gender: ["employee gender"],
  depLastName: ["dependent beneficiary last name"],
  depFirstName: ["dependent beneficiary first name"],
  depBirthDate: ["dependent beneficiary birth date"],
  depGender: ["dependent beneficiary gender"],
  relationshipType: ["relationship type name", "relationship"],
  depSSN: [
    "dependent beneficiary social security number",
    "dependent ssn",
    "dependent social security number",
  ],
  hireDate: ["hire date"],
  benPlanType: ["ben plan type name", "plan type", "benefit type"],
  benPlanName: ["ben plan name", "plan name"],
  benPlanOption: ["ben plan option name", "plan option", "option name"],
  baseSalary: ["base salary", "salary"],
  postalCode: ["primary address postal code", "postal code", "zip", "zip code"],
};

export const MED_DEN_VISION_REQUIRED: MedDenVisionField[] = [
  "employeeNumber",
  "birthDate",
  "gender",
  "benPlanType",
  "benPlanOption",
];

export type LifeStdLtdField =
  | "memberName"
  | "memberSSN"
  | "memberId"
  | "memberClass"
  | "basicLifeVolume"
  | "ltdVolume"
  | "stdVolume"
  | "voluntaryADDVolume"
  | "voluntaryLifeVolume";

export const LIFE_STD_LTD_ALIASES: Record<LifeStdLtdField, string[]> = {
  memberName: ["member name"],
  memberSSN: ["member social", "member ssn", "social security number"],
  memberId: ["member id"],
  memberClass: ["class"],
  basicLifeVolume: [
    "basic term life volume",
    "basic life volume",
    "employer paid term life volume",
    "employer paid life volume",
  ],
  ltdVolume: ["ltd volume"],
  stdVolume: ["std volume"],
  voluntaryADDVolume: ["voluntary ad d volume", "voluntary add volume"],
  voluntaryLifeVolume: ["voluntary term life volume"],
};

export const LIFE_STD_LTD_REQUIRED: LifeStdLtdField[] = ["memberName", "memberSSN"];

export function buildColumnMap<Field extends string>(
  headerRow: (string | undefined)[],
  aliases: Record<Field, string[]>
): Partial<Record<Field, number>> {
  const normalizedAliases = Object.entries(aliases).map(([field, list]) => [
    field as Field,
    (list as string[]).map(normalizeHeader),
  ]) as [Field, string[]][];

  const map: Partial<Record<Field, number>> = {};

  headerRow.forEach((raw, index) => {
    if (!raw) return;
    const normalized = normalizeHeader(raw);
    for (const [field, aliasList] of normalizedAliases) {
      if (map[field] !== undefined) continue;
      if (aliasList.includes(normalized)) {
        map[field] = index;
      }
    }
  });

  return map;
}
