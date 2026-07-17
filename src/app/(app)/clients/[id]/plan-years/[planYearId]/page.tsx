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
  }));

  return (
    <div>
      <Link
        href={`/clients/${clientId}`}
        className="text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; {planYear.client.name}
      </Link>

      <div className="mt-3.5 mb-5 flex items-center gap-2.5 rounded-[14px] border border-border-light bg-white px-[22px] py-4">
        <span className="inline-block h-2 w-2 rounded-full bg-navy" />
        <span className="text-sm text-text-900">
          {planYear.client.name} &middot; {planYear.label}
        </span>
      </div>

      <div className="mb-[22px] flex items-center justify-between gap-6 rounded-2xl bg-ink-800 px-7 py-[26px]">
        <div>
          <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-teal-bright uppercase">
            Policy details
          </div>
          <div className="mb-2 text-2xl font-extrabold text-white">{planYear.label}</div>
          <div className="max-w-[460px] text-[13px] text-warm-hero-teal">
            Enter the coverage, plan design, premiums, and contributions that belong in
            this proposal. Effective {formatDate(planYear.effectiveDate)}.
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-ink-700-alt px-4 py-2 text-xs whitespace-nowrap text-warm-hero-mid">
          {policyLines.length} plan{policyLines.length === 1 ? "" : "s"} &middot;{" "}
          {planYear._count.employees} employees
        </div>
      </div>

      <div id="policy-details" className="scroll-mt-8">
        <h2 className="mb-1 text-[17px] font-bold text-text-900">Policy options</h2>
        <p className="mb-[18px] text-[13px] text-text-600">
          Coverage, plan names, tiers, and premiums for this plan year.
        </p>
        <PolicyLinesEditor planYearId={planYear.id} initialPolicyLines={policyLines} />
      </div>

      <div id="census" className="mt-10 scroll-mt-8">
        <h2 className="mb-1 text-[17px] font-bold text-text-900">Census</h2>
        <p className="mb-[18px] max-w-[560px] text-[13px] text-text-600">
          {planYear._count.employees > 0
            ? `${planYear._count.employees} employee(s) currently on file for this plan year. Uploading a new file replaces the existing census.`
            : "Upload the census workbook provided by the client to import employee demographics and elections."}
          {latestUpload && (
            <span className="mt-1 block text-xs text-text-400">
              Last upload: {(latestUpload.filenames as string[]).join(", ")} (
              {latestUpload.uploadedAt.toLocaleString()})
            </span>
          )}
        </p>
        <CensusUploader planYearId={planYear.id} />
      </div>

      <div className="mt-10">
        <h2 className="mb-1 text-[17px] font-bold text-text-900">Charts &amp; deck</h2>
        <p className="mb-[18px] text-[13px] text-text-600">
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
                  className="flex items-center justify-between px-5 py-4 text-sm"
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
                      className="font-semibold text-teal-deep hover:text-teal-deep-hover"
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
