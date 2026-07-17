import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadChartDataset } from "@/lib/charts/dataset";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import { ChartSelectionScreen } from "@/components/ChartSelectionScreen";
import { DeckGenerator } from "@/components/DeckGenerator";
import type { ChartResult } from "@/lib/charts/types";

export default async function ChartsPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;

  const planYear = await prisma.planYear.findUnique({
    where: { id: planYearId },
    include: { client: true, deckConfig: true, _count: { select: { employees: true } } },
  });
  if (!planYear || planYear.clientId !== clientId) notFound();

  const chartDefinitions = await prisma.chartDefinition.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const rawSelections =
    (planYear.deckConfig?.selections as Record<string, { enabled: boolean }> | undefined) ?? {};
  const initialSelections = Object.fromEntries(
    chartDefinitions.map((def) => [
      def.key,
      rawSelections[def.key]?.enabled ?? def.defaultEnabled,
    ])
  );

  let chartResults: Record<string, ChartResult> = {};
  if (planYear._count.employees > 0) {
    const dataset = await loadChartDataset(planYearId);
    chartResults = Object.fromEntries(
      chartDefinitions.map((def) => {
        const compute = CHART_COMPUTE[def.key];
        return [def.key, compute ? compute(dataset) : undefined];
      })
    ) as Record<string, ChartResult>;
  }

  return (
    <div>
      <Link
        href={`/clients/${clientId}/plan-years/${planYearId}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; {planYear.label}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-gray-900">Charts &amp; tables</h1>
      <p className="mt-1 text-sm text-gray-500">
        Choose which standard charts and tables to include in the generated deck.
      </p>

      {planYear._count.employees === 0 ? (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Upload a census for this plan year first — chart previews need employee data to
          render.
        </p>
      ) : (
        <div className="mt-6">
          <ChartSelectionScreen
            planYearId={planYearId}
            chartDefinitions={chartDefinitions}
            initialSelections={initialSelections}
            chartResults={chartResults}
          />
          <div className="mt-6">
            <DeckGenerator planYearId={planYearId} />
          </div>
        </div>
      )}
    </div>
  );
}
