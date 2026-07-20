"use client";

import { useMemo, useState } from "react";
import { buildBenchmarkComparison } from "@/lib/benchmarks/comparison";
import type {
  BenchmarkAvailability,
  BenchmarkComparisonRow,
  BenchmarkDashboardData,
  BenchmarkPoint,
  BenchmarkUnit,
  PlanBenchmarkComparison,
} from "@/lib/benchmarks/types";
import { readApiError } from "@/lib/api-response";
import { POLICY_TIER_LABELS } from "@/lib/policy-details";

const COHORT_GROUP_LABELS = {
  national: "National",
  size: "Employer size",
  region: "Region",
  industry: "Industry",
} as const;

export function BenchmarkingDashboard({
  planYearId,
  data,
}: {
  planYearId: string;
  data: BenchmarkDashboardData;
}) {
  const [peerCode, setPeerCode] = useState(data.selectedCohortCode);
  const [activePlanId, setActivePlanId] = useState(data.client.plans[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comparison = useMemo(
    () => buildBenchmarkComparison(data, peerCode),
    [data, peerCode]
  );
  const peer = data.cohorts.find((cohort) => cohort.code === peerCode);
  const national = data.cohorts.find((cohort) => cohort.code === data.nationalCohortCode);
  const activePlan =
    comparison.plans.find((plan) => plan.id === activePlanId) ?? comparison.plans[0];

  async function choosePeer(nextCode: string) {
    const previous = peerCode;
    const cohort = data.cohorts.find((item) => item.code === nextCode);
    if (!cohort) return;
    setPeerCode(nextCode);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/plan-years/${planYearId}/benchmark-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: data.dataset.id,
          primaryCohortId: cohort.id,
        }),
      });
      if (!response.ok) {
        setPeerCode(previous);
        setError(await readApiError(response, "Unable to save the peer group"));
      }
    } catch {
      setPeerCode(previous);
      setError("Unable to save the peer group. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal-bright/20 px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-teal-deep uppercase">
              Internal QA · Mercer {data.dataset.surveyYear}
            </span>
            <span className="rounded-full border border-border-light bg-white px-3 py-1 text-[11px] font-semibold text-text-600">
              Version {data.dataset.version}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-text-900 sm:text-[32px]">
            Advanced benchmark exploration
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-text-600">
            Inspect the Mercer source values used as background context for {data.client.name}{" "}
            and, when necessary, override the automatically recommended peer group.
          </p>
        </div>

        <label className="block w-full max-w-md">
          <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold text-text-600">
            <span>Advanced peer override</span>
            {saving && <span className="font-medium text-text-400">Saving…</span>}
          </span>
          <select
            value={peerCode}
            onChange={(event) => void choosePeer(event.target.value)}
            disabled={saving}
            className="h-12 w-full rounded-[11px] border border-input-border bg-white px-3.5 text-sm font-semibold text-text-900 shadow-[0_1px_2px_rgba(20,24,26,0.04)] focus:border-teal-deep focus:outline-none disabled:opacity-60"
          >
            {(Object.keys(COHORT_GROUP_LABELS) as Array<keyof typeof COHORT_GROUP_LABELS>).map(
              (type) => (
                <optgroup key={type} label={COHORT_GROUP_LABELS[type]}>
                  {data.cohorts
                    .filter((cohort) => cohort.type === type)
                    .map((cohort) => (
                      <option key={cohort.code} value={cohort.code}>
                        {cohort.label}
                        {cohort.code === data.recommendedCohortCode ? " — Recommended" : ""}
                      </option>
                    ))}
                </optgroup>
              )
            )}
          </select>
          <span className="mt-1.5 block text-[11px] leading-4 text-text-400">
            {peerCode === data.recommendedCohortCode
              ? data.recommendationReason
              : `Override selected. ${data.recommendationReason}`}
          </span>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-[10px] bg-red-50 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="National baseline"
          value={national?.label ?? "National All"}
          detail={participantDetail(national?.participantCount)}
        />
        <SummaryCard
          label="Primary peer"
          value={peer?.label ?? "Peer group"}
          detail={participantDetail(peer?.participantCount)}
        />
      </div>

      <section className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
              Your plan lineup
            </p>
            <h2 className="mt-1 text-[20px] font-extrabold text-text-900">
              Medical plan comparison
            </h2>
          </div>
          {comparison.plans.length > 0 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Medical plans">
              {comparison.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  role="tab"
                  aria-selected={activePlan?.id === plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activePlan?.id === plan.id
                      ? "bg-ink-900 text-white"
                      : "border border-border-light bg-white text-text-600 hover:text-text-900"
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activePlan ? (
          <PlanComparisonCard plan={activePlan} peerLabel={peer?.label ?? "Peer"} />
        ) : (
          <div className="mt-4 rounded-[16px] border border-dashed border-border-light bg-white p-7 text-center">
            <p className="text-sm font-semibold text-text-900">No medical plans to compare yet</p>
            <p className="mt-1 text-xs leading-5 text-text-400">
              No recorded company medical plan is available for internal comparison.
            </p>
          </div>
        )}
      </section>

      <section className="mt-9">
        <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
          Market practice
        </p>
        <h2 className="mt-1 text-[20px] font-extrabold text-text-900">
          Medical plan prevalence
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-text-600">
          Prevalence describes how often employers offer each plan type. It is context, not a
          score of plan quality.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {comparison.prevalence.map((item) => (
            <PrevalenceCard
              key={item.subtype}
              {...item}
              peerLabel={peer?.label ?? "Peer"}
            />
          ))}
        </div>
      </section>

      <div className="mt-9 rounded-[14px] border border-border-light bg-panel-tint px-4 py-4 text-[11px] leading-5 text-text-400 sm:px-5">
        <p className="font-semibold text-text-600">
          Source: {data.dataset.title}, {data.dataset.surveyYear}.
        </p>
        <p>
          Mercer plan-design values are medians unless labeled as averages. “Insufficient data”
          reflects Mercer&apos;s ID designation. Values are not silently replaced by another cohort.
          Actuarial values use Mercer&apos;s proprietary MedPrice methodology.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] ${
        accent ? "border-teal-bright/60 bg-teal-bright/10" : "border-border-light bg-white"
      }`}
    >
      <p className="text-[10px] font-bold tracking-[0.08em] text-text-400 uppercase">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-text-900">{value}</p>
      <p className="mt-1 text-[11px] text-text-400">{detail}</p>
    </div>
  );
}

function PlanComparisonCard({
  plan,
  peerLabel,
}: {
  plan: PlanBenchmarkComparison;
  peerLabel: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-[16px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
      <div className="flex flex-col gap-2 border-b border-border-lighter bg-panel-tint px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-text-900">{plan.name}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-text-600 ring-1 ring-border-light">
              {plan.subtype}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-400">
            Only company values with a corresponding Mercer value are shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-text-600">
          <LegendDot color="bg-ink-900" label="Client" />
          <LegendDot color="bg-text-300" label="National" />
          <LegendDot color="bg-teal-deep" label={peerLabel} />
        </div>
      </div>

      <div className="grid divide-y divide-border-lighter xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <ComparisonSection
          title="Monthly premium by tier"
          description="Gross monthly premium or premium equivalent"
          rows={plan.premiumRows}
          peerLabel={peerLabel}
        />
        <ComparisonSection
          title="Employee contribution by tier"
          description="Average employee monthly contribution"
          rows={plan.contributionRows}
          peerLabel={peerLabel}
        />
      </div>

      <div className="border-t border-border-lighter px-4 py-5 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h4 className="text-sm font-extrabold text-text-900">Plan design scorecard</h4>
            <p className="mt-0.5 text-[11px] text-text-400">
              Client provisions versus Mercer average or median
            </p>
          </div>
        </div>
        {plan.designRows.length > 0 ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {plan.designRows.map((row) => (
              <DesignRow key={row.metricCode} row={row} peerLabel={peerLabel} />
            ))}
          </div>
        ) : (
          <EmptyComparison message="No recorded company plan-design value has a corresponding Mercer value." />
        )}
      </div>
    </div>
  );
}

function ComparisonSection({
  title,
  description,
  rows,
  peerLabel,
}: {
  title: string;
  description: string;
  rows: BenchmarkComparisonRow[];
  peerLabel: string;
}) {
  return (
    <div className="min-w-0 px-4 py-5 sm:px-6">
      <h4 className="text-sm font-extrabold text-text-900">{title}</h4>
      <p className="mt-0.5 text-[11px] text-text-400">{description}</p>
      {rows.length > 0 ? (
        <div className="mt-4 space-y-4">
          {rows.map((row) => (
            <ComparisonBars key={row.metricCode} row={row} peerLabel={peerLabel} />
          ))}
        </div>
      ) : (
        <EmptyComparison message="No recorded company rate has a corresponding Mercer value." />
      )}
    </div>
  );
}

function ComparisonBars({
  row,
  peerLabel,
}: {
  row: BenchmarkComparisonRow;
  peerLabel: string;
}) {
  const max = Math.max(row.clientValue ?? 0, row.national.value ?? 0, row.peer.value ?? 0, 1);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-text-600">{tierLabel(row.tier)}</p>
        <p className="text-[10px] font-semibold text-text-400">
          {row.peerVariance === null
            ? "Comparison unavailable"
            : `${formatSigned(row.peerVariance, row.unit)} vs peer`}
        </p>
      </div>
      <div className="mt-2 space-y-1.5">
        <BarLine label="Client" value={row.clientValue} max={max} unit={row.unit} color="bg-ink-900" />
        <BarLine label="National" value={row.national.value} max={max} unit={row.unit} color="bg-text-300" availability={row.national.availability} />
        <BarLine label={peerLabel} value={row.peer.value} max={max} unit={row.unit} color="bg-teal-deep" availability={row.peer.availability} />
      </div>
    </div>
  );
}

function BarLine({
  label,
  value,
  max,
  unit,
  color,
  availability,
}: {
  label: string;
  value: number | null;
  max: number;
  unit: BenchmarkUnit;
  color: string;
  availability?: BenchmarkAvailability;
}) {
  return (
    <div className="grid grid-cols-[74px_minmax(0,1fr)_78px] items-center gap-2 text-[10px]">
      <span className="truncate text-text-400" title={label}>{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-border-lighter">
        {value !== null && (
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
        )}
      </div>
      <span className="text-right font-bold text-text-600">
        {value === null ? availabilityLabel(availability) : formatValue(value, unit)}
      </span>
    </div>
  );
}

function DesignRow({ row, peerLabel }: { row: BenchmarkComparisonRow; peerLabel: string }) {
  return (
    <div className="rounded-[11px] border border-border-lighter bg-panel-tint px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold leading-5 text-text-900">{shortMetricLabel(row.label)}</p>
          <p className="text-[10px] text-text-400">Mercer {row.statistic}</p>
        </div>
        <p className="shrink-0 text-[10px] font-semibold text-text-400">
          {row.peerVariance === null ? "—" : `${formatSigned(row.peerVariance, row.unit)} vs peer`}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ValueTile label="Client" value={row.clientValue} unit={row.unit} />
        <ValueTile label="National" value={row.national.value} unit={row.unit} availability={row.national.availability} />
        <ValueTile label={peerLabel} value={row.peer.value} unit={row.unit} availability={row.peer.availability} accent />
      </div>
    </div>
  );
}

function ValueTile({
  label,
  value,
  unit,
  availability,
  accent = false,
}: {
  label: string;
  value: number | null;
  unit: BenchmarkUnit;
  availability?: BenchmarkAvailability;
  accent?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-[8px] px-2 py-2 ${accent ? "bg-teal-bright/15" : "bg-white"}`}>
      <p className="truncate text-[9px] font-semibold text-text-400" title={label}>{label}</p>
      <p className="mt-0.5 truncate text-xs font-extrabold text-text-900">
        {value === null ? availabilityLabel(availability) : formatValue(value, unit)}
      </p>
    </div>
  );
}

