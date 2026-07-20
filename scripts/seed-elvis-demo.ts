import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { CHART_DEFINITIONS } from "../src/lib/charts/catalog";

const CLIENT_ID = "cmro9n9u50001juuj3cz51f5v";
const CLIENT_NAME = "Elvis Presley Enterprises, Inc. Dba Graceland";
const CURRENT_PLAN_YEAR_ID = "cmro9r3j80002juuju74ydroj";
const YEARS = [2024, 2025, 2026] as const;
type DemoYear = (typeof YEARS)[number];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const firstNames = [
  "Avery", "Jordan", "Morgan", "Cameron", "Riley", "Taylor", "Parker", "Casey",
  "Reese", "Quinn", "Drew", "Hayden", "Emerson", "Rowan", "Skyler", "Logan",
  "Sydney", "Blair", "Dakota", "Jamie", "Kendall", "Sage", "Alex", "Charlie", "Finley",
];

const lastNames = [
  "Adams", "Bennett", "Carter", "Davis", "Ellis", "Foster", "Garcia", "Harris",
  "Irwin", "Johnson", "King", "Lewis", "Mitchell", "Nelson", "Owens", "Price",
  "Reed", "Scott", "Turner", "Underwood", "Vasquez", "Walker", "Young", "Brooks", "Cooper",
];

const postalCodes = [
  "38116", "38103", "38117", "38104", "38017", "38018", "37203", "37219",
  "72201", "30303", "75201", "32801",
];

const planYearIds: Record<DemoYear, string> = {
  2024: "demo-elvis-plan-year-2024",
  2025: "demo-elvis-plan-year-2025",
  2026: CURRENT_PLAN_YEAR_ID,
};

const activeEmployeeIndexes: Record<DemoYear, number[]> = {
  2024: sequence(1, 240),
  2025: [...sequence(1, 228), ...sequence(241, 264)],
  2026: [...sequence(1, 216), ...sequence(241, 258), ...sequence(265, 295)],
};

const inflation: Record<DemoYear, number> = {
  2024: 1,
  2025: 1.064,
  2026: 1.132,
};

const employeeInflation: Record<DemoYear, number> = {
  2024: 1,
  2025: 1.035,
  2026: 1.075,
};

