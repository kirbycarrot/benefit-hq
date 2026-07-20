import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PolicyDetailsEditor } from "@/components/PolicyDetailsEditor";
import type { SbcExtractedFields } from "@/lib/sbc/parse";
import {
  BENEFIT_TYPES,
  CENSUS_ELECTION_BENEFIT_TYPE,
  inferPlanSubtype,
  normalizePolicyName,
  policyTierFromCensusOption,
  type AncillaryVolumeBenefitType,
  type BenefitType,
  type CensusPlanSuggestion,
  type CustomPlanAttribute,
  type PolicyPlanDetails,
  type PolicyProgramInput,
  type RateBenefitType,
} from "@/lib/policy-details";

export default async function PolicyDetailsPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;

  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: {
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
    },
  });

  if (!planYear || planYear.clientId !== clientId) notFound();

  const [electionGroups, priorWithPrograms, carriers, volumeGroups, sbcDocuments] = await Promise.all([
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
    prisma.carrier.findMany({ orderBy: { name: "asc" } }),
    prisma.benefitElection.groupBy({
      by: ["benefitType"],
      where: {
        employee: { planYearId },
        benefitType: { in: Object.values(CENSUS_ELECTION_BENEFIT_TYPE) },
        volume: { not: null },
      },
      _sum: { volume: true },
    }),
    prisma.clientDocument.findMany({
      where: { planYearId, category: "sbc" },
      orderBy: { uploadedAt: "desc" },
      take: 10,
      select: { id: true, originalFilename: true, uploadedAt: true, extractedFields: true },
    }),
  ]);
  const carriersByBenefitType = carriers.reduce<Record<string, string[]>>((acc, carrier) => {
    (acc[carrier.benefitType] ??= []).push(carrier.name);
    return acc;
  }, {});

  const censusBenefitTypeToPolicy = Object.fromEntries(
    Object.entries(CENSUS_ELECTION_BENEFIT_TYPE).map(([policyType, censusType]) => [censusType, policyType])
  ) as Record<string, AncillaryVolumeBenefitType>;
  const censusVolumeByBenefitType = volumeGroups.reduce<Partial<Record<BenefitType, number>>>(
    (acc, group) => {
      const policyType = censusBenefitTypeToPolicy[group.benefitType];
      if (policyType && group._sum.volume) acc[policyType] = group._sum.volume.toNumber();
      return acc;
    },
    {}
  );

  const pendingSbcExtractions = sbcDocuments
    .filter((doc): doc is typeof doc & { extractedFields: object } => Boolean(doc.extractedFields))
    .map((doc) => ({
      id: doc.id,
      filename: doc.originalFilename,
      uploadedAt: doc.uploadedAt.toISOString(),
      fields: doc.extractedFields as unknown as SbcExtractedFields,
    }));

  const initialPrograms: PolicyProgramInput[] = planYear.benefitPrograms
    .filter((program) => isBenefitType(program.benefitType))
    .map((program) => ({
      benefitType: program.benefitType as BenefitType,
      offered: program.offered,
      plans: program.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        carrierName: plan.carrierName,
        subtype: plan.subtype,
        offered: plan.offered,
        details: policyPlanDetails(plan.details),
        customAttributes: customPlanAttributes(plan.customAttributes),
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
        href={`/clients/${clientId}/plan-years/${planYearId}`}
        className="text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; {planYear.label}
      </Link>
      <h1 className="mt-1 mb-1.5 text-[26px] font-extrabold text-text-900">Policy details</h1>
      <p className="mb-[22px] max-w-[760px] text-sm text-text-600">
        Build only the benefits this client offers. Start from census elections, an uploaded SBC, or a
        prior plan year, then expand each plan for rates and policy provisions as needed.
      </p>

      <PolicyDetailsEditor
        key={policyEditorVersion || "empty"}
        planYearId={planYear.id}
        initialPrograms={initialPrograms}
        censusSuggestions={censusSuggestions}
        canCopyPrior={Boolean(priorWithPrograms)}
        carriersByBenefitType={carriersByBenefitType}
        censusVolumeByBenefitType={censusVolumeByBenefitType}
        pendingSbcExtractions={pendingSbcExtractions}
      />
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

function customPlanAttributes(value: unknown): CustomPlanAttribute[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is CustomPlanAttribute =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { value?: unknown }).value === "string"
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
