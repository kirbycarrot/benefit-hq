import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PolicyLinesEditor } from "@/components/PolicyLinesEditor";
import { CensusUploader } from "@/components/CensusUploader";
import { formatDate } from "@/lib/date";

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
      policyLines: { orderBy: { createdAt: "asc" } },
      censusUploads: { orderBy: { uploadedAt: "desc" }, take: 1 },
      decks: { orderBy: { generatedAt: "desc" } },
      _count: { select: { employees: true } },
    },
  });

  if (!planYear || planYear.clientId !== clientId) notFound();

  const latestUpload = planYear.censusUploads[0];

  const policyLines = planYear.policyLines.map((line) => ({
    id: line.id,
    coverageType: line.coverageType,
    planName: line.planName,
    tier: line.tier,
    employeeCost: line.employeeCost.toFixed(2),
    employerCost: line.employerCost.toFixed(2),
    totalPremium: line.totalPremium.toFixed(2),
    ratePeriod: line.ratePeriod,
  }));

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
        <p className="mb-[18px] text-sm text-text-600">
          Enter coverage types, plan names, tiers, and premiums for this plan year.
        </p>
        <PolicyLinesEditor planYearId={planYear.id} initialPolicyLines={policyLines} />
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
