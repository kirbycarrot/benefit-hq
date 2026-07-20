import Link from "next/link";
import { BenchmarkingDashboard } from "@/components/BenchmarkingDashboard";
import { loadBenchmarkDashboard } from "@/lib/benchmarks/server";

export default async function BenchmarkingPage({
  params,
}: {
  params: Promise<{ id: string; planYearId: string }>;
}) {
  const { id: clientId, planYearId } = await params;
  const data = await loadBenchmarkDashboard(planYearId, clientId);

  return (
    <div>
      <Link
        href={`/clients/${clientId}/plan-years/${planYearId}`}
        className="text-[13px] text-text-600 hover:text-text-900"
      >
        &larr; Plan year
      </Link>

      {data ? (
        <BenchmarkingDashboard planYearId={planYearId} data={data} />
      ) : (
        <div className="mt-6 max-w-2xl rounded-[16px] border border-border-light bg-white p-6 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
          <p className="text-xs font-bold tracking-[0.08em] text-text-400 uppercase">
            Internal benchmark data unavailable
          </p>
          <h1 className="mt-2 text-[24px] font-extrabold text-text-900">
            Advanced benchmark QA is unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-600">
            Run the database seed to import the versioned Mercer benchmark catalog, then
            return to this page.
          </p>
        </div>
      )}
    </div>
  );
}
