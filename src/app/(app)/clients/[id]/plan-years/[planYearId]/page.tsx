import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PolicyDetailsEditor } from "@/components/PolicyDetailsEditor";
import { CensusUploader } from "@/components/CensusUploader";
import { formatDate } from "@/lib/date";
import {
  BENEFIT_TYPES,
  inferPlanSubtype,
  normalizePolicyName,
  policyTierFromCensusOption,
  type BenefitType,
  type CensusPlanSuggestion,
  type PolicyPlanDetails,
  type PolicyProgramInput,
  type RateBenefitType,
} from "@/lib/policy-details";

export default async function PlanYearDetailPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;

  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: {
      client: true,
      benefitPrograms: {
        orderBy: { sortOrder: "asc" },
        include: {
          plans: {
            orderBy: { sortOrder: "asc" },
            include: {
              rates: { orderBy: { sortOrder: "asc" } },
              aliases: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
      censusUploads: { orderBy: { uploadedAt: "desc" }, take: 1 },
      decks: { orderBy: { generatedAt: "desc" } },
      _count: { select: { employees: true } },
    },
  });

  if (!planYear || planYear.clientId !== clientId) notFound();

  const latestUpload = planYear.censusUploads[0];
  const [electionGroups, priorWithPrograms] = await Promise.all([
    prisma.benefitElection.groupBy({
      by: ["benefitType", "planName", "optionName"],
      where: {
        employee: { planYearId },
        benefitType: { in: ["Medical", "Dental", "Vision"] },
        planName: { not: null },
      },
      _count: { _all: true },
    }),
    planYear.benefitPrograms.length === 0
      ? prisma.planYear.findFirst({
          where: {
            clientId,
            effectiveDate: { lt: planYear.effectiveDate },
            benefitPrograms: { some: {} },
          },
          orderBy: { effectiveDate: "desc" },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const initialPrograms: PolicyProgramInput[] = planYear.benefitPrograms
    .filter((program) => isBenefitType(program.benefitType))
    .map((program) => ({
      benefitType: program.benefitType as BenefitType,
      offered: program.offered,
      plans: program.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        subtype: plan.subtype,
        offered: plan.offered,
        details: policyPlanDetails(plan.details),
        detailSchemaVersion: 1,
        renewedFromPlanId: plan.renewedFromPlanId,
        sortOrder: plan.sortOrder,
        aliases: plan.aliases.map((alias) => alias.alias),
        rates: plan.rates.map((rate) => ({
          tier: rate.tier as PolicyProgramInput["plans"][number]["rates"][number]["tier"],
          grossPremium: rate.grossPremium.toNumber(),
          employeeContribution: rate.employeeContribution.toNumber(),
          ratePeriod: rate.ratePeriod as PolicyProgramInput["plans"][number]["rates"][number]["ratePeriod"],
          enrollmentOverride: rate.enrollmentOverride ?? undefined,
          sortOrder: rate.sortOrder,
        })),
      })),
    }));
  const censusSuggestions = buildCensusSuggestions(electionGroups);
  const policyEditorVersion = planYear.benefitPrograms
    .flatMap((program) => [
      program.updatedAt.getTime(),
      ...program.plans.flatMap((plan) => [
        plan.updatedAt.getTime(),
        ...plan.rates.map((rate) => rate.updatedAt.getTime()),
      ]),
    ])
    .join(":");

  return (
    <div>
      <Link
        href={`/clients/${clientId}`}
        className="block max-w-full truncate text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; {planYear.client.name}
      </Link>
      <h1 className="mt-2.5 mb-1 text-[26px] font-extrabold text-text-900">
        {planYear.label}
      </h1>
      <p className="mb-9 text-sm text-text-600">
        Effective {formatDate(planYear.effectiveDate)}
      </p>

      <div id="policy-details" className="scroll-mt-8">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Policy details</h2>
        <p className="mb-[18px] max-w-[760px] text-sm text-text-600">
          Build only the benefits this client offers. Start from census elections or a prior plan year,
          then expand each plan for rates and policy provisions as needed.
        </p>
        <PolicyDetailsEditor
          key={policyEditorVersion || "empty"}
          planYearId={planYear.id}
          initialPrograms={initialPrograms}
          censusSuggestions={censusSuggestions}
          canCopyPrior={Boolean(priorWithPrograms)}
        />
      </div>

      <div id="census" className="mt-10 scroll-mt-8">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Census</h2>
        <p className="mb-1 max-w-[640px] text-sm text-text-600">
          {planYear._count.employees > 0
            ? `${planYear._count.employees} employee(s) currently on file for this plan year. Uploading a new file replaces the existing census.`
            : "Upload the census workbook provided by the client to import employee demographics and elections."}
        </p>
        {latestUpload && (
          <p className="mb-[18px] text-xs text-text-400">
            Last upload: {(latestUpload.filenames as string[]).join(", ")} (
            {latestUpload.uploadedAt.toLocaleString()})
          </p>
        )}
        <CensusUploader planYearId={planYear.id} />
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Charts &amp; deck</h2>
        <p className="mb-[18px] text-sm text-text-600">
          Choose which charts and tables to include, then generate the branded deck.
        </p>
        <Link
          href={`/clients/${clientId}/plan-years/${planYearId}/charts`}
          className="inline-block rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
        >
          Choose charts &amp; tables
        </Link>

        {planYear.decks.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-[13px] font-bold text-text-900">Generated decks</h3>
            <ul className="divide-y divide-border-lighter rounded-[14px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
              {planYear.decks.map((deck) => (
                <li
                  key={deck.id}
                  className="flex flex-col items-start gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <span className="text-text-900">
                    {deck.generatedAt.toLocaleString()}
                    {deck.status !== "ready" && (
                      <span className="ml-2 text-xs text-amber uppercase">
                        {deck.status}
                      </span>
                    )}
                  </span>
                  {deck.status === "ready" ? (
                    <a
                      href={`/api/decks/${deck.id}/download`}
                      className="font-semibold text-link hover:text-link-hover"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-text-400">Unavailable</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function isBenefitType(value: string): value is BenefitType {
  return BENEFIT_TYPES.includes(value as BenefitType);
}

function policyPlanDetails(value: unknown): PolicyPlanDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
      const item = entry[1];
      return item === null || ["string", "number", "boolean"].includes(typeof item);
    })
  );
}

function buildCensusSuggestions(
  groups: Array<{
    benefitType: string;
    planName: string | null;
    optionName: string | null;
    _count: { _all: number };
  }>
): CensusPlanSuggestion[] {
  const suggestions = new Map<string, CensusPlanSuggestion>();

  for (const group of groups) {
    if (!group.planName || !isRateBenefit(group.benefitType)) continue;
    if (/waive|declin|no coverage|not enrolled/i.test(`${group.planName} ${group.optionName ?? ""}`)) {
      continue;
    }
    const key = `${group.benefitType}:${normalizePolicyName(group.planName)}`;
    const suggestion = suggestions.get(key) ?? {
      benefitType: group.benefitType,
      planName: group.planName.trim(),
      subtype: inferPlanSubtype(group.benefitType, group.planName),
      tierEnrollments: {},
    };
    const tier = policyTierFromCensusOption(group.optionName);
    suggestion.tierEnrollments[tier] =
      (suggestion.tierEnrollments[tier] ?? 0) + group._count._all;
    suggestions.set(key, suggestion);
  }

  return [...suggestions.values()].sort(
    (left, right) =>
      BENEFIT_TYPES.indexOf(left.benefitType) - BENEFIT_TYPES.indexOf(right.benefitType) ||
      left.planName.localeCompare(right.planName)
  );
}

function isRateBenefit(value: string): value is RateBenefitType {
  return value === "Medical" || value === "Dental" || value === "Vision";
}
