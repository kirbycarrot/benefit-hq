import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CensusUploader } from "@/components/CensusUploader";
import { SbcUploader } from "@/components/SbcUploader";
import { formatDate } from "@/lib/date";
import {
  BENEFIT_TYPES,
  policyReadinessIssues,
  type BenefitType,
  type CustomPlanAttribute,
  type PolicyPlanDetails,
  type PolicyProgramInput,
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

  const offeredCount = initialPrograms.filter((program) => program.offered).length;
  const issues = policyReadinessIssues(initialPrograms);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const readinessSummary =
    issues.length === 0
      ? "Ready for reporting"
      : [
          errorCount > 0 ? `${errorCount} item${errorCount === 1 ? "" : "s"} need attention` : null,
          warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(", ");

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

      <div id="census" className="scroll-mt-8">
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

      <div id="sbc" className="mt-10 scroll-mt-8">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Summary of Benefits and Coverage</h2>
        <p className="mb-[18px] max-w-[640px] text-sm text-text-600">
          Upload a carrier SBC to read its deductible, coinsurance, out-of-pocket maximum, and copay
          fields, then create a plan pre-filled with what was found.
        </p>
        <SbcUploader planYearId={planYear.id} />
      </div>

      <div id="policy-details" className="mt-10 scroll-mt-8">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Policy details</h2>
        <p className="mb-[18px] max-w-[760px] text-sm text-text-600">
          Build only the benefits this client offers, using census elections, an uploaded SBC, or a
          prior plan year to get started.
        </p>
        <div className="flex flex-col gap-4 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-bold text-text-900">
              {offeredCount} of {BENEFIT_TYPES.length} benefit types configured
            </p>
            <p className="mt-1 text-xs text-text-600">{readinessSummary}</p>
          </div>
          <Link
            href={`/clients/${clientId}/plan-years/${planYearId}/policy-details`}
            className="shrink-0 rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Open policy details
          </Link>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Charts &amp; deck</h2>
        <p className="mb-[18px] text-sm text-text-600">
          Choose which charts and tables to include, then generate the branded deck.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[26px]">
          <Link
            href={`/clients/${clientId}/plan-years/${planYearId}/charts`}
            className="inline-block rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Choose charts &amp; tables
          </Link>
          <p className="text-xs text-text-400">
            Mercer context is applied automatically when a matching company metric is available.{" "}
            <Link
              href={`/clients/${clientId}/plan-years/${planYearId}/benchmarking`}
              className="font-semibold text-text-600 underline decoration-border-light underline-offset-2 hover:text-text-900"
            >
              Advanced benchmark QA
            </Link>
          </p>
        </div>

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
