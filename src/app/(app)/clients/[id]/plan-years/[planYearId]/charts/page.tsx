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
        className="text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; {planYear.label}
      </Link>
      <h1 className="mt-1 mb-1.5 text-[26px] font-extrabold text-text-900">
        Charts &amp; tables
      </h1>
      <p className="mb-[22px] max-w-[560px] text-sm text-text-600">
        Choose which standard charts and tables to include in the generated deck.
      </p>

      {planYear._count.employees === 0 ? (
        <p className="rounded-[10px] bg-panel-tint px-4 py-3 text-sm text-amber">
          Upload a census for this plan year first — chart previews need employee data to
          render.
        </p>
      ) : (
        <div>
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