async function main() {
  const target = await prisma.client.findUnique({
    where: { id: CLIENT_ID },
    select: { id: true, name: true, createdById: true },
  });

  if (!target || target.name !== CLIENT_NAME) {
    throw new Error("The exact Elvis/Graceland test client was not found; no data was changed.");
  }

  const summary = await prisma.$transaction(
    async (tx) => {
      await updateClientIntake(tx, target.createdById);
      await ensurePlanYears(tx);
      await clearDemoPlanYearData(tx);

      for (const year of YEARS) {
        await createPolicyPrograms(tx, year);
        await createCensus(tx, year);
        await saveDeckSelections(tx, year);
      }

      await saveBenchmarkProfile(tx);

      return Promise.all(
        YEARS.map(async (year) => ({
          year,
          planYearId: planYearIds[year],
          employees: await tx.employee.count({ where: { planYearId: planYearIds[year] } }),
          dependents: await tx.dependent.count({
            where: { employee: { planYearId: planYearIds[year] } },
          }),
          elections: await tx.benefitElection.count({
            where: { employee: { planYearId: planYearIds[year] } },
          }),
          programs: await tx.benefitProgram.count({ where: { planYearId: planYearIds[year] } }),
          plans: await tx.benefitPlan.count({
            where: { benefitProgram: { planYearId: planYearIds[year] } },
          }),
          rates: await tx.planRate.count({
            where: { benefitPlan: { benefitProgram: { planYearId: planYearIds[year] } } },
          }),
        }))
      );
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  console.log(JSON.stringify({ clientId: CLIENT_ID, planYears: summary }, null, 2));
}

async function updateClientIntake(tx: Prisma.TransactionClient, createdById: string | null) {
  await tx.client.update({
    where: { id: CLIENT_ID },
    data: {
      primaryColor: "#111111",
      secondaryColor: "#C9A227",
      profile: {
        upsert: {
          create: clientProfile,
          update: clientProfile,
        },
      },
    },
  });

  await tx.clientContact.deleteMany({ where: { clientId: CLIENT_ID } });
  await tx.clientContact.createMany({
    data: [
      {
        clientId: CLIENT_ID,
        name: "Jamie Carter",
        title: "Vice President, People & Culture",
        email: "jamie.carter@example.test",
        phone: "901-555-0101",
        roles: ["Primary Benefits Contact", "Authorized Signer"],
        notes: "Fictional contact created for the Benefit HQ demonstration client.",
        sortOrder: 0,
      },
      {
        clientId: CLIENT_ID,
        name: "Morgan Reed",
        title: "Director of Finance",
        email: "morgan.reed@example.test",
        phone: "901-555-0102",
        roles: ["Finance Contact", "Accounts Payable Contact"],
        notes: "Fictional contact created for the Benefit HQ demonstration client.",
        sortOrder: 1,
      },
      {
        clientId: CLIENT_ID,
        name: "Taylor Brooks",
        title: "Payroll and Benefits Manager",
        email: "taylor.brooks@example.test",
        phone: "901-555-0103",
        roles: ["Payroll Contact", "Legal / Compliance Contact"],
        notes: "Fictional contact created for the Benefit HQ demonstration client.",
        sortOrder: 2,
      },
    ],
  });

  await tx.clientLocation.deleteMany({ where: { clientId: CLIENT_ID } });
  await tx.clientLocation.createMany({
    data: [
      {
        clientId: CLIENT_ID,
        name: "Graceland Headquarters",
        line1: "3764 Elvis Presley Boulevard",
        city: "Memphis",
        state: "TN",
        postalCode: "38116",
        country: "United States",
        isHeadquarters: true,
        employeeCount: 190,
        sortOrder: 0,
      },
      {
        clientId: CLIENT_ID,
        name: "Memphis Operations Center",
        line1: "Demo Location — 100 Operations Way",
        city: "Memphis",
        state: "TN",
        postalCode: "38103",
        country: "United States",
        isHeadquarters: false,
        employeeCount: 50,
        sortOrder: 1,
      },
      {
        clientId: CLIENT_ID,
        name: "Remote and Regional Team",
        line1: "Demo Location — Distributed Workforce",
        city: "Nashville",
        state: "TN",
        postalCode: "37203",
        country: "United States",
        isHeadquarters: false,
        employeeCount: 25,
        sortOrder: 2,
      },
    ],
  });

  await tx.clientEntity.deleteMany({ where: { clientId: CLIENT_ID } });
  await tx.clientEntity.createMany({
    data: [
      {
        clientId: CLIENT_ID,
        legalName: CLIENT_NAME,
        taxIdLastFour: "0001",
        notes: "Fictional final-four tax identifier for demonstration data only.",
        sortOrder: 0,
      },
    ],
  });

  await tx.clientPriority.deleteMany({ where: { clientId: CLIENT_ID } });
  await tx.clientPriority.createMany({
    data: [
      {
        clientId: CLIENT_ID,
        objective: "Reduce overall benefit cost",
        rank: 1,
        currentState: "Medical trend is above the desired budget corridor.",
        desiredOutcome: "Keep total renewal increase below 8% without reducing core benefits.",
        measurementKpi: "Annual employer medical cost and renewal percentage",
        notes: "Use national and size-peer Mercer context in the renewal discussion.",
      },
      {
        clientId: CLIENT_ID,
        objective: "Improve employee contributions",
        rank: 2,
        currentState: "Dependent tiers require a larger employee contribution than employee-only coverage.",
        desiredOutcome: "Maintain affordability while making the tier strategy more consistent.",
        measurementKpi: "Employer-paid percentage by tier",
      },
      {
        clientId: CLIENT_ID,
        objective: "Improve reporting and analytics",
        rank: 3,
        currentState: "Renewal decisions have historically relied on disconnected spreadsheets.",
        desiredOutcome: "Create a repeatable census, policy, and benchmark reporting process.",
        measurementKpi: "Complete matched census and policy data each plan year",
      },
    ],
  });

  if (createdById) {
    await tx.clientTeamAssignment.upsert({
      where: { clientId_role: { clientId: CLIENT_ID, role: "Lead Consultant" } },
      create: { clientId: CLIENT_ID, userId: createdById, role: "Lead Consultant" },
      update: { userId: createdById },
    });
  }
}

const clientProfile = {
  legalName: CLIENT_NAME,
  website: "https://www.graceland.com",
  primaryIndustry: "Hospitality & Leisure",
  secondaryIndustry: "Media & Entertainment",
  industryCode: "713110",
  ownershipType: "Privately Held",
  parentCompany: "Demo client — no parent company recorded",
  privateEquitySponsor: null,
  fiscalYearEndMonth: 12,
  fiscalYearEndDay: 31,
  primaryRenewalMonth: 7,
  primaryRenewalDay: 1,
  usEmployeeCount: 265,
  globalEmployeeCount: 265,
  benefitsEligibleCount: 265,
  enrolledEmployeeCount: 240,
  entityStructure: "Single Entity",
  numberOfEins: 1,
  benefitsConsistentAcrossEntities: true,
  hasUnionPopulation: false,
  hasCollectivelyBargainedPlans: false,
  hasAcquiredCompanies: false,
  hasInternationalEmployees: false,
  workforceTypes: ["Seasonal", "Part-Time"],
  coveredThroughPeo: false,
  statesWithEmployees: ["TN", "AR", "GA", "TX", "FL"],
  remoteEmployeePercentage: 9.43,
  benefitChallenges:
    "Managing medical trend, maintaining affordable dependent coverage, and presenting a clear multi-year benefit strategy to leadership.",
  renewalSuccessOutcomes:
    "A renewal below the 8% maximum, no carrier disruption, stable plan participation, and a clear company-versus-market story.",
  budgetTarget: 4_150_000,
  maximumAcceptableIncrease: 8,
  disruptionTolerance: "Minimal Disruption",
  excludedCarriers: ["Demo Excluded Carrier"],
  acquisitionsExpected: false,
  headcountChangesExpected: true,
  harmonizationUnderway: false,
  preparingForTransaction: false,
};

async function ensurePlanYears(tx: Prisma.TransactionClient) {
  for (const year of YEARS) {
    const id = planYearIds[year];
    const label = `${year} Plan Year`;
    const effectiveDate = utcDate(year, 6, 1);

    if (year === 2026) {
      await tx.planYear.update({
        where: { id },
        data: { label, effectiveDate },
      });
    } else {
      await tx.planYear.upsert({
        where: { id },
        create: { id, clientId: CLIENT_ID, label, effectiveDate },
        update: { clientId: CLIENT_ID, label, effectiveDate },
      });
    }
  }
}

async function clearDemoPlanYearData(tx: Prisma.TransactionClient) {
  const ids = YEARS.map((year) => planYearIds[year]);
  await tx.benefitProgram.deleteMany({ where: { planYearId: { in: ids } } });
  await tx.policyLine.deleteMany({ where: { planYearId: { in: ids } } });
  await tx.employee.deleteMany({ where: { planYearId: { in: ids } } });
  await tx.censusUpload.deleteMany({ where: { planYearId: { in: ids } } });
}

async function createPolicyPrograms(tx: Prisma.TransactionClient, year: DemoYear) {
  const programs = policyPrograms(year);
  for (const [programIndex, program] of programs.entries()) {
    await tx.benefitProgram.create({
      data: {
        id: programId(year, program.key),
        planYearId: planYearIds[year],
        benefitType: program.benefitType,
        offered: true,
        sortOrder: (programIndex + 1) * 10,
        plans: {
          create: program.plans.map((plan, planIndex) => ({
            id: planId(year, plan.key),
            name: plan.name,
            subtype: plan.subtype,
            offered: true,
            details: plan.details as Prisma.InputJsonValue,
            detailSchemaVersion: 1,
            renewedFromPlanId: year === 2024 ? null : planId((year - 1) as DemoYear, plan.key),
            sortOrder: planIndex * 10,
            rates: {
              create: plan.rates.map((rate, rateIndex) => ({
                tier: rate.tier,
                grossPremium: rate.grossPremium,
                employeeContribution: rate.employeeContribution,
                employerContribution: roundCurrency(
                  rate.grossPremium - rate.employeeContribution
                ),
                ratePeriod: "monthly",
                enrollmentOverride: null,
                sortOrder: rateIndex * 10,
              })),
            },
            aliases: {
              create: plan.aliases.map((alias) => ({
                alias,
                normalizedAlias: normalizeName(alias),
              })),
            },
          })),
        },
      },
    });
  }
}

type DemoRate = { tier: string; grossPremium: number; employeeContribution: number };
type DemoPlan = {
  key: string;
  name: string;
  subtype: string;
  details: Record<string, string | number | boolean | null>;
  aliases: string[];
  rates: DemoRate[];
};

function policyPrograms(year: DemoYear): Array<{
  key: string;
  benefitType: string;
  plans: DemoPlan[];
}> {
  const stopLoss = year === 2024 ? 175_000 : year === 2025 ? 200_000 : 225_000;
  const medicalFunding = {
    fundingArrangement: "Self-Funded",
    islDeductible: stopLoss,
    aggregatingSpecific: year === 2024 ? 50_000 : 75_000,
    aggregateCorridor: 125,
    islCompositeRate: roundCurrency(88 * inflation[year]),
    aslCompositeRate: roundCurrency(9.5 * inflation[year]),
  };

  return [
    {
      key: "medical",
      benefitType: "Medical",
      plans: [
        {
          key: "medical-ppo-500",
          name: "PPO 500",
          subtype: "PPO",
          aliases: ["BCBST PPO 500", "PPO500"],
          details: {
            ...medicalFunding,
            actuarialValue: year === 2024 ? 87 : 86,
            deductibleIndividual: year === 2024 ? 500 : 750,
            deductibleFamily: year === 2024 ? 1_000 : 1_500,
            memberCoinsurance: 20,
            oopMaximumIndividual: year === 2024 ? 3_500 : year === 2025 ? 3_750 : 4_000,
            oopMaximumFamily: year === 2024 ? 7_000 : year === 2025 ? 7_500 : 8_000,
            primaryCareCopay: year === 2024 ? 25 : 30,
            specialistCopay: year === 2024 ? 45 : 50,
            urgentCareCopay: 75,
            emergencyRoomCopay: 250,
            genericCopay: 10,
            formularyBrandCopay: year === 2024 ? 35 : 40,
            nonFormularyBrandCopay: year === 2024 ? 60 : 65,
            specialtyCopay: 150,
          },
          rates: medicalRates(year, [
            ["EE", 675, 135],
            ["EE+Spouse", 1_420, 426],
            ["EE+Child", 1_215, 364.5],
            ["Family", 2_035, 712.25],
          ]),
        },
        {
          key: "medical-hdhp-2000",
          name: "HDHP 2000",
          subtype: "HDHP",
          aliases: ["BCBST HDHP 2000", "HSA 2000"],
          details: {
            ...medicalFunding,
            actuarialValue: 79,
            deductibleIndividual: year === 2024 ? 2_000 : year === 2025 ? 2_200 : 2_300,
            deductibleFamily: year === 2024 ? 4_000 : year === 2025 ? 4_400 : 4_600,
            memberCoinsurance: 20,
            oopMaximumIndividual: year === 2024 ? 5_000 : year === 2025 ? 5_250 : 5_500,
            oopMaximumFamily: year === 2024 ? 10_000 : year === 2025 ? 10_500 : 11_000,
            hsaContributionEE: year === 2024 ? 650 : year === 2025 ? 700 : 750,
            hsaContributionSpouse: year === 2024 ? 1_000 : year === 2025 ? 1_100 : 1_200,
            hsaContributionChild: year === 2024 ? 1_000 : year === 2025 ? 1_100 : 1_200,
            hsaContributionFamily: year === 2024 ? 1_300 : year === 2025 ? 1_400 : 1_500,
          },
          rates: medicalRates(year, [
            ["EE", 580, 87],
            ["EE+Spouse", 1_200, 300],
            ["EE+Child", 1_040, 260],
            ["Family", 1_740, 522],
          ]),
        },
      ],
    },
    {
      key: "dental",
      benefitType: "Dental",
      plans: [
        {
          key: "dental-dppo",
          name: "Dental DPPO",
          subtype: "DPPO",
          aliases: ["Delta Dental DPPO", "Dental PPO"],
          details: {
            deductibleIndividual: 50,
            deductibleFamily: 150,
            preventiveCoinsurance: 100,
            basicCoinsurance: 80,
            majorCoinsurance: 50,
            annualMaximum: year === 2024 ? 1_500 : year === 2025 ? 1_750 : 2_000,
            orthodontiaOffered: "All Members",
            orthodontiaCoinsurance: 50,
            orthodontiaLifetimeMaximum: year === 2024 ? 1_500 : 2_000,
          },
          rates: medicalRates(year, [
            ["EE", 36, 7.2],
            ["EE+Spouse", 72, 21.6],
            ["EE+Child", 68, 20.4],
            ["Family", 112, 39.2],
          ]),
        },
      ],
    },
    {
      key: "vision",
      benefitType: "Vision",
      plans: [
        {
          key: "vision-base",
          name: "Vision Base Plan",
          subtype: "Vision",
          aliases: ["VSP Base", "Vision Plan"],
          details: {
            examFrequencyMonths: 12,
            lensesFrequencyMonths: 12,
            framesFrequencyMonths: 24,
            examCopay: 10,
            materialsCopay: 20,
            framesAllowance: year === 2024 ? 150 : year === 2025 ? 175 : 200,
            contactsAllowance: year === 2024 ? 150 : year === 2025 ? 175 : 200,
          },
          rates: medicalRates(year, [
            ["EE", 9.5, 1.9],
            ["EE+Spouse", 17.5, 5.25],
            ["EE+Child", 16.5, 4.95],
            ["Family", 26.5, 9.28],
          ]),
        },
      ],
    },
    {
      key: "basic-life",
      benefitType: "BasicLife",
      plans: [
        {
          key: "basic-life-all-employees",
          name: "All Eligible Employees",
          subtype: "Basic Life",
          aliases: ["Basic Life 1x Salary"],
          details: {
            benefitFormula: "X Salary",
            salaryMultiplier: 1,
            maximumAmount: 150_000,
            guaranteeIssue: 150_000,
            annualPremium: roundCurrency(31_500 * inflation[year]),
            enrollment: activeEmployeeIndexes[year].length,
          },
          rates: [],
        },
      ],
    },
    {
      key: "voluntary-life",
      benefitType: "VoluntaryLife",
      plans: [
        {
          key: "voluntary-life-employee",
          name: "Employee Voluntary Life",
          subtype: "Employee",
          aliases: ["Vol Life EE"],
          details: {
            maximumAmount: 500_000,
            guaranteeIssue: 150_000,
            annualPremium: roundCurrency(46_000 * inflation[year]),
            enrollment: Math.floor(activeEmployeeIndexes[year].length / 3),
          },
          rates: [],
        },
        {
          key: "voluntary-life-spouse",
          name: "Spouse Voluntary Life",
          subtype: "Spouse",
          aliases: ["Vol Life Spouse"],
          details: {
            maximumAmount: 250_000,
            guaranteeIssue: 50_000,
            annualPremium: roundCurrency(12_500 * inflation[year]),
            enrollment: Math.floor(activeEmployeeIndexes[year].length / 6),
          },
          rates: [],
        },
        {
          key: "voluntary-life-child",
          name: "Child Voluntary Life",
          subtype: "Child",
          aliases: ["Vol Life Child"],
          details: {
            maximumAmount: 10_000,
            guaranteeIssue: 10_000,
            annualPremium: roundCurrency(2_800 * inflation[year]),
            enrollment: Math.floor(activeEmployeeIndexes[year].length / 8),
          },
          rates: [],
        },
      ],
    },
    {
      key: "std",
      benefitType: "STD",
      plans: [
        {
          key: "std-all-employees",
          name: "All Eligible Employees STD",
          subtype: "STD",
          aliases: ["STD Core"],
          details: {
            subsidy: "Basic",
            eliminationPeriodAccident: 7,
            eliminationPeriodSickness: 7,
            benefitPercentage: 60,
            maximumBenefit: 2_000,
            benefitPeriodWeeks: 26,
            annualPremium: roundCurrency(38_000 * inflation[year]),
            enrollment: activeEmployeeIndexes[year].length,
          },
          rates: [],
        },
      ],
    },
    {
      key: "ltd",
      benefitType: "LTD",
      plans: [
        {
          key: "ltd-all-employees",
          name: "All Eligible Employees LTD",
          subtype: "LTD",
          aliases: ["LTD Core"],
          details: {
            subsidy: "Basic",
            eliminationPeriod: 180,
            benefitPercentage: 60,
            maximumBenefit: 10_000,
            benefitPeriod: "Social Security Normal Retirement Age",
            annualPremium: roundCurrency(51_500 * inflation[year]),
            enrollment: activeEmployeeIndexes[year].length,
          },
          rates: [],
        },
      ],
    },
    {
      key: "voluntary-offerings",
      benefitType: "VoluntaryOfferings",
      plans: [
        {
          key: "additional-benefits-offered",
          name: "Additional Benefits Offered",
          subtype: "Voluntary Offerings",
          aliases: [],
          details: {
            accident: true,
            cancerCriticalIllness: true,
            hospitalIndemnity: true,
            idTheft: true,
            legalBenefits: true,
            discountPurchaseProgram: true,
            petInsurance: true,
            lifestyleSpendingAccount: true,
          },
          rates: [],
        },
      ],
    },
  ];
}

function medicalRates(
  year: DemoYear,
  rows: Array<[tier: string, gross: number, employee: number]>
): DemoRate[] {
  return rows.map(([tier, gross, employee]) => ({
    tier,
    grossPremium: roundCurrency(gross * inflation[year]),
    employeeContribution: roundCurrency(employee * employeeInflation[year]),
  }));
}

async function createCensus(tx: Prisma.TransactionClient, year: DemoYear) {
  const employees = activeEmployeeIndexes[year].map((index) => employeeRecord(year, index));
  const dependents = activeEmployeeIndexes[year].flatMap((index) => dependentRecords(year, index));
  const elections = activeEmployeeIndexes[year].flatMap((index) => electionRecords(year, index));

  await tx.employee.createMany({ data: employees });
  await tx.dependent.createMany({ data: dependents });
  await tx.benefitElection.createMany({ data: elections });
  await tx.censusUpload.create({
    data: {
      planYearId: planYearIds[year],
      filenames: [`graceland-demo-census-${year}.xlsx`],
      status: "committed",
      warnings: [],
      summary: {
        headcount: employees.length,
        dependentCount: dependents.length,
        electionCount: elections.length,
        source: "Deterministic Benefit HQ demonstration data",
      },
      uploadedAt: utcDate(year, 4, 15),
    },
  });
}

function employeeRecord(year: DemoYear, index: number) {
  const birthYear = 1958 + ((index * 7) % 45);
  const firstActiveYear = index <= 240 ? 2024 : index <= 264 ? 2025 : 2026;
  const hireYear = Math.max(birthYear + 18, firstActiveYear - (index % 16));
  const baseSalary = 38_000 + ((index * 791) % 125_000);
  const salaryYears = year - firstActiveYear;

  return {
    id: employeeId(year, index),
    planYearId: planYearIds[year],
    employeeNumber: `E${String(10_000 + index)}`,
    firstName: firstNames[(index - 1) % firstNames.length],
    lastName: lastNames[Math.floor((index - 1) / firstNames.length) % lastNames.length],
    birthDate: utcDate(birthYear, index % 12, 1 + (index % 27)),
    gender: index % 20 === 0 ? "Nonbinary" : index % 2 === 0 ? "Female" : "Male",
    hireDate: utcDate(hireYear, (index * 3) % 12, 1 + (index % 25)),
    employmentStatus: index % 13 === 0 ? "Active - Part Time" : "Active - Full Time",
    baseSalary: roundCurrency(baseSalary * Math.pow(1.035, salaryYears)),
    postalCode: postalCodes[(index * 5) % postalCodes.length],
  };
}

function dependentRecords(year: DemoYear, index: number) {
  const tier = coverageTier(index);
  const records: Array<{
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    gender: string;
    relationshipType: string;
  }> = [];
  const employee = employeeRecord(year, index);

  if (tier === "EE+Spouse" || tier === "Family") {
    records.push({
      id: `demo-elvis-${year}-dependent-${index}-spouse`,
      employeeId: employeeId(year, index),
      firstName: firstNames[(index + 9) % firstNames.length],
      lastName: employee.lastName,
      birthDate: utcDate(1960 + ((index * 11) % 43), (index + 4) % 12, 1 + (index % 25)),
      gender: index % 2 === 0 ? "Male" : "Female",
      relationshipType: "Spouse",
    });
  }

  if (tier === "EE+Child" || tier === "Family") {
    const childCount = tier === "Family" && index % 2 === 0 ? 2 : 1;
    for (let child = 1; child <= childCount; child++) {
      records.push({
        id: `demo-elvis-${year}-dependent-${index}-child-${child}`,
        employeeId: employeeId(year, index),
        firstName: firstNames[(index + child * 4) % firstNames.length],
        lastName: employee.lastName,
        birthDate: utcDate(2003 + ((index + child * 5) % 18), (index + child) % 12, 1 + ((index + child) % 25)),
        gender: (index + child) % 2 === 0 ? "Female" : "Male",
        relationshipType: "Child",
      });
    }
  }

  return records;
}

function electionRecords(year: DemoYear, index: number) {
  const employee = employeeRecord(year, index);
  const employeeIdValue = employeeId(year, index);
  const tier = coverageTier(index);
  const optionName = tierLabel(tier);
  const medicalEnrolled = index % 10 !== 0;
  const dentalEnrolled = index % 8 !== 0;
  const visionEnrolled = index % 6 !== 0;
  const medicalPlan = index % 5 < 3 ? "PPO 500" : "HDHP 2000";
  const hasSpouse = tier === "EE+Spouse" || tier === "Family";
  const hasChild = tier === "EE+Child" || tier === "Family";

  const elections: Array<{
    employeeId: string;
    benefitType: string;
    planName: string | null;
    optionName: string | null;
    volume?: number | null;
  }> = [
    {
      employeeId: employeeIdValue,
      benefitType: "Medical",
      planName: medicalEnrolled ? medicalPlan : null,
      optionName: medicalEnrolled ? optionName : "Waive",
    },
    {
      employeeId: employeeIdValue,
      benefitType: "Dental",
      planName: dentalEnrolled ? "Dental DPPO" : null,
      optionName: dentalEnrolled ? optionName : "Waive",
    },
    {
      employeeId: employeeIdValue,
      benefitType: "Vision",
      planName: visionEnrolled ? "Vision Base Plan" : null,
      optionName: visionEnrolled ? optionName : "Waive",
    },
    {
      employeeId: employeeIdValue,
      benefitType: "Life",
      planName: "All Eligible Employees",
      optionName: "Employee",
      volume: Math.min(Number(employee.baseSalary), 150_000),
    },
    {
      employeeId: employeeIdValue,
      benefitType: "STD",
      planName: "All Eligible Employees STD",
      optionName: "Employee",
      volume: Math.min(roundCurrency(Number(employee.baseSalary) * 0.6 / 52), 2_000),
    },
    {
      employeeId: employeeIdValue,
      benefitType: "LTD",
      planName: "All Eligible Employees LTD",
      optionName: "Employee",
      volume: Math.min(roundCurrency(Number(employee.baseSalary) * 0.6 / 12), 10_000),
    },
    {
      employeeId: employeeIdValue,
      benefitType: "VoluntaryLife",
      planName: index % 3 === 0 ? "Employee Voluntary Life" : null,
      optionName: index % 3 === 0 ? "Employee" : "Waive",
      volume: index % 3 === 0 ? 100_000 : null,
    },
  ];

  if (hasSpouse) {
    elections.push({
      employeeId: employeeIdValue,
      benefitType: "VoluntaryLife",
      planName: index % 4 === 0 ? "Spouse Voluntary Life" : null,
      optionName: index % 4 === 0 ? "Spouse" : "Waive - Spouse",
      volume: index % 4 === 0 ? 50_000 : null,
    });
  }
  if (hasChild) {
    elections.push({
      employeeId: employeeIdValue,
      benefitType: "VoluntaryLife",
      planName: index % 5 === 0 ? "Child Voluntary Life" : null,
      optionName: index % 5 === 0 ? "Child" : "Waive - Child",
      volume: index % 5 === 0 ? 10_000 : null,
    });
  }

  return elections;
}

async function saveDeckSelections(tx: Prisma.TransactionClient, year: DemoYear) {
  const extraDemoCharts = new Set([
    "premium-summary-table",
    "employer-employee-cost-split",
    "dental-vision-enrollment",
    "salary-band-distribution",
    "dependent-count-distribution",
    "ancillary-volume-summary",
    "life-volume-distribution",
    "data-quality-appendix",
  ]);
  const selections = Object.fromEntries(
    CHART_DEFINITIONS.map((chart) => [
      chart.key,
      { enabled: chart.defaultEnabled || extraDemoCharts.has(chart.key) },
    ])
  );

  await tx.deckConfig.upsert({
    where: { planYearId: planYearIds[year] },
    create: { planYearId: planYearIds[year], selections },
    update: { selections },
  });
}

async function saveBenchmarkProfile(tx: Prisma.TransactionClient) {
  const dataset = await tx.benchmarkDataset.findFirst({
    where: { provider: "Mercer", status: "active" },
    orderBy: [{ surveyYear: "desc" }, { importedAt: "desc" }],
    select: { id: true },
  });
  if (!dataset) return;

  const peer = await tx.benchmarkCohort.findUnique({
    where: { datasetId_code: { datasetId: dataset.id, code: "size.50-499" } },
    select: { id: true },
  });
  if (!peer) return;

  await tx.planYearBenchmarkProfile.upsert({
    where: { planYearId: CURRENT_PLAN_YEAR_ID },
    create: {
      planYearId: CURRENT_PLAN_YEAR_ID,
      datasetId: dataset.id,
      primaryCohortId: peer.id,
      trendRate: 0.065,
    },
    update: {
      datasetId: dataset.id,
      primaryCohortId: peer.id,
      trendRate: 0.065,
    },
  });
}

function coverageTier(index: number) {
  const value = index % 10;
  if (value < 5) return "EE";
  if (value < 7) return "EE+Spouse";
  if (value < 9) return "EE+Child";
  return "Family";
}

function tierLabel(tier: string) {
  if (tier === "EE+Spouse") return "Employee + Spouse";
  if (tier === "EE+Child") return "Employee + Child(ren)";
  if (tier === "Family") return "Family";
  return "Employee";
}

function programId(year: DemoYear, key: string) {
  return `demo-elvis-${year}-program-${key}`;
}

function planId(year: DemoYear, key: string) {
  return `demo-elvis-${year}-plan-${key}`;
}

function employeeId(year: DemoYear, index: number) {
  return `demo-elvis-${year}-employee-${index}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sequence(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
