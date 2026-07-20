import type { ChartResult } from "@/lib/charts/types";
import { formatNumber, formatWholeNumber } from "@/lib/number-format";

// Short, purely data-derived sentence per chart — no invented benchmarks or claims,
// just a factual highlight computed from the same numbers shown in the chart/table.
export function generateCaption(result: ChartResult): string {
  if (result.kind === "map") {
    const top = [...result.areas].sort((a, b) => b.value - a.value)[0];
    if (!top) return "";
    const share = result.mappedEmployees
      ? Math.round((top.value / result.mappedEmployees) * 100)
      : 0;
    return `${top.name} has the largest mapped employee concentration: ${formatWholeNumber(top.value)} (${share}% of mapped employees).`;
  }

  if (result.kind === "pie") {
    const total = result.data.reduce((sum, d) => sum + d.value, 0);
    const top = [...result.data].sort((a, b) => b.value - a.value)[0];
    if (!top || total === 0) return "";
    const share = Math.round((top.value / total) * 100);
    return `${top.name} accounts for ${share}% of the total (${formatNumber(top.value)} of ${formatNumber(total)}).`;
  }

  if (result.kind === "bar") {
    // A single category with multiple series (e.g. one coverage type broken
    // into tiers) is more informative compared across series than categories,
    // since "largest of one category" is always a trivial 100%.
    if (result.data.length === 1 && result.series.length > 1) {
      const row = result.data[0];
      const seriesValues = result.series.map((s) => ({
        label: s.label,
        value: Number(row[s.key]) || 0,
      }));
      const total = seriesValues.reduce((sum, s) => sum + s.value, 0);
      const top = [...seriesValues].sort((a, b) => b.value - a.value)[0];
      if (!top || total === 0) return "";
      const share = Math.round((top.value / total) * 100);
      return `Largest tier: ${top.label} — ${formatNumber(top.value)} (${share}%).`;
    }

    const rows = result.data.map((d) => ({
      label: String(d[result.xKey]),
      total: result.series.reduce((sum, s) => sum + (Number(d[s.key]) || 0), 0),
    }));
    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
    const top = [...rows].sort((a, b) => b.total - a.total)[0];
    if (!top || grandTotal === 0) return "";
    const share = Math.round((top.total / grandTotal) * 100);
    return `Largest group: ${top.label} — ${formatNumber(top.total)} (${share}%).`;
  }

  if (result.kind === "table") {
    if (result.rows.length === 0) return "";
    const first = result.rows[0];
    return `${result.columns[0]}: ${first[0]}  |  ${result.columns[1]}: ${first[1]}`;
  }

  return "";
}
