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
  initialSelections: Record<string, boolean>;
  chartResults: Record<string, ChartResult>;
}) {
  const [selections, setSelections] = useState(initialSelections);
  const [saving, setSaving] = useState(false);

  async function toggle(key: string) {
    const next = { ...selections, [key]: !selections[key] };
    setSelections(next);
    setSaving(true);
    await fetch(`/api/plan-years/${planYearId}/deck-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selections: Object.fromEntries(
          Object.entries(next).map(([k, enabled]) => [k, { enabled }])
        ),
      }),
    });
    setSaving(false);
  }

  const grouped = chartDefinitions.reduce<Record<string, ChartDefinition[]>>((acc, def) => {
    (acc[def.category] ??= []).push(def);
    return acc;
  }, {});

  return (
    <div>
      {saving && <p className="mb-2 text-xs text-text-400">Saving...</p>}
      {Object.entries(grouped).map(([category, defs]) => (
        <div key={category} className="mb-8">
          <h3 className="mb-3 text-xs font-bold tracking-[0.08em] text-text-600 uppercase">
            {category}
          </h3>
          <div className="space-y-4">
            {defs.map((def) => {
              const enabled = selections[def.key] ?? true;
              const result = chartResults[def.key];
              return (
                <div
                  key={def.key}
                  className={`min-w-0 rounded-[14px] border bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[22px] ${
                    enabled ? "border-border-light" : "border-border-lighter opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <label className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggle(def.key)}
                          className="h-4 w-4 rounded border-input-border accent-ink-900"
                        />
                        <span className="text-sm font-semibold text-text-900">{def.label}</span>
                      </label>
                      <p className="mt-1 ml-[26px] text-xs text-text-400">{def.description}</p>
                    </div>
                  </div>

                  {enabled && result && (
                    <div className="mt-4">
                      <ChartPreview result={result} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartPreview({ result }: { result: ChartResult }) {
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
    const matchPercentage = result.totalElections
      ? (result.matchedElections / result.totalElections) * 100
      : 0;

    return (
      <div className="overflow-hidden rounded-[12px] border border-border-lighter bg-white">
        <div className="grid grid-cols-2 gap-px bg-border-lighter lg:grid-cols-4">
          {[
            { label: "Estimated annual premium", value: result.annualTotalSpend },
            { label: "Employer-funded annual", value: result.annualEmployerSpend },
            { label: "Employee-funded annual", value: result.annualEmployeeSpend },
          ].map((metric) => (
            <div key={metric.label} className="bg-panel-tint px-3 py-3.5 sm:px-4">
              <p className="text-lg font-extrabold text-text-900 sm:text-xl">
                {formatCompactCurrency(metric.value)}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-text-400">{metric.label}</p>
            </div>
          ))}
          <div className="bg-panel-tint px-3 py-3.5 sm:px-4">
            <p className="text-lg font-extrabold text-text-900 sm:text-xl">
              {matchPercentage.toFixed(1)}%
            </p>
            <p className="mt-1 text-[10px] leading-4 text-text-400">
              Elections matched · {result.matchedElections} of {result.totalElections}
            </p>
          </div>
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
