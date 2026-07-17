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
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; {planYear.client.name}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-gray-900">
        {planYear.label}
      </h1>
      <p className="text-sm text-gray-500">
        Effective {formatDate(planYear.effectiveDate)}
      </p>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Policy details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter coverage types, plan names, tiers, and premiums for this plan year.
        </p>
        <div className="mt-4">
          <PolicyLinesEditor planYearId={planYear.id} initialPolicyLines={policyLines} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Census</h2>
        <p className="mt-1 text-sm text-gray-500">
          {planYear._count.employees > 0
            ? `${planYear._count.employees} employee(s) currently on file for this plan year. Uploading a new file replaces the existing census.`
            : "Upload the census workbook provided by the client to import employee demographics and elections."}
          {latestUpload && (
            <span className="block text-xs text-gray-400">
              Last upload: {(latestUpload.filenames as string[]).join(", ")} (
              {latestUpload.uploadedAt.toLocaleString()})
            </span>
          )}
        </p>
        <div className="mt-4">
          <CensusUploader planYearId={planYear.id} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Charts &amp; deck</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose which charts and tables to include, then generate the branded deck.
        </p>
        <div className="mt-4">
          <Link
            href={`/clients/${clientId}/plan-years/${planYearId}/charts`}
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Choose charts &amp; tables
          </Link>
        </div>

        {planYear.decks.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Generated decks</h3>
            <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {planYear.decks.map((deck) => (
                <li
                  key={deck.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-gray-700">
                    {deck.generatedAt.toLocaleString()}
                    {deck.status !== "ready" && (
                      <span className="ml-2 text-xs uppercase text-amber-600">
                        {deck.status}
                      </span>
                    )}
                  </span>
                  {deck.status === "ready" ? (
                    <a
                      href={`/api/decks/${deck.id}/download`}
                      className="font-medium text-gray-900 underline hover:no-underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-gray-400">Unavailable</span>
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
