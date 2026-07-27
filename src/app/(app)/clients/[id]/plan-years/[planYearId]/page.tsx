import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CensusUploader } from "@/components/CensusUploader";
import { SbcUploader } from "@/components/SbcUploader";
import { formatDate } from "@/lib/date";
import {
  BENEFIT_TYPES,
  policyProgramsFromRecords,
  policyReadinessIssues,
  type PolicyProgramInput,
} from "@/lib/policy-details";
import { PILL_TONE_CLASS, type PillTone } from "@/lib/status-pill";

export default async function PlanYearDetailPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;

  const [planYear, chartDefinitions] = await Promise.all([
    prisma.planYear.findUnique({
      where: { id: planYearId },
      include: {
        client: true,
        deckConfig: true,
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
    }),
    prisma.chartDefinition.findMany({ select: { key: true, defaultEnabled: true } }),
  ]);

  if (!planYear || planYear.clientId !== clientId) notFound();

  const latestUpload = planYear.censusUploads[0];

  const initialPrograms: PolicyProgramInput[] = policyProgramsFromRecords(
    planYear.benefitPrograms
  );

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

  const rawSelections =
    (planYear.deckConfig?.selections as Record<string, { enabled?: boolean }> | undefined) ?? {};
  const selectedChartCount = chartDefinitions.filter(
    (def) => rawSelections[def.key]?.enabled ?? def.defaultEnabled
  ).length;

  const censusStatus: { label: string; tone: PillTone } =
    planYear._count.employees > 0
      ? { label: "Census uploaded", tone: "success" }
      : { label: "Census needed", tone: "neutral" };
  const policyStatus: { label: string; tone: PillTone } =
    offeredCount === 0
      ? { label: "Not started", tone: "neutral" }
      : issues.length > 0
        ? { label: `${issues.length} issue${issues.length === 1 ? "" : "s"}`, tone: "warning" }
        : { label: "Ready", tone: "success" };
  const deckStatus: { label: string; tone: PillTone } =
    planYear.decks.length > 0
      ? { label: `${planYear.decks.length} generated`, tone: "success" }
      : { label: "No deck yet", tone: "neutral" };

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
      <p className="mb-7 text-sm text-text-600">
        Effective {formatDate(planYear.effectiveDate)}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusCard
          status={censusStatus}
          summary={
            planYear._count.employees > 0
              ? `${planYear._count.employees} employees`
              : "Upload a census below"
          }
        />
        <StatusCard
          status={policyStatus}
          summary={`${offeredCount} of ${BENEFIT_TYPES.length} benefit types configured`}
        />
        <StatusCard
          status={deckStatus}
          summary={`${selectedChartCount} charts selected for the deck`}
        />
      </div>

      <div className="mt-8 space-y-5">
        <section className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-6">
          <h2 className="text-[17px] font-bold text-text-900">1 &middot; Census</h2>
          <p className="mt-1 mb-4 max-w-[640px] text-sm text-text-600">
            {planYear._count.employees > 0
              ? `${planYear._count.employees} employee(s) currently on file for this plan year. Uploading a new file replaces the existing census.`
              : "Upload the census workbook provided by the client to import employee demographics and elections."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CensusUploader planYearId={planYear.id} />
            </div>
            {latestUpload && (
              <p className="shrink-0 text-xs text-text-400 sm:pt-2">
                Last upload: {(latestUpload.filenames as string[]).join(", ")} (
                {latestUpload.uploadedAt.toLocaleString()})
              </p>
            )}
          </div>

          <details className="group mt-5 border-t border-border-lighter pt-4">
            <summary className="cursor-pointer text-[13px] font-semibold text-link hover:text-link-hover [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Also upload a carrier SBC to pre-fill a plan</span>
              <span className="hidden group-open:inline">Hide SBC upload</span>
            </summary>
            <div className="mt-4">
              <p className="mb-3 max-w-[640px] text-sm text-text-600">
                Upload a carrier SBC to read its deductible, coinsurance, out-of-pocket maximum, and
                copay fields, then create a plan pre-filled with what was found.
              </p>
              <SbcUploader planYearId={planYear.id} />
            </div>
          </details>
        </section>

        <section className="flex flex-col gap-4 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-[17px] font-bold text-text-900">2 &middot; Policy details</h2>
            <p className="mt-1 text-sm font-semibold text-text-900">
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
        </section>

        <section className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-bold text-text-900">3 &middot; Charts &amp; deck</h2>
              <p className="mt-1 text-xs text-text-400">
                Mercer context is applied automatically when a matching company metric is available.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Link
                href={`/clients/${clientId}/plan-years/${planYearId}/benchmarking`}
                className="text-xs font-semibold text-text-600 underline decoration-border-light underline-offset-2 hover:text-text-900"
              >
                Advanced benchmark QA
              </Link>
              <Link
                href={`/clients/${clientId}/plan-years/${planYearId}/charts`}
                className="inline-block rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                Open charts &amp; tables
              </Link>
            </div>
          </div>

          {planYear.decks.length > 0 && (
            <div className="mt-5 border-t border-border-lighter pt-4">
              <h3 className="mb-2 text-[13px] font-bold text-text-900">Generated decks</h3>
              <ul className="divide-y divide-border-lighter">
                {planYear.decks.map((deck) => (
                  <li
                    key={deck.id}
                    className="flex flex-col items-start gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
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
        </section>
      </div>
    </div>
  );
}

function StatusCard({
  status,
  summary,
}: {
  status: { label: string; tone: PillTone };
  summary: string;
}) {
  return (
    <div className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL_TONE_CLASS[status.tone]}`}
      >
        {status.label}
      </span>
      <p className="mt-2 text-sm font-bold text-text-900">{summary}</p>
    </div>
  );
}
