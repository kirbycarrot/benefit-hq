import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CHART_DEFINITIONS = [
  // Overview
  {
    key: "executive-summary",
    label: "Executive Summary",
    description: "Opening slide with core workforce metrics and automatically generated observations.",
    category: "overview",
    sortOrder: 1,
  },

  // Demographics
  {
    key: "headcount-stat-tiles",
    label: "Census Snapshot Stat Tiles",
    description: "Headcount, average age, average tenure, and participation rate at a glance.",
    category: "demographics",
    sortOrder: 10,
  },
  {
    key: "workforce-risk-profile",
    label: "Workforce Risk & Continuity Profile",
    description: "New hires, established employees, age and service horizons, and an age-by-tenure concentration heatmap.",
    category: "demographics",
    sortOrder: 15,
  },
  {
    key: "age-gender-distribution",
    label: "Age & Gender Distribution",
    description: "Employee headcount by age band, split by gender.",
    category: "demographics",
    sortOrder: 20,
  },
  {
    key: "gender-breakdown",
    label: "Gender Breakdown",
    description: "Overall employee headcount split by gender.",
    category: "demographics",
    sortOrder: 30,
  },
  {
    key: "demographic-summary",
    label: "Demographic Summary",
    description: "Average age, % over 55, % over 65, average tenure.",
    category: "demographics",
    defaultEnabled: false,
    sortOrder: 40,
  },
  {
    key: "tenure-distribution",
    label: "Tenure Distribution",
    description: "Headcount by years of service, including new-hire percentage.",
    category: "demographics",
    defaultEnabled: false,
    sortOrder: 50,
  },
  {
    key: "new-hire-snapshot",
    label: "New Hire Snapshot",
    description: "Count and percentage of employees hired in the last 12 months.",
    category: "demographics",
    defaultEnabled: false,
    sortOrder: 60,
  },
  {
    key: "salary-band-distribution",
    label: "Salary Band Distribution",
    description: "Headcount by base salary range.",
    category: "demographics",
    sortOrder: 70,
  },
  {
    key: "employment-status-breakdown",
    label: "Employment Status Breakdown",
    description: "Headcount by employment status (Active, Inactive, etc.).",
    category: "demographics",
    sortOrder: 80,
  },
  {
    key: "geographic-distribution",
    label: "Workforce Geography",
    description: "Automatic state or county heat map based on employee ZIP codes, with a ZIP summary fallback.",
    category: "demographics",
    sortOrder: 90,
  },
  {
    key: "dependent-count-distribution",
    label: "Dependent Count Distribution",
    description: "Employees grouped by number of covered dependents.",
    category: "demographics",
    sortOrder: 100,
  },
  {
    key: "dependent-relationship-breakdown",
    label: "Dependent Relationship Breakdown",
    description: "Covered dependents split by relationship type (spouse, child, other).",
    category: "demographics",
    sortOrder: 110,
  },
  {
    key: "dependent-age-distribution",
    label: "Dependent Age Distribution",
    description: "Covered dependent headcount by age band, split by relationship.",
    category: "demographics",
    sortOrder: 120,
  },

  // Enrollment
  {
    key: "benefits-participation-funnel",
    label: "Benefits Participation & Waivers",
    description: "Eligible, enrolled, waived, not-recorded, and participation totals for Medical, Dental, and Vision.",
    category: "enrollment",
    sortOrder: 190,
  },
  {
    key: "medical-tier-enrollment",
    label: "Medical Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for medical.",
    category: "enrollment",
    sortOrder: 200,
  },
  {
    key: "dental-tier-enrollment",
    label: "Dental Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for dental.",
    category: "enrollment",
    sortOrder: 210,
  },
  {
    key: "vision-tier-enrollment",
    label: "Vision Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for vision.",
    category: "enrollment",
    sortOrder: 220,
  },
  {
    key: "dental-vision-enrollment",
    label: "Dental & Vision Enrollment",
    description: "Enrollment and waiver counts for dental and vision coverage.",
    category: "enrollment",
    defaultEnabled: false,
    sortOrder: 230,
  },
  {
    key: "plan-option-enrollment",
    label: "Enrollment by Plan Option",
    description: "Headcount enrolled in each medical plan option offered, including waived coverage.",
    category: "enrollment",
    sortOrder: 240,
  },
  {
    key: "waived-coverage-summary",
    label: "Waived Coverage Summary",
    description: "Percentage of eligible employees waiving medical, dental, or vision coverage.",
    category: "enrollment",
    defaultEnabled: false,
    sortOrder: 250,
  },

  // Cost
  {
    key: "contribution-strategy",
    label: "Employer vs. Employee Cost Strategy",
    description: "Contribution rates, employer-paid percentage, enrollment, and estimated annual spend by benefit, plan, and tier.",
    category: "cost",
    sortOrder: 290,
  },
  {
    key: "premium-summary-table",
    label: "Premium Summary by Tier",
    description: "Employee vs. employer cost by coverage type and tier, from entered policy details.",
    category: "cost",
    defaultEnabled: false,
    sortOrder: 300,
  },
  {
    key: "cost-by-coverage-summary",
    label: "Cost Summary by Coverage Type",
    description: "Total employee, employer, and combined premium rolled up by coverage type.",
    category: "cost",
    defaultEnabled: false,
    sortOrder: 310,
  },
  {
    key: "employer-employee-cost-split",
    label: "Employer vs. Employee Cost Split",
    description: "Overall share of total premium paid by the employer vs. employees.",
    category: "cost",
    defaultEnabled: false,
    sortOrder: 320,
  },

  // Ancillary
  {
    key: "ancillary-volume-summary",
    label: "Life / STD / LTD Volume Summary",
    description: "Average and total volume, plus participation rate, for life, STD, and LTD coverage.",
    category: "ancillary",
    sortOrder: 400,
  },
  {
    key: "life-volume-distribution",
    label: "Basic Life Volume Distribution",
    description: "Employees grouped by elected basic life insurance volume.",
    category: "ancillary",
    sortOrder: 410,
  },

  // Appendix
  {
    key: "data-quality-appendix",
    label: "Data Quality Appendix",
    description: "Census field completeness, valid ZIP coverage, policy-rate matching, and missing dates or salaries.",
    category: "appendix",
    sortOrder: 900,
  },
];

async function main() {
  for (const chart of CHART_DEFINITIONS) {
    await prisma.chartDefinition.upsert({
      where: { key: chart.key },
      update: chart,
      create: chart,
    });
  }
  console.log(`Seeded ${CHART_DEFINITIONS.length} chart definitions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
