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

type ChartDefinition = {
  key: string;
  label: string;
  description: string;
  category: string;
};

const COLORS = ["#1F2937", "#2FE0D2", "#F59E0B", "#6366F1", "#EF4444"];
const CHART_FONT = { fontFamily: "Inter, sans-serif", fontSize: 11 };

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
                  className={`rounded-[14px] border bg-white p-[22px] shadow-[0_1px_2px_rgba(20,24,26,0.04)] ${
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
      <div className="h-64 w-full">
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

  return (
    <div className="h-64 w-full">
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