function PrevalenceCard({
  subtype,
  offered,
  national,
  peer,
  peerLabel,
}: {
  subtype: string;
  label: string;
  offered: boolean;
  national: BenchmarkPoint;
  peer: BenchmarkPoint;
  peerLabel: string;
}) {
  return (
    <div className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-extrabold text-text-900">{subtype}</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${offered ? "bg-teal-bright/20 text-teal-deep" : "bg-panel-tint text-text-400"}`}>
          {offered ? "Client offers" : "Not offered"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <PrevalenceLine label="National" point={national} color="bg-text-300" />
        <PrevalenceLine label={peerLabel} point={peer} color="bg-teal-deep" />
      </div>
    </div>
  );
}

function PrevalenceLine({ label, point, color }: { label: string; point: BenchmarkPoint; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px]">
        <span className="truncate text-text-400" title={label}>{label}</span>
        <span className="font-bold text-text-600">
          {point.value === null ? availabilityLabel(point.availability) : formatValue(point.value, "percentage")}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border-lighter">
        {point.value !== null && (
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, point.value * 100)}%` }} />
        )}
      </div>
    </div>
  );
}

function EmptyComparison({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-[10px] border border-dashed border-border-light bg-panel-tint px-4 py-5 text-center text-xs text-text-400">
      {message}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="max-w-[140px] truncate" title={label}>{label}</span>
    </span>
  );
}

function participantDetail(count: number | null | undefined): string {
  return count ? `${count.toLocaleString("en-US")} participating employers` : "Participant count unavailable";
}

function tierLabel(tier: string | null): string {
  if (!tier) return "Plan";
  return POLICY_TIER_LABELS[tier as keyof typeof POLICY_TIER_LABELS] ?? tier;
}

function shortMetricLabel(label: string): string {
  return label.replace(/^(PPO|HDHP|HMO) /, "");
}

function availabilityLabel(availability?: BenchmarkAvailability): string {
  if (availability === "insufficient_data") return "ID";
  if (availability === "not_applicable") return "N/A";
  return "—";
}

function formatValue(value: number, unit: BenchmarkUnit): string {
  if (unit === "percentage") {
    return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(value);
  }
  if (unit.startsWith("currency")) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatSigned(value: number, unit: BenchmarkUnit): string {
  if (value === 0) return formatValue(0, unit);
  return `${value > 0 ? "+" : "−"}${formatValue(Math.abs(value), unit)}`;
}
