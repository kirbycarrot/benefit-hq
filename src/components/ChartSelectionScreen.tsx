"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartResult } from "@/lib/charts/types";
import { renderGeographyMapSvg } from "@/lib/geography/mapRender";
import { readApiError } from "@/lib/api-response";
import {
  chartView,
  chartViewOptions,
  COVERAGE_TIER_KEYS,
  type ChartSelection,
} from "@/lib/charts/viewOptions";
import {
  contributionBarResult,
  geographyBarResult,
  geographyTableResult,
  participationBarResult,
  participationTableResult,
  renewalBarResult,
  tierTableResult,
} from "@/lib/charts/viewTransforms";

type ChartDefinition = {
  key: string;
  label: string;
  description: string;
  category: string;
};

const COLORS = ["#1F2937", "#2FE0D2", "#F59E0B", "#6366F1", "#EF4444"];
const CHART_FONT = { fontFamily: "Inter, sans-serif", fontSize: 11 };

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCompactCurrency(value: number): string {
  if (value === 0) return formatCompactCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(value))}`;
}

function formatChange(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "0.0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function ratePeriodShort(ratePeriod: string): string {
  if (ratePeriod === "monthly") return "month";
  if (ratePeriod === "per-pay-period") return "pay period";
  if (ratePeriod === "annual") return "year";
  return ratePeriod;
}

function riskHeatColor(value: number, maximum: number): string {
  if (value === 0 || maximum === 0) return "#F3F4F3";
  const shades = ["#DCE2DF", "#B7C3BE", "#83958E", "#526A61", "#1F2937"];
  const index = Math.min(shades.length - 1, Math.ceil((value / maximum) * shades.length) - 1);
  return shades[index];
}

export function ChartSelectionScreen({
  planYearId,
  chartDefinitions,
  initialSelections,
  chartResults,
}: {
  planYearId: string;
  chartDefinitions: ChartDefinition[];
  initialSelections: Record<string, ChartSelection>;
  chartResults: Record<string, ChartResult>;
}) {
  const [selections, setSelections] = useState(initialSelections);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistSelections(next: Record<string, ChartSelection>): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/plan-years/${planYearId}/deck-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: next }),
      });
      if (!response.ok) {
        setError(await readApiError(response, "Unable to save the deck settings"));
        return false;
      }
      return true;
    } catch {
      setError("Unable to save the deck settings. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggle(key: string) {
    const previous = selections;
    const current = selections[key] ?? { enabled: true };
    const next = { ...selections, [key]: { ...current, enabled: !current.enabled } };
    setSelections(next);
    if (!(await persistSelections(next))) setSelections(previous);
  }

  async function changeView(key: string, view: string) {
    const previous = selections;
    const affectedKeys = COVERAGE_TIER_KEYS.includes(
      key as (typeof COVERAGE_TIER_KEYS)[number]
    )
      ? COVERAGE_TIER_KEYS
      : [key];
    const next = { ...selections };
    for (const affectedKey of affectedKeys) {
      const current = next[affectedKey] ?? { enabled: true };
      next[affectedKey] = {
        ...current,
        params: { ...current.params, view },
      };
    }
    setSelections(next);
    if (!(await persistSelections(next))) setSelections(previous);
  }

  const grouped = chartDefinitions.reduce<Record<string, ChartDefinition[]>>((acc, def) => {
    (acc[def.category] ??= []).push(def);
    return acc;
  }, {});

  return (
    <div>
      {saving && <p className="mb-2 text-xs text-text-400">Saving...</p>}
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {Object.entries(grouped).map(([category, defs]) => (
        <details key={category} open className="group mb-6">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] border border-border-light bg-panel-tint px-4 py-3 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-deep [&::-webkit-details-marker]:hidden">
            <span className="text-xs font-bold tracking-[0.08em] text-text-600 uppercase">
              {category}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-[11px] font-medium text-text-400">
                {defs.length} {defs.length === 1 ? "item" : "items"}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4 text-text-600 transition-transform duration-200 group-open:rotate-180"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            {defs.map((def) => {
              const selection = selections[def.key] ?? { enabled: true };
              const enabled = selection.enabled;
              const result = chartResults[def.key];
              const viewOptions = chartViewOptions(def.key);
              const selectedView = chartView(def.key, selection);
              const unavailable =
                (result?.kind === "renewal" || result?.kind === "benchmark") &&
                !result.available;
              return (
                <div
                  key={def.key}
                  className={`min-w-0 rounded-[14px] border bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[22px] ${
                    enabled ? "border-border-light" : "border-border-lighter opacity-60"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <label className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={unavailable ? false : enabled}
                          onChange={() => toggle(def.key)}
                          disabled={unavailable || saving}
                          className="h-4 w-4 rounded border-input-border accent-ink-900"
                        />
                        <span className="text-sm font-semibold text-text-900">{def.label}</span>
                      </label>
                      <p className="mt-1 ml-[26px] text-xs text-text-400">{def.description}</p>
                    </div>
                    {viewOptions && selectedView && (
                      <label className="flex shrink-0 items-center gap-2 pl-[26px] text-xs font-semibold text-text-600 sm:pl-0">
                        <span>View</span>
                        <select
                          aria-label={`View for ${def.label}`}
                          value={selectedView}
                          onChange={(event) => void changeView(def.key, event.target.value)}
                          disabled={!enabled || unavailable || saving}
                          className="h-9 rounded-[9px] border border-input-border bg-white px-3 text-xs text-text-900 focus:border-teal-deep focus:outline-none disabled:opacity-50"
                        >
                          {viewOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {enabled && result && (
                    <div className="mt-4">
                      {unavailable ? (
                        <div className="rounded-[10px] border border-dashed border-border-light bg-panel-tint px-4 py-5 text-center">
                          <p className="text-sm font-semibold text-text-600">
                            {result.message}
                          </p>
                          <p className="mt-1 text-xs text-text-400">
                            The generated PowerPoint will omit this analysis until the required data is available.
                          </p>
                        </div>
                      ) : (
                        <ChartPreview result={result} view={selectedView} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function ChartPreview({ result, view }: { result: ChartResult; view?: string }) {
  if (result.kind === "benchmark") {
    if (!result.available) return null;
    return <BenchmarkPreview result={result} />;
  }

  if (result.kind === "executive") {
    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-panel-tint">
        <div className="grid grid-cols-2 gap-px bg-border-lighter sm:grid-cols-3 lg:grid-cols-5">
          {result.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 bg-white px-3 py-4 sm:px-4">
              <p className="truncate text-xl font-extrabold text-text-900 sm:text-2xl">
                {metric.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-text-600">{metric.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-text-400">{metric.detail}</p>
            </div>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
            Key observations
          </p>
          <div className="mt-3 space-y-3">
            {result.observations.map((observation, index) => (
              <div key={observation} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-xs leading-5 text-text-600">{observation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (result.kind === "participation") {
    if (view === "table") {
      return <ChartPreview result={participationTableResult(result)} />;
    }
    if (view === "stacked") {
      return <AlternateBarPreview result={participationBarResult(result)} stacked />;
    }

    return (
      <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {result.benefits.map((benefit) => {
            const enrolledWidth = benefit.eligible
              ? (benefit.enrolled / benefit.eligible) * 100
              : 0;
            const waivedWidth = benefit.eligible
              ? (benefit.waived / benefit.eligible) * 100
              : 0;
            const unreportedWidth = benefit.eligible
              ? (benefit.unreported / benefit.eligible) * 100
              : 0;

            return (
              <div key={benefit.name} className="rounded-[10px] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-900">{benefit.name}</p>
                    <p className="mt-0.5 text-[10px] text-text-400">
                      {benefit.eligible} eligible employees
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-text-900">
                      {benefit.participation.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-text-400">participation</p>
                  </div>
                </div>

                <div
                  className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-border-lighter"
                  aria-label={`${benefit.name}: ${benefit.enrolled} enrolled, ${benefit.waived} waived, ${benefit.unreported} not recorded`}
                >
                  <span className="bg-ink-900" style={{ width: `${enrolledWidth}%` }} />
                  <span className="bg-amber" style={{ width: `${waivedWidth}%` }} />
                  <span className="bg-text-300" style={{ width: `${unreportedWidth}%` }} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-bold text-text-900">{benefit.enrolled}</p>
                    <p className="text-[10px] text-text-400">Enrolled</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-amber">{benefit.waived}</p>
                    <p className="text-[10px] text-text-400">Waived</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-text-600">{benefit.unreported}</p>
                    <p className="text-[10px] text-text-400">Not recorded</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-text-400">{result.note}</p>
      </div>
    );
  }

  if (result.kind === "contribution") {
    if (view === "stacked") {
      return <AlternateBarPreview result={contributionBarResult(result)} stacked currency />;
    }

    const matchPercentage = result.totalElections
      ? (result.matchedElections / result.totalElections) * 100
      : 0;
    const marketContext = result.medicalCostPerEmployeeBenchmark;
    const summaryMetrics = [
      { label: "Estimated annual premium", value: formatCompactCurrency(result.annualTotalSpend) },
      { label: "Employer-funded annual", value: formatCompactCurrency(result.annualEmployerSpend) },
      { label: "Employee-funded annual", value: formatCompactCurrency(result.annualEmployeeSpend) },
      {
        label: "Elections matched",
        value: `${matchPercentage.toFixed(1)}%`,
        detail: `${result.matchedElections} of ${result.totalElections}`,
      },
      ...(marketContext
        ? [{
            label: "Medical cost per employee",
            value: formatCompactCurrency(marketContext.clientValue),
            detail: [
              marketContext.national.value === null
                ? null
                : `${marketContext.nationalLabel} ${formatCompactCurrency(marketContext.national.value)}`,
              marketContext.peer.value === null
                ? null
                : `${marketContext.peerLabel} ${formatCompactCurrency(marketContext.peer.value)}`,
            ].filter(Boolean).join(" · "),
          }]
        : []),
    ];

    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
        <div className={`grid grid-cols-2 gap-px bg-border-lighter ${marketContext ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className="bg-panel-tint px-3 py-3.5 sm:px-4">
              <p className="text-lg font-extrabold text-text-900 sm:text-xl">
                {metric.value}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-text-400">
                {metric.label}{metric.detail ? ` · ${metric.detail}` : ""}
              </p>
            </div>
          ))}
        </div>

        {result.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[940px] divide-y divide-border-lighter text-xs">
              <thead className="bg-white">
                <tr>
                  {[
                    "Benefit / plan",
                    "Coverage tier",
                    "Enrolled",
                    "Employee deduction",
                    "Employer contribution",
                    "Employer paid",
                    "Est. annual premium",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-2.5 text-left text-[10px] font-bold tracking-[0.04em] whitespace-nowrap text-text-400 uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-lighter">
                {result.rows.map((row, index) => (
                  <tr key={`${row.benefit}-${row.plan}-${row.tier}-${index}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-text-900">{row.benefit}</p>
                      <p className="text-[10px] text-text-400">{row.plan}</p>
                    </td>
                    <td className="px-3 py-2.5 text-text-600">{row.tier}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-900">{row.enrolled}</td>
                    <td className="px-3 py-2.5 text-text-600">
                      {formatRate(row.employeeRate)} / {ratePeriodShort(row.ratePeriod)}
                    </td>
                    <td className="px-3 py-2.5 text-text-600">
                      {formatRate(row.employerRate)} / {ratePeriodShort(row.ratePeriod)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border-lighter">
                          <div
                            className="h-full bg-ink-900"
                            style={{ width: `${Math.min(100, row.employerPaidPercentage)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-text-900">
                          {row.employerPaidPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-text-900">
                      {formatCompactCurrency(row.annualTotalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-text-400">
            Add policy rates to calculate contribution strategy and annual spend.
          </p>
        )}
        <p className="border-t border-border-lighter bg-panel-tint px-4 py-3 text-[10px] leading-4 text-text-400">
          {result.note}
          {marketContext ? ` Mercer source: ${marketContext.datasetTitle}, ${marketContext.surveyYear} (version ${marketContext.version}).` : ""}
        </p>
      </div>
    );
  }

  if (result.kind === "renewal") {
    if (!result.available) return null;
    if (view === "bar") {
      return <AlternateBarPreview result={renewalBarResult(result)} currency />;
    }
    const summaryCards = [
      {
        label: "Employer annual impact",
        value: formatSignedCompactCurrency(result.summary.employerChange),
        change: formatChange(result.summary.employerChangePercentage),
        detail: `${formatCompactCurrency(result.summary.priorAnnualEmployerCost)} → ${formatCompactCurrency(result.summary.currentAnnualEmployerCost)}`,
      },
      {
        label: "Employee annual impact",
        value: formatSignedCompactCurrency(result.summary.employeeChange),
        change: formatChange(result.summary.employeeChangePercentage),
        detail: `${formatCompactCurrency(result.summary.priorAnnualEmployeeCost)} → ${formatCompactCurrency(result.summary.currentAnnualEmployeeCost)}`,
      },
      {
        label: "Total renewal impact",
        value: formatSignedCompactCurrency(result.summary.totalChange),
        change: formatChange(result.summary.totalChangePercentage),
        detail: `${formatCompactCurrency(result.summary.priorAnnualTotalCost)} → ${formatCompactCurrency(result.summary.currentAnnualTotalCost)}`,
      },
      {
        label: "Comparable rate rows",
        value: String(result.comparableRows),
        change: `${result.renamedRows} renamed`,
        detail: `${result.newRows} new · ${result.removedRows} removed`,
      },
    ];

    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
        <div className="grid grid-cols-2 gap-px bg-border-lighter lg:grid-cols-4">
          {summaryCards.map((card, index) => (
            <div key={card.label} className="min-w-0 bg-panel-tint px-3 py-3.5 sm:px-4">
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-extrabold text-text-900 sm:text-xl">{card.value}</p>
                <p
                  className={`text-[10px] font-bold ${index < 3 && card.change.startsWith("+") ? "text-amber" : "text-text-600"}`}
                >
                  {card.change}
                </p>
              </div>
              <p className="mt-1 text-xs font-semibold text-text-900">{card.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-text-400">{card.detail}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] divide-y divide-border-lighter text-xs">
            <thead>
              <tr>
                {[
                  "Benefit / plan",
                  "Coverage tier",
                  `${result.currentLabel} enrolled`,
                  "Employee rate",
                  "Employer rate",
                  "Annual premium impact",
                  "Rate change",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2.5 text-left text-[10px] font-bold tracking-[0.04em] whitespace-nowrap text-text-400 uppercase"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-lighter">
              {result.rows.map((row, index) => {
                const employeeRates =
                  row.priorEmployeeRate === null || row.currentEmployeeRate === null
                    ? row.status === "new"
                      ? `New · ${formatRate(row.currentEmployeeRate ?? 0)} / ${ratePeriodShort(row.currentRatePeriod ?? "")}`
                      : `${formatRate(row.priorEmployeeRate ?? 0)} / ${ratePeriodShort(row.priorRatePeriod ?? "")} · Removed`
                    : `${formatRate(row.priorEmployeeRate)} / ${ratePeriodShort(row.priorRatePeriod ?? "")} → ${formatRate(row.currentEmployeeRate)} / ${ratePeriodShort(row.currentRatePeriod ?? "")}`;
                const employerRates =
                  row.priorEmployerRate === null || row.currentEmployerRate === null
                    ? row.status === "new"
                      ? `New · ${formatRate(row.currentEmployerRate ?? 0)} / ${ratePeriodShort(row.currentRatePeriod ?? "")}`
                      : `${formatRate(row.priorEmployerRate ?? 0)} / ${ratePeriodShort(row.priorRatePeriod ?? "")} · Removed`
                    : `${formatRate(row.priorEmployerRate)} / ${ratePeriodShort(row.priorRatePeriod ?? "")} → ${formatRate(row.currentEmployerRate)} / ${ratePeriodShort(row.currentRatePeriod ?? "")}`;
                return (
                  <tr key={`${row.benefit}-${row.currentPlan}-${row.priorPlan}-${row.tier}-${index}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-text-900">{row.benefit}</p>
                          <p className="text-[10px] text-text-400">
                            {row.status === "renamed"
                              ? `${row.priorPlan} → ${row.currentPlan}`
                              : row.currentPlan ?? row.priorPlan}
                          </p>
                        </div>
                        {row.status !== "matched" && (
                          <span className="rounded-full bg-panel-tint px-2 py-0.5 text-[9px] font-bold text-text-600 capitalize">
                            {row.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-600">{row.tier}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-900">
                      {row.status === "removed" ? "—" : row.enrolled}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-600">{employeeRates}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-600">{employerRates}</td>
                    <td className="px-3 py-2.5 font-bold text-text-900">
                      {row.totalChange === null ? "—" : formatSignedCompactCurrency(row.totalChange)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-text-900">
                      {formatChange(row.totalChangePercentage)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border-lighter bg-panel-tint px-4 py-3 text-[9px] leading-4 text-text-400">
          {result.note}
        </p>
      </div>
    );
  }

  if (result.kind === "risk") {
    const maximumCell = Math.max(0, ...result.cells.map((cell) => cell.count));

    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
        <div className="grid grid-cols-2 gap-px bg-border-lighter lg:grid-cols-4">
          {result.indicators.map((indicator) => (
            <div key={indicator.key} className="min-w-0 bg-panel-tint px-3 py-3.5 sm:px-4">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-extrabold text-text-900 sm:text-2xl">
                  {indicator.value}
                </p>
                <p className="text-xs font-bold text-text-600">
                  {indicator.percentage.toFixed(1)}%
                </p>
              </div>
              <p className="mt-1 text-xs font-semibold text-text-900">{indicator.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-text-400">
                {indicator.definition} · {indicator.denominator} records
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-text-900">Age × tenure concentration</p>
                <p className="mt-0.5 text-[10px] text-text-400">
                  {result.completeRecords} of {result.totalEmployees} employees have both dates
                </p>
              </div>
              <p className="text-[10px] text-text-400">Darker cells = more employees</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[560px] border-separate border-spacing-1 text-center text-[10px]">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold text-text-400">Age</th>
                    {result.tenureBands.map((tenureBand) => (
                      <th key={tenureBand} className="px-2 py-1 font-semibold text-text-600">
                        {tenureBand}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.ageBands.map((ageBand) => (
                    <tr key={ageBand}>
                      <th className="px-2 py-2 text-left font-semibold whitespace-nowrap text-text-600">
                        {ageBand}
                      </th>
                      {result.tenureBands.map((tenureBand) => {
                        const count =
                          result.cells.find(
                            (cell) =>
                              cell.ageBand === ageBand && cell.tenureBand === tenureBand
                          )?.count ?? 0;
                        const backgroundColor = riskHeatColor(count, maximumCell);
                        const darkText = count === 0 || maximumCell === 0 || count / maximumCell < 0.5;
                        return (
                          <td
                            key={tenureBand}
                            className={`h-11 rounded-[7px] font-bold ${darkText ? "text-text-900" : "text-white"}`}
                            style={{ backgroundColor }}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[10px] bg-panel-tint p-4">
            <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
              Planning observations
            </p>
            <div className="mt-3 space-y-3">
              {result.observations.map((observation, index) => (
                <div key={observation} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[11px] leading-[1.45] text-text-600">{observation}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-border-lighter pt-3 text-[9px] leading-4 text-text-400">
              {result.note}
            </p>
          </div>
        </div>

        <p className="border-t border-border-lighter bg-panel-tint px-4 py-2.5 text-[9px] leading-4 text-text-400">
          Data coverage: birth dates {result.birthDateRecords}/{result.totalEmployees} · hire dates{" "}
          {result.hireDateRecords}/{result.totalEmployees} · both {result.completeRecords}/
          {result.totalEmployees}
        </p>
      </div>
    );
  }

  if (result.kind === "quality") {
    const validZipPercentage = result.totalEmployees
      ? (result.validZipRecords / result.totalEmployees) * 100
      : 0;
    const completeRecordPercentage = result.totalEmployees
      ? (result.completeRecords / result.totalEmployees) * 100
      : 0;
    const matchPercentage = result.activeElections
      ? (result.matchedElections / result.activeElections) * 100
      : null;
    const metrics = [
      {
        label: "Core census completeness",
        value: `${result.censusCompleteness.toFixed(1)}%`,
        detail: "Across birth date, hire date, ZIP, and salary",
      },
      {
        label: "Valid ZIP coverage",
        value: `${validZipPercentage.toFixed(1)}%`,
        detail: `${result.validZipRecords} of ${result.totalEmployees} employees mapped`,
      },
      {
        label: "Unmatched elections",
        value: String(result.unmatchedElections),
        detail:
          matchPercentage === null
            ? "No active elections to match"
            : `${matchPercentage.toFixed(1)}% rate-row match coverage`,
        attention: result.unmatchedElections > 0,
      },
      {
        label: "Fully complete records",
        value: `${completeRecordPercentage.toFixed(1)}%`,
        detail: `${result.completeRecords} of ${result.totalEmployees} employees`,
      },
    ];

    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
        <div className="grid grid-cols-2 gap-px bg-border-lighter lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 bg-panel-tint px-3 py-3.5 sm:px-4">
              <p
                className={`text-xl font-extrabold sm:text-2xl ${metric.attention ? "text-amber" : "text-text-900"}`}
              >
                {metric.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-text-900">{metric.label}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-text-400">{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
          <div className="rounded-[10px] border border-border-lighter p-4">
            <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
              Census field audit
            </p>
            <div className="mt-3 space-y-3">
              {result.fields.map((field) => (
                <div key={field.key}>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-semibold text-text-900">{field.label}</span>
                    <span className="whitespace-nowrap text-text-600">
                      {field.complete} complete · {field.missing} missing
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-lighter">
                      <div
                        className="h-full rounded-full bg-ink-900"
                        style={{ width: `${Math.min(100, field.coverage)}%` }}
                      />
                    </div>
                    <span className="w-11 text-right text-[10px] font-bold text-text-600">
                      {field.coverage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] bg-panel-tint p-4">
            <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
              Quality findings
            </p>
            <div className="mt-3 space-y-3">
              {result.findings.map((finding, index) => (
                <div key={finding} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[11px] leading-[1.45] text-text-600">{finding}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="border-t border-border-lighter bg-panel-tint px-4 py-3 text-[9px] leading-4 text-text-400">
          {result.note}
        </p>
      </div>
    );
  }

  if (result.kind === "stats") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {result.stats.map((s) => (
          <div key={s.label} className="rounded-[10px] bg-panel-tint px-3 py-2.5">
            <p className="text-lg font-bold text-text-900">{s.value}</p>
            <p className="text-xs text-text-600">{s.label}</p>
          </div>
        ))}
      </div>
    );
  }

  if (result.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-[10px] border border-border-lighter">
        <table className="min-w-full divide-y divide-border-lighter text-xs">
          <thead className="bg-panel-tint">
            <tr>
              {result.columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold text-text-600">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-lighter">
            {result.rows.slice(0, 8).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-text-900">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length > 8 && (
          <p className="px-3 py-2 text-xs text-text-400">
            +{result.rows.length - 8} more row(s) in the generated deck
          </p>
        )}
      </div>
    );
  }

  if (result.kind === "pie") {
    return (
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={result.data} dataKey="value" nameKey="name" outerRadius={90} label>
              {result.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={CHART_FONT} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (result.kind === "map") {
    if (view === "table") {
      return <ChartPreview result={geographyTableResult(result)} />;
    }
    if (view === "bar") {
      return <AlternateBarPreview result={geographyBarResult(result)} horizontal />;
    }

    const topAreas = [...result.areas].sort((a, b) => b.value - a.value).slice(0, 4);
    const coverage = result.totalEmployees
      ? Math.round((result.mappedEmployees / result.totalEmployees) * 100)
      : 0;
    const mapSvg = renderGeographyMapSvg(result, COLORS[0]);

    return (
      <div className="grid gap-4 rounded-[10px] border border-border-lighter bg-white p-3 md:grid-cols-[minmax(0,2fr)_minmax(190px,1fr)] md:p-4">
        <div
          className="min-w-0 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: mapSvg }}
        />
        <div className="rounded-[10px] bg-panel-tint p-4">
          <p className="text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
            {result.level === "state"
              ? "U.S. state view"
              : `${result.focusStateName} county view`}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-900">{coverage}% mapped</p>
          <p className="text-xs text-text-600">
            {result.mappedEmployees} of {result.totalEmployees} employees · {result.areas.length}{" "}
            {result.level === "state" ? "states" : "counties"}
          </p>
          <p className="mt-4 text-[11px] font-bold tracking-[0.08em] text-text-400 uppercase">
            Top locations
          </p>
          <div className="mt-2 space-y-2">
            {topAreas.map((area) => (
              <div key={area.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-text-600">{area.name}</span>
                <span className="font-bold text-text-900">{area.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-4 text-text-400">{result.note}</p>
        </div>
      </div>
    );
  }

  if (view === "table") {
    return <ChartPreview result={tierTableResult([result])} />;
  }
  if (view === "stacked") {
    return <AlternateBarPreview result={result} stacked normalize />;
  }

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={result.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efeee9" />
          <XAxis dataKey={result.xKey} tick={CHART_FONT} />
          <YAxis tick={CHART_FONT} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={CHART_FONT} />
          {result.series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BenchmarkPreview({
  result,
}: {
  result: Extract<ChartResult, { kind: "benchmark"; available: true }>;
}) {
  if (result.mode === "prevalence") {
    return (
      <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {result.rows.map((row) => (
            <div key={row.subtype} className="rounded-[10px] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-text-900">{row.subtype}</p>
                <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.offered ? "bg-teal-bright/20 text-teal-deep" : "bg-panel-tint text-text-400"}`}>
                  {row.offered ? "Client offers" : "Not offered"}
                </span>
              </div>
              <BenchmarkPreviewBar label="National" point={row.national} />
              <BenchmarkPreviewBar label={result.peerLabel} point={row.peer} accent />
            </div>
          ))}
        </div>
        <BenchmarkPreviewNote result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.mode === "cost" && result.medicalCostPerEmployee.available && (
        <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-4">
          <p className="text-[10px] font-bold tracking-[0.06em] text-text-400 uppercase">
            Annual medical cost per employee
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Client", value: result.medicalCostPerEmployee.clientValue },
              { label: result.nationalLabel, value: result.medicalCostPerEmployee.national.value },
              { label: result.peerLabel, value: result.medicalCostPerEmployee.peer.value },
            ].map((item) => (
              <div key={item.label} className="rounded-[9px] bg-white px-3 py-3">
                <p className="truncate text-[9px] font-semibold text-text-400" title={item.label}>{item.label}</p>
                <p className="mt-1 text-lg font-extrabold text-text-900">{formatBenchmarkValue(item.value, "currency_pepy")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.plans.map((plan) => {
        const groups = result.mode === "cost"
          ? [
              { label: "Monthly premium", rows: plan.premiumRows },
              { label: "Employee contribution", rows: plan.contributionRows },
            ]
          : [{ label: "Plan provisions", rows: plan.designRows }];
        return (
          <div key={plan.id} className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
            <div className="flex items-center justify-between gap-3 bg-panel-tint px-4 py-3">
              <div>
                <p className="text-sm font-bold text-text-900">{plan.name}</p>
                <p className="text-[10px] text-text-400">{plan.subtype} · recorded company values with market context</p>
              </div>
              <p className="text-[10px] font-semibold text-text-400">National · {result.peerLabel}</p>
            </div>
            <div className={`grid gap-px bg-border-lighter ${groups.length === 2 ? "lg:grid-cols-2" : ""}`}>
              {groups.map((group) => (
                <div key={group.label} className="min-w-0 bg-white p-4">
                  <p className="mb-2 text-[10px] font-bold tracking-[0.06em] text-text-400 uppercase">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.rows.slice(0, result.mode === "design" ? 8 : 4).map((row) => (
                      <div key={row.metricCode} className="grid grid-cols-[minmax(0,1fr)_70px_70px_70px] items-center gap-2 text-[10px]">
                        <span className="truncate font-semibold text-text-600" title={row.label}>{benchmarkRowLabel(row.label, row.tier)}</span>
                        <span className="text-right font-bold text-text-900">{formatBenchmarkValue(row.clientValue, row.unit)}</span>
                        <span className="text-right text-text-400">{formatBenchmarkPoint(row.national, row.unit)}</span>
                        <span className="text-right font-semibold text-teal-deep">{formatBenchmarkPoint(row.peer, row.unit)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <BenchmarkPreviewNote result={result} />
    </div>
  );
}

function BenchmarkPreviewBar({
  label,
  point,
  accent = false,
}: {
  label: string;
  point: { value: number | null; availability: string };
  accent?: boolean;
}) {
  const value = point.value;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate text-text-400" title={label}>{label}</span>
        <span className="font-bold text-text-600">{formatBenchmarkPoint(point, "percentage")}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-border-lighter">
        {value !== null && <div className={`h-full rounded-full ${accent ? "bg-teal-deep" : "bg-text-300"}`} style={{ width: `${Math.min(100, value * 100)}%` }} />}
      </div>
    </div>
  );
}

function BenchmarkPreviewNote({
  result,
}: {
  result: Extract<ChartResult, { kind: "benchmark"; available: true }>;
}) {
  return (
    <p className="mt-3 text-[10px] leading-4 text-text-400">
      Source: {result.datasetTitle}, {result.surveyYear} · Version {result.version}. {result.note}
    </p>
  );
}

function benchmarkRowLabel(label: string, tier: string | null): string {
  if (tier) return tierLabelForBenchmark(tier);
  return label.replace(/^(PPO|HDHP|HMO) /, "");
}

function tierLabelForBenchmark(tier: string): string {
  return ({ EE: "Employee", ES: "Employee + Spouse", EC: "Employee + Child(ren)", EF: "Family" } as Record<string, string>)[tier] ?? tier;
}

function formatBenchmarkPoint(
  point: { value: number | null; availability: string },
  unit: string
): string {
  if (point.value !== null) return formatBenchmarkValue(point.value, unit);
  if (point.availability === "insufficient_data") return "ID";
  if (point.availability === "not_applicable") return "N/A";
  return "—";
}

function formatBenchmarkValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "percentage") return `${Math.round(value * 100)}%`;
  if (unit.startsWith("currency")) return formatCompactCurrency(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function AlternateBarPreview({
  result,
  stacked = false,
  normalize = false,
  currency = false,
  horizontal = false,
}: {
  result: Extract<ChartResult, { kind: "bar" }>;
  stacked?: boolean;
  normalize?: boolean;
  currency?: boolean;
  horizontal?: boolean;
}) {
  const data = normalize
    ? result.data.map((row) => {
        const total = result.series.reduce(
          (sum, series) => sum + (Number(row[series.key]) || 0),
          0
        );
        return {
          ...row,
          ...Object.fromEntries(
            result.series.map((series) => [
              series.key,
              total ? ((Number(row[series.key]) || 0) / total) * 100 : 0,
            ])
          ),
        };
      })
    : result.data;
  const formatAxis = (value: number) =>
    normalize ? `${Math.round(value)}%` : currency ? formatCompactCurrency(value) : String(value);

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { left: 30, right: 18 } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#efeee9" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={CHART_FONT} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey={result.xKey}
                tick={CHART_FONT}
                width={115}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={result.xKey} tick={CHART_FONT} />
              <YAxis
                tick={CHART_FONT}
                allowDecimals={false}
                domain={normalize ? [0, 100] : undefined}
                tickFormatter={formatAxis}
              />
            </>
          )}
          <Tooltip
            formatter={(value) => formatAxis(Number(value))}
          />
          <Legend wrapperStyle={CHART_FONT} />
          {result.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId={stacked ? "selected-view" : undefined}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
