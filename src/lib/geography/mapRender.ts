import { geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countyAtlasRaw from "us-atlas/counties-albers-10m.json";
import type { ChartResult } from "@/lib/charts/types";

type MapResult = Extract<ChartResult, { kind: "map" }>;
type AtlasProperties = { name?: string };
type AtlasFeature = Feature<Geometry, AtlasProperties>;

const atlas = countyAtlasRaw as unknown as Topology;
const states = feature<AtlasProperties>(
  atlas,
  atlas.objects.states as GeometryCollection<AtlasProperties>
).features as AtlasFeature[];
const counties = feature<AtlasProperties>(
  atlas,
  atlas.objects.counties as GeometryCollection<AtlasProperties>
).features as AtlasFeature[];
const path = geoPath();
const FONT = "Helvetica, Arial, sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function normalizeHex(value: string): string {
  const normalized = value.replace("#", "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "1F2937";
}

function mixWithWhite(color: string, strength: number): string {
  const normalized = normalizeHex(color);
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) => Math.round(255 - (255 - channel) * strength));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function areaId(featureItem: AtlasFeature, length: number): string {
  return String(featureItem.id ?? "").padStart(length, "0");
}

function visibleFeatures(result: MapResult): AtlasFeature[] {
  if (result.level === "state") return states;
  return counties.filter((county) => areaId(county, 5).startsWith(result.focusStateFips ?? ""));
}

function colorScale(result: MapResult, color: string) {
  const values = new Map(result.areas.map((area) => [area.id, area.value]));
  const max = Math.max(1, ...result.areas.map((area) => area.value));
  const palette = [0.2, 0.36, 0.53, 0.7, 0.9].map((strength) =>
    mixWithWhite(color, strength)
  );

  return {
    palette,
    max,
    fillFor(id: string) {
      const value = values.get(id) ?? 0;
      if (value <= 0) return "#F1F3F4";
      const bucket = Math.min(palette.length - 1, Math.ceil((value / max) * palette.length) - 1);
      return palette[Math.max(0, bucket)];
    },
  };
}

function mapElements(
  result: MapResult,
  color: string,
  viewport: { x: number; y: number; width: number; height: number }
): string {
  const features = visibleFeatures(result);
  const collection: FeatureCollection<Geometry, AtlasProperties> = {
    type: "FeatureCollection",
    features,
  };
  const [[x0, y0], [x1, y1]] = path.bounds(collection);
  const sourceWidth = Math.max(1, x1 - x0);
  const sourceHeight = Math.max(1, y1 - y0);
  const padding = Math.min(viewport.width, viewport.height) * 0.035;
  const scale = Math.min(
    (viewport.width - padding * 2) / sourceWidth,
    (viewport.height - padding * 2) / sourceHeight
  );
  const translateX =
    viewport.x + padding + (viewport.width - padding * 2 - sourceWidth * scale) / 2 - x0 * scale;
  const translateY =
    viewport.y + padding + (viewport.height - padding * 2 - sourceHeight * scale) / 2 - y0 * scale;
  const { fillFor } = colorScale(result, color);
  const idLength = result.level === "state" ? 2 : 5;

  const shapes = features
    .map((featureItem) => {
      const id = areaId(featureItem, idLength);
      const count = result.areas.find((area) => area.id === id)?.value ?? 0;
      const name = featureItem.properties?.name ?? id;
      const d = path(featureItem);
      if (!d) return "";
      return `<path d="${d}" fill="${fillFor(id)}" stroke="#ffffff" stroke-width="1.1" vector-effect="non-scaling-stroke"><title>${esc(name)}: ${count} employee${count === 1 ? "" : "s"}</title></path>`;
    })
    .join("");

  return `<g transform="translate(${translateX} ${translateY}) scale(${scale})">${shapes}</g>`;
}

export function renderGeographyMapSvg(
  result: MapResult,
  color: string,
  width = 975,
  height = 610
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(result.title)}">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${mapElements(result, color, { x: 0, y: 0, width, height })}
  </svg>`;
}

export function renderWorkforceMapSvg(
  result: MapResult,
  color: string,
  width = 1200,
  height = 560
): string {
  const panelX = width * 0.69;
  const panelWidth = width - panelX - 18;
  const topAreas = [...result.areas].sort((a, b) => b.value - a.value).slice(0, 4);
  const coverage = result.totalEmployees
    ? Math.round((result.mappedEmployees / result.totalEmployees) * 100)
    : 0;
  const { palette, max } = colorScale(result, color);
  const rowStart = 188;
  const rows = topAreas
    .map((area, index) => {
      const y = rowStart + index * 54;
      return `<circle cx="${panelX + 28}" cy="${y + 8}" r="7" fill="${mixWithWhite(color, 0.9)}" />
        <text x="${panelX + 45}" y="${y + 13}" font-size="17" fill="#273036" font-family="${FONT}">${esc(area.name)}</text>
        <text x="${width - 42}" y="${y + 13}" text-anchor="end" font-size="18" font-weight="700" fill="#111827" font-family="${FONT}">${area.value}</text>`;
    })
    .join("");
  const legendX = panelX + 24;
  const legendY = height - 78;
  const swatchWidth = Math.max(28, (panelWidth - 48) / palette.length);
  const legend = palette
    .map(
      (fill, index) =>
        `<rect x="${legendX + index * swatchWidth}" y="${legendY}" width="${swatchWidth}" height="16" fill="${fill}" />`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${mapElements(result, color, { x: 5, y: 12, width: panelX - 18, height: height - 24 })}
    <rect x="${panelX}" y="16" width="${panelWidth}" height="${height - 32}" rx="18" fill="#F7F8F7" />
    <text x="${panelX + 24}" y="54" font-size="14" font-weight="700" letter-spacing="1.2" fill="#6B7280" font-family="${FONT}">${result.level === "state" ? "U.S. STATE VIEW" : `${esc(result.focusStateName ?? "STATE").toUpperCase()} COUNTY VIEW`}</text>
    <text x="${panelX + 24}" y="96" font-size="29" font-weight="700" fill="#111827" font-family="${FONT}">${coverage}% mapped</text>
    <text x="${panelX + 24}" y="123" font-size="15" fill="#6B7280" font-family="${FONT}">${result.mappedEmployees} of ${result.totalEmployees} employees · ${result.areas.length} ${result.level === "state" ? "states" : "counties"}</text>
    <text x="${panelX + 24}" y="166" font-size="14" font-weight="700" letter-spacing="1" fill="#6B7280" font-family="${FONT}">TOP LOCATIONS</text>
    ${rows}
    ${legend}
    <text x="${legendX}" y="${legendY + 38}" font-size="13" fill="#6B7280" font-family="${FONT}">Fewer</text>
    <text x="${legendX + palette.length * swatchWidth}" y="${legendY + 38}" text-anchor="end" font-size="13" fill="#6B7280" font-family="${FONT}">More (max ${max})</text>
    <text x="${panelX + 24}" y="${height - 18}" font-size="11" fill="#8A9197" font-family="${FONT}">${esc(result.note)}</text>
  </svg>`;
}
