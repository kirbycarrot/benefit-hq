export type ChartCatalogDefinition = {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  sortOrder: number;
};

export const CHART_DEFINITIONS = [
  // Overview
  {
    key: "executive-summary",
    label: "Executive Summary",
    description: "Opening slide with core workforce metrics and automatically generated observations.",
    category: "overview",
    defaultEnabled: true,
    sortOrder: 10,
  },
  {
    key: "headcount-stat-tiles",
    label: "Census Snapshot Stat Tiles",
    description: "Headcount, average age, average tenure, and participation rate at a glance.",
    category: "overview",
    defaultEnabled: false,
    sortOrder: 20,
  },

  // Renewal & Cost
  {
    key: "renewal-comparison",
    label: "Renewal Comparison",
    description: "Prior-versus-renewal rates and estimated annual employer, employee, and total cost changes using renewal-year enrollment.",
    category: "renewal & cost",
    defaultEnabled: true,
    sortOrder: 100,
  },
  {
    key: "contribution-strategy",
    label: "Employer vs. Employee Cost Strategy",
    description: "Contribution rates, employer-paid percentage, enrollment, and estimated annual spend by benefit, plan, and tier.",
    category: "renewal & cost",
    defaultEnabled: true,
    sortOrder: 110,
  },
  {
    key: "premium-summary-table",
    label: "Premium Summary by Tier",
    description: "Employee vs. employer cost by coverage type and tier, from entered policy details.",
    category: "renewal & cost",
    defaultEnabled: false,
    sortOrder: 120,
  },
  {
    key: "cost-by-coverage-summary",
    label: "Cost Summary by Coverage Type",
    description: "Total employee, employer, and combined premium rolled up by coverage type.",
    category: "renewal & cost",
    defaultEnabled: false,
    sortOrder: 130,
  },
  {
    key: "employer-employee-cost-split",
    label: "Employer vs. Employee Cost Split",
    description: "Overall share of total premium paid by the employer vs. employees.",
    category: "renewal & cost",
    defaultEnabled: false,
    sortOrder: 140,
  },

  // Participation & Enrollment
  {
    key: "benefits-participation-funnel",
    label: "Benefits Participation & Waivers",
    description: "Eligible, enrolled, waived, not-recorded, and participation totals for Medical, Dental, and Vision.",
    category: "participation & enrollment",
    defaultEnabled: true,
    sortOrder: 200,
  },
  {
    key: "plan-option-enrollment",
    label: "Enrollment by Plan Option",
    description: "Headcount enrolled in each medical plan option offered, including waived coverage.",
    category: "participation & enrollment",
    defaultEnabled: true,
    sortOrder: 210,
  },
  {
    key: "medical-tier-enrollment",
    label: "Medical Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for medical.",
    category: "participation & enrollment",
    defaultEnabled: true,
    sortOrder: 220,
  },
  {
    key: "dental-tier-enrollment",
    label: "Dental Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for dental.",
    category: "participation & enrollment",
    defaultEnabled: true,
    sortOrder: 230,
  },
  {
    key: "vision-tier-enrollment",
    label: "Vision Coverage Tier Enrollment",
    description: "Enrollment split across Employee / Employee + Spouse / Employee + Child(ren) / Family for vision.",
    category: "participation & enrollment",
    defaultEnabled: true,
    sortOrder: 240,
  },
  {
    key: "dental-vision-enrollment",
    label: "Dental & Vision Enrollment",
    description: "Enrollment and waiver counts for dental and vision coverage.",
    category: "participation & enrollment",
    defaultEnabled: false,
    sortOrder: 250,
  },
  {
    key: "waived-coverage-summary",
    label: "Waived Coverage Summary",
    description: "Percentage of eligible employees waiving medical, dental, or vision coverage.",
    category: "participation & enrollment",
    defaultEnabled: false,
    sortOrder: 260,
  },

  // Workforce Profile
  {
    key: "workforce-risk-profile",
    label: "Workforce Risk & Continuity Profile",
    description: "New hires, established employees, age and service horizons, and an age-by-tenure concentration heatmap.",
    category: "workforce profile",
    defaultEnabled: true,
    sortOrder: 300,
  },
  {
    key: "geographic-distribution",
    label: "Workforce Geography",
    description: "Automatic state or county heat map based on employee ZIP codes, with a ZIP summary fallback.",
    category: "workforce profile",
    defaultEnabled: true,
    sortOrder: 310,
  },
  {
    key: "age-gender-distribution",
    label: "Age & Gender Distribution",
    description: "Employee headcount by age band, split by gender.",
    category: "workforce profile",
    defaultEnabled: true,
    sortOrder: 320,
  },
  {
    key: "salary-band-distribution",
    label: "Salary Band Distribution",
    description: "Headcount by base salary range.",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 330,
  },
  {
    key: "gender-breakdown",
    label: "Gender Breakdown",
    description: "Overall employee headcount split by gender.",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 340,
  },
  {
    key: "employment-status-breakdown",
    label: "Employment Status Breakdown",
    description: "Headcount by employment status (Active, Inactive, etc.).",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 350,
  },
  {
    key: "demographic-summary",
    label: "Demographic Summary",
    description: "Average age, % over 55, % over 65, average tenure.",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 360,
  },
  {
    key: "tenure-distribution",
    label: "Tenure Distribution",
    description: "Headcount by years of service, including new-hire percentage.",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 370,
  },
  {
    key: "new-hire-snapshot",
    label: "New Hire Snapshot",
    description: "Count and percentage of employees hired in the last 12 months.",
    category: "workforce profile",
    defaultEnabled: false,
    sortOrder: 380,
  },

  // Dependent Profile
  {
    key: "dependent-count-distribution",
    label: "Dependent Count Distribution",
    description: "Employees grouped by number of covered dependents.",
    category: "dependent profile",
    defaultEnabled: true,
    sortOrder: 400,
  },
  {
    key: "dependent-relationship-breakdown",
    label: "Dependent Relationship Breakdown",
    description: "Covered dependents split by relationship type (spouse, child, other).",
    category: "dependent profile",
    defaultEnabled: true,
    sortOrder: 410,
  },
  {
    key: "dependent-age-distribution",
    label: "Dependent Age Distribution",
    description: "Covered dependent headcount by age band, split by relationship.",
    category: "dependent profile",
    defaultEnabled: false,
    sortOrder: 420,
  },

  // Ancillary Benefits
  {
    key: "ancillary-volume-summary",
    label: "Life / STD / LTD Volume Summary",
    description: "Average and total volume, plus participation rate, for life, STD, and LTD coverage.",
    category: "ancillary benefits",
    defaultEnabled: true,
    sortOrder: 500,
  },
  {
    key: "life-volume-distribution",
    label: "Basic Life Volume Distribution",
    description: "Employees grouped by elected basic life insurance volume.",
    category: "ancillary benefits",
    defaultEnabled: false,
    sortOrder: 510,
  },

  // Appendix
  {
    key: "data-quality-appendix",
    label: "Data Quality Appendix",
    description: "Census field completeness, valid ZIP coverage, policy-rate matching, and missing dates or salaries.",
    category: "appendix",
    defaultEnabled: true,
    sortOrder: 900,
  },
] as const satisfies readonly ChartCatalogDefinition[];
