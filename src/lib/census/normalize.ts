import {
  buildColumnMap,
  LIFE_STD_LTD_ALIASES,
  LIFE_STD_LTD_REQUIRED,
  MED_DEN_VISION_ALIASES,
  MED_DEN_VISION_REQUIRED,
  type LifeStdLtdField,
  type MedDenVisionField,
} from "./headerAliases";
import type { ParsedSheet, RawRow } from "./parseWorkbook";

export type NormalizedDependent = {
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  gender?: string;
  relationshipType?: string;
};

export type NormalizedElection = {
  benefitType: string;
  planName?: string;
  optionName?: string;
  volume?: number;
};

export type NormalizedEmployee = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  birthDate?: Date;
  gender?: string;
  hireDate?: Date;
  employmentStatus?: string;
  baseSalary?: number;
  postalCode?: string;
  state?: string;
  dependents: NormalizedDependent[];
  elections: NormalizedElection[];
};

export type CensusNormalizeResult = {
  employees: NormalizedEmployee[];
  warnings: string[];
  blocking: boolean;
  summary: {
    employeeCount: number;
    dependentCount: number;
    electionCount: number;
    matchedAncillaryCount: number;
    unmatchedAncillaryCount: number;
  };
};

function digitsOnly(value: string | number | Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  const digits = String(value).replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

function toStr(value: string | number | Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

function toDate(value: string | number | Date | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function toNumber(value: string | number | Date | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(parsed) ? undefined : parsed;
}

function getCell<Field extends string>(
  row: RawRow,
  colMap: Partial<Record<Field, number>>,
  field: Field
): string | number | Date | undefined {
  const idx = colMap[field];
  if (idx === undefined) return undefined;
  return row[idx];
}

function classifyCoverageType(
  benPlanType?: string,
  benPlanName?: string,
  benPlanOption?: string
): string {
  const text = `${benPlanName ?? ""} ${benPlanOption ?? ""}`.toLowerCase();
  if (text.includes("dental")) return "Dental";
  if (text.includes("vision")) return "Vision";
  if (text.includes("medical")) return "Medical";
  if (benPlanType && benPlanType.toLowerCase() === "health") return "Medical";
  return benPlanType && benPlanType.trim().length > 0 ? benPlanType : "Other";
}

function dependentKey(dep: NormalizedDependent): string {
  return [
    dep.firstName?.toLowerCase() ?? "",
    dep.lastName?.toLowerCase() ?? "",
    dep.birthDate?.toISOString() ?? "",
    dep.relationshipType?.toLowerCase() ?? "",
  ].join("|");
}

function findSheet(sheets: ParsedSheet[], nameHint: RegExp): ParsedSheet | undefined {
  return sheets.find((s) => nameHint.test(s.name));
}

export function normalizeCensus(sheets: ParsedSheet[]): CensusNormalizeResult {
  const warnings: string[] = [];

  const medSheet =
    findSheet(sheets, /med|dental|vision/i) ??
    sheets.find((s) => {
      const map = buildColumnMap(s.headerRow, MED_DEN_VISION_ALIASES);
      return MED_DEN_VISION_REQUIRED.every((f) => map[f] !== undefined);
    });

  if (!medSheet) {
    return {
      employees: [],
      warnings: ["Could not find a medical/dental/vision census sheet in the uploaded file."],
      blocking: true,
      summary: {
        employeeCount: 0,
        dependentCount: 0,
        electionCount: 0,
        matchedAncillaryCount: 0,
        unmatchedAncillaryCount: 0,
      },
    };
  }

  const medColMap = buildColumnMap<MedDenVisionField>(medSheet.headerRow, MED_DEN_VISION_ALIASES);
  const missingRequired = MED_DEN_VISION_REQUIRED.filter((f) => medColMap[f] === undefined);
  if (missingRequired.length > 0) {
    return {
      employees: [],
      warnings: [
        `The census sheet "${medSheet.name}" is missing required column(s): ${missingRequired.join(", ")}.`,
      ],
      blocking: true,
      summary: {
        employeeCount: 0,
        dependentCount: 0,
        electionCount: 0,
        matchedAncillaryCount: 0,
        unmatchedAncillaryCount: 0,
      },
    };
  }

  type EmployeeAccumulator = NormalizedEmployee & {
    dependentKeys: Set<string>;
    ssn?: string;
  };

  const employeesByNumber = new Map<string, EmployeeAccumulator>();

  let electionCount = 0;
  let dependentCount = 0;
  let rowsMissingBirthDate = 0;
  let rowsMissingEmployeeNumber = 0;

  for (const row of medSheet.dataRows) {
    const employeeNumber = toStr(getCell(row, medColMap, "employeeNumber"));
    if (!employeeNumber) {
      rowsMissingEmployeeNumber++;
      continue;
    }

    let employee = employeesByNumber.get(employeeNumber);
    if (!employee) {
      const birthDate = toDate(getCell(row, medColMap, "birthDate"));
      if (!birthDate) rowsMissingBirthDate++;

      employee = {
        employeeNumber,
        firstName: toStr(getCell(row, medColMap, "firstName")) ?? "",
        lastName: toStr(getCell(row, medColMap, "lastName")) ?? "",
        birthDate,
        gender: toStr(getCell(row, medColMap, "gender")),
        hireDate: toDate(getCell(row, medColMap, "hireDate")),
        employmentStatus: toStr(getCell(row, medColMap, "employmentStatus")),
        baseSalary: toNumber(getCell(row, medColMap, "baseSalary")),
        postalCode: toStr(getCell(row, medColMap, "postalCode")),
        state: toStr(getCell(row, medColMap, "state")),
        dependents: [],
        elections: [],
        dependentKeys: new Set(),
        ssn: digitsOnly(getCell(row, medColMap, "ssn")),
      };
      employeesByNumber.set(employeeNumber, employee);
    }

    const benPlanType = toStr(getCell(row, medColMap, "benPlanType"));
    const benPlanName = toStr(getCell(row, medColMap, "benPlanName"));
    const benPlanOption = toStr(getCell(row, medColMap, "benPlanOption"));
    if (benPlanOption || benPlanName) {
      employee.elections.push({
        benefitType: classifyCoverageType(benPlanType, benPlanName, benPlanOption),
        planName: benPlanName,
        optionName: benPlanOption,
      });
      electionCount++;
    }

    const depFirstName = toStr(getCell(row, medColMap, "depFirstName"));
    const depLastName = toStr(getCell(row, medColMap, "depLastName"));
    if (depFirstName || depLastName) {
      const dependent: NormalizedDependent = {
        firstName: depFirstName,
        lastName: depLastName,
        birthDate: toDate(getCell(row, medColMap, "depBirthDate")),
        gender: toStr(getCell(row, medColMap, "depGender")),
        relationshipType: toStr(getCell(row, medColMap, "relationshipType")),
      };
      const key = dependentKey(dependent);
      if (!employee.dependentKeys.has(key)) {
        employee.dependentKeys.add(key);
        employee.dependents.push(dependent);
        dependentCount++;
      }
    }
  }

  if (rowsMissingEmployeeNumber > 0) {
    warnings.push(
      `${rowsMissingEmployeeNumber} row(s) had no employee number and were skipped.`
    );
  }
  if (rowsMissingBirthDate > 0) {
    warnings.push(`${rowsMissingBirthDate} employee(s) are missing a birth date.`);
  }

  let matchedAncillaryCount = 0;
  let unmatchedAncillaryCount = 0;

  const lifeSheet = findSheet(sheets, /life|std|ltd/i);
  if (lifeSheet) {
    const lifeColMap = buildColumnMap<LifeStdLtdField>(
      lifeSheet.headerRow,
      LIFE_STD_LTD_ALIASES
    );
    const missingLifeRequired = LIFE_STD_LTD_REQUIRED.filter(
      (f) => lifeColMap[f] === undefined
    );

    if (missingLifeRequired.length > 0) {
      warnings.push(
        `The ancillary (Life/STD/LTD) sheet "${lifeSheet.name}" is missing required column(s): ${missingLifeRequired.join(", ")} — ancillary volumes were not imported.`
      );
    } else {
      const bySSN = new Map<string, EmployeeAccumulator>();
      for (const employee of employeesByNumber.values()) {
        if (employee.ssn) bySSN.set(employee.ssn, employee);
      }

      for (const row of lifeSheet.dataRows) {
        const ssn = digitsOnly(getCell(row, lifeColMap, "memberSSN"));
        const employee = ssn ? bySSN.get(ssn) : undefined;

        if (!employee) {
          unmatchedAncillaryCount++;
          continue;
        }
        matchedAncillaryCount++;

        const volumeFields: { field: LifeStdLtdField; benefitType: string }[] = [
          { field: "basicLifeVolume", benefitType: "Life" },
          { field: "ltdVolume", benefitType: "LTD" },
          { field: "stdVolume", benefitType: "STD" },
          { field: "voluntaryADDVolume", benefitType: "VoluntaryAD&D" },
          { field: "voluntaryLifeVolume", benefitType: "VoluntaryLife" },
        ];

        for (const { field, benefitType } of volumeFields) {
          const volume = toNumber(getCell(row, lifeColMap, field));
          if (volume !== undefined && volume > 0) {
            employee.elections.push({ benefitType, volume });
            electionCount++;
          }
        }
      }
    }

    if (unmatchedAncillaryCount > 0) {
      warnings.push(
        `${unmatchedAncillaryCount} row(s) in the ancillary sheet could not be matched to an employee by SSN.`
      );
    }
  } else {
    warnings.push("No Life/STD/LTD sheet found — ancillary volumes were not imported.");
  }

  const employees: NormalizedEmployee[] = Array.from(employeesByNumber.values()).map(
    (accumulator) => ({
      employeeNumber: accumulator.employeeNumber,
      firstName: accumulator.firstName,
      lastName: accumulator.lastName,
      birthDate: accumulator.birthDate,
      gender: accumulator.gender,
      hireDate: accumulator.hireDate,
      employmentStatus: accumulator.employmentStatus,
      baseSalary: accumulator.baseSalary,
      postalCode: accumulator.postalCode,
      state: accumulator.state,
      dependents: accumulator.dependents,
      elections: accumulator.elections,
    })
  );

  return {
    employees,
    warnings,
    blocking: false,
    summary: {
      employeeCount: employees.length,
      dependentCount,
      electionCount,
      matchedAncillaryCount,
      unmatchedAncillaryCount,
    },
  };
}
