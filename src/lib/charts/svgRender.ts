import { Resvg } from "@resvg/resvg-js";
import { formatNumber } from "@/lib/number-format";
import type { ChartResult } from "./types";

export function svgToPng(svg: string, scale = 2): Buffer {
  const resvg = new Resvg(svg, { fitTo: { mode: "zoom", value: scale } });
  return resvg.render().asPng();
}

const FONT = "Helvetica, Arial, sans-serif";

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const residual = rawMax / magnitude;
  let niceResidual: number;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Callers pass hex colors without a leading "#" (pptxgenjs's convention),
// but raw SVG fill/stroke attributes require it — otherwise it silently
// falls back to black instead of erroring.
function hex(color: string): string {
  return color.startsWith("#") ? color : `#${color}`;
}

// Picks readable label text (black or white) against a given fill color
// using perceived luminance, so slice labels stay legible on dark colors.
function contrastText(fillHex: string): string {
  const c = fillHex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

export function renderBarChartSvg(
  result: Extract<ChartResult, { kind: "bar" }>,
  colors: string[],
  width = 1200,
  height = 560,
  options: { valueFormat?: "number" | "currency" } = {}
): string {
  const marginLeft = 70;
  const marginRight = 30;
  const marginTop = 20;
  const marginBottom = result.series.length > 1 ? 90 : 60;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const rawMax = Math.max(
    1,
    ...result.data.map((d) => Math.max(...result.series.map((s) => Number(d[s.key]) || 0)))
  );
  const max = niceMax(rawMax);
  const gridSteps = 5;

  const categoryCount = result.data.length;
  const categoryW = plotW / categoryCount;
  const groupPadding = categoryW * 0.18;
  const barsAreaW = categoryW - groupPadding * 2;
  const barW = barsAreaW / result.series.length;

  const yFor = (v: number) => marginTop + plotH - (v / max) * plotH;
  const formatValue = (value: number) =>
    options.valueFormat === "currency"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          notation: Math.abs(value) >= 10000 ? "compact" : "standard",
          maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
        }).format(value)
      : Math.round(value).toLocaleString("en-US");

  let gridlines = "";
  let yLabels = "";
  for (let i = 0; i <= gridSteps; i++) {
    const v = (max / gridSteps) * i;
    const y = yFor(v);
    gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`;
    yLabels += `<text x="${marginLeft - 10}" y="${y + 4}" text-anchor="end" font-size="15" fill="#6b7280" font-family="${FONT}">${esc(formatValue(v))}</text>`;
  }

  let bars = "";
  let xLabels = "";
  result.data.forEach((row, catIndex) => {
    const catX = marginLeft + catIndex * categoryW + groupPadding;
    result.series.forEach((s, seriesIndex) => {
      const value = Number(row[s.key]) || 0;
      const barH = (value / max) * plotH;
      const x = catX + seriesIndex * barW;
      const y = marginTop + plotH - barH;
      const color = hex(colors[seriesIndex % colors.length]);
      bars += `<rect x="${x + 1}" y="${y}" width="${Math.max(barW - 2, 1)}" height="${barH}" fill="${color}" />`;
    });
    const labelX = marginLeft + catIndex * categoryW + categoryW / 2;
    xLabels += `<text x="${labelX}" y="${marginTop + plotH + 24}" text-anchor="middle" font-size="15" fill="#374151" font-family="${FONT}">${esc(String(row[result.xKey]))}</text>`;
  });

  let legend = "";
  if (result.series.length > 1) {
    const legendY = height - 28;
    let legendX = marginLeft;
    result.series.forEach((s, i) => {
      const color = hex(colors[i % colors.length]);
      const label = s.label;
      const textWidth = label.length * 8 + 30;
      legend += `<rect x="${legendX}" y="${legendY - 12}" width="14" height="14" fill="${color}" />`;
      legend += `<text x="${legendX + 20}" y="${legendY}" font-size="14" fill="#374151" font-family="${FONT}">${esc(label)}</text>`;
      legendX += textWidth;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    ${gridlines}
    <line x1="${marginLeft}" y1="${marginTop + plotH}" x2="${width - marginRight}" y2="${marginTop + plotH}" stroke="#9ca3af" stroke-width="1.5" />
    ${bars}
    ${yLabels}
    ${xLabels}
    ${legend}
  </svg>`;
}

export function renderStackedBarChartSvg(
  result: Extract<ChartResult, { kind: "bar" }>,
  colors: string[],
  width = 1200,
  height = 560,
  options: { normalize?: boolean; valueFormat?: "number" | "currency" } = {}
): string {
  const marginLeft = 90;
  const marginRight = 30;
  const marginTop = 20;
  const marginBottom = 90;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;
  const normalized = options.normalize ?? false;
  const rows = result.data.map((row) => {
    const total = result.series.reduce(
      (sum, series) => sum + (Number(row[series.key]) || 0),
      0
    );
    return {
      row,
      values: result.series.map((series) => {
        const value = Number(row[series.key]) || 0;
        return normalized && total ? (value / total) * 100 : value;
      }),
    };
  });
  const rawMax = normalized
    ? 100
    : Math.max(1, ...rows.map(({ values }) => values.reduce((sum, value) => sum + value, 0)));
  const max = normalized ? 100 : niceMax(rawMax);
  const categoryW = plotW / Math.max(1, rows.length);
  const barW = Math.min(categoryW * 0.62, 190);
  const yFor = (value: number) => marginTop + plotH - (value / max) * plotH;
  const formatValue = (value: number) => {
    if (normalized) return `${Math.round(value)}%`;
    if (options.valueFormat === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: Math.abs(value) >= 10000 ? "compact" : "standard",
        maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
      }).format(value);
    }
    return Math.round(value).toLocaleString("en-US");
  };

  let gridlines = "";
  let yLabels = "";
  for (let index = 0; index <= 5; index++) {
    const value = (max / 5) * index;
    const y = yFor(value);
    gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`;
    yLabels += `<text x="${marginLeft - 12}" y="${y + 4}" text-anchor="end" font-size="14" fill="#6b7280" font-family="${FONT}">${esc(formatValue(value))}</text>`;
  }

  let bars = "";
  let xLabels = "";
  rows.forEach(({ row, values }, rowIndex) => {
    const x = marginLeft + rowIndex * categoryW + (categoryW - barW) / 2;
    let cumulative = 0;
    values.forEach((value, seriesIndex) => {
      if (value <= 0) return;
      const segmentHeight = (value / max) * plotH;
      const y = yFor(cumulative + value);
      const color = hex(colors[seriesIndex % colors.length]);
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${segmentHeight}" fill="${color}" />`;
      if (segmentHeight >= 28) {
        bars += `<text x="${x + barW / 2}" y="${y + segmentHeight / 2 + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="${contrastText(color)}" font-family="${FONT}">${esc(formatValue(value))}</text>`;
      }
      cumulative += value;
    });
    const labelX = marginLeft + rowIndex * categoryW + categoryW / 2;
    xLabels += `<text x="${labelX}" y="${marginTop + plotH + 25}" text-anchor="middle" font-size="15" fill="#374151" font-family="${FONT}">${esc(String(row[result.xKey]))}</text>`;
  });

  const legendY = height - 28;
  let legendX = marginLeft;
  let legend = "";
  result.series.forEach((series, index) => {
    const color = hex(colors[index % colors.length]);
    const textWidth = series.label.length * 8 + 34;
    legend += `<rect x="${legendX}" y="${legendY - 12}" width="14" height="14" fill="${color}" />`;
    legend += `<text x="${legendX + 20}" y="${legendY}" font-size="14" fill="#374151" font-family="${FONT}">${esc(series.label)}</text>`;
    legendX += textWidth;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    ${gridlines}
    <line x1="${marginLeft}" y1="${marginTop + plotH}" x2="${width - marginRight}" y2="${marginTop + plotH}" stroke="#9ca3af" stroke-width="1.5" />
    ${bars}
    ${yLabels}
    ${xLabels}
    ${legend}
  </svg>`;
}

export function renderPieChartSvg(
  result: Extract<ChartResult, { kind: "pie" }>,
  colors: string[],
  width = 600,
  height = 560
): string {
  const cx = width / 2;
  const cy = (height - 60) / 2 + 10;
  const r = Math.min(cx, cy) - 30;
  const total = result.data.reduce((sum, d) => sum + d.value, 0);

  function polarPoint(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  }

  let angle = 0;
  let slices = "";
  let labels = "";
  result.data.forEach((d, i) => {
    if (total === 0 || d.value === 0) return;
    const sliceAngle = (d.value / total) * 360;
    const startAngle = angle;
    const endAngle = angle + sliceAngle;
    const [x1, y1] = polarPoint(startAngle);
    const [x2, y2] = polarPoint(endAngle);
    const largeArc = sliceAngle > 180 ? 1 : 0;
    const color = hex(colors[i % colors.length]);
    slices += `<path d="M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}" stroke="#ffffff" stroke-width="2" />`;

    if (sliceAngle > 12) {
      const midAngle = startAngle + sliceAngle / 2;
      const [lx, ly] = (() => {
        const rad = (midAngle * Math.PI) / 180;
        const lr = r * 0.65;
        return [cx + lr * Math.sin(rad), cy - lr * Math.cos(rad)];
      })();
      labels += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="17" fill="${contrastText(color)}" font-family="${FONT}" font-weight="600">${esc(formatNumber(d.value))}</text>`;
    }
    angle = endAngle;
  });

  const legendY = height - 22;
  const totalLegendWidth = result.data.reduce((sum, d) => sum + d.name.length * 8 + 34, 0);
  let legendX = Math.max(10, cx - totalLegendWidth / 2);
  let legend = "";
  result.data.forEach((d, i) => {
    const color = hex(colors[i % colors.length]);
    legend += `<rect x="${legendX}" y="${legendY - 12}" width="14" height="14" fill="${color}" />`;
    legend += `<text x="${legendX + 20}" y="${legendY}" font-size="14" fill="#374151" font-family="${FONT}">${esc(d.name)}</text>`;
    legendX += d.name.length * 8 + 34;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    ${slices}
    ${labels}
    ${legend}
  </svg>`;
}
