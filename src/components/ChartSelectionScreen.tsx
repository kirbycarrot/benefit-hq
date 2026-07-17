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

const COLORS = ["#1F2937", "#14B8A6", "#F59E0B", "#6366F1", "#EF4444"];

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
      {saving && <p className="mb-2 text-xs text-gray-400">Saving...</p>}
      {Object.entries(grouped).map(([category, defs]) => (
        <div key={category} className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {category}
          </h3>
          <div className="space-y-4">
            {defs.map((def) => {
              const enabled = selections[def.key] ?? true;
              const result = chartResults[def.key];
              return (
                <div
                  key={def.key}
                  className={`rounded-lg border bg-white p-4 shadow-sm ${
                    enabled ? "border-gray-200" : "border-gray-100 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggle(def.key)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-900">{def.label}</span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500">{def.description}</p>
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
          <div key={s.label} className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-lg font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
    );
  }

  if (result.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-md border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr>
              {result.columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-medium text-gray-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {result.rows.slice(0, 8).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-gray-900">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.rows.length > 8 && (
          <p className="px-3 py-2 text-xs text-gray-400">
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={result.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey={result.xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {result.series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
