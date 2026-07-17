import path from "path";
import PptxGenJS from "pptxgenjs";
import { prisma } from "@/lib/prisma";
import { loadChartDataset } from "@/lib/charts/dataset";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import { renderBarChartSvg, renderPieChartSvg, svgToPng } from "@/lib/charts/svgRender";
import { renderWorkforceMapSvg } from "@/lib/geography/mapRender";
import { generateCaption } from "@/lib/deck/captions";
import { formatDate } from "@/lib/date";
import type { ChartResult } from "@/lib/charts/types";

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const PALETTE_EXTRA = ["6366F1", "F59E0B", "EF4444", "10B981"];

// Related charts that read better combined on one slide than as three near-empty ones.
// Only applied when every key in the group is enabled — otherwise each renders on its own.
const CHART_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Coverage Tier Enrollment",
    keys: ["medical-tier-enrollment", "dental-tier-enrollment", "vision-tier-enrollment"],
  },
  {
    title: "Workforce Composition",
    keys: ["gender-breakdown", "employment-status-breakdown"],
  },
  {
    title: "Dependent Coverage Profile",
    keys: ["dependent-relationship-breakdown", "dependent-count-distribution"],
  },
];

function stripHash(hex: string): string {
  return hex.replace("#", "");
}

function paletteFor(primary: string, secondary: string): string[] {
  return [secondary, primary, ...PALETTE_EXTRA].map(stripHash);
}

function addHeader(slide: PptxGenJS.Slide, title: string, primary: string, secondary: string) {
  slide.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: 0.9, fill: { color: primary } });
  slide.addShape("rect", { x: 0, y: 0.9, w: SLIDE_W, h: 0.06, fill: { color: secondary } });
  slide.addText(title, {
    x: 0.5,
    y: 0,
    w: SLIDE_W - 1,
    h: 0.9,
    fontSize: 24,
    bold: true,
    color: "FFFFFF",
    valign: "middle",
  });
}

function addCaption(slide: PptxGenJS.Slide, caption: string, y: number) {
  if (!caption) return;
  slide.addText(caption, {
    x: 0.6,
    y,
    w: SLIDE_W - 1.2,
    h: 0.4,
    fontSize: 13,
    italic: true,
    color: "4B5563",
    align: "center",
  });
}

export function addExecutiveSummarySlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "executive" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  addHeader(slide, result.title, primary, secondary);

  const margin = 0.48;
  const gap = 0.16;
  const cardY = 1.25;
  const cardH = 1.65;
  const cardW = (SLIDE_W - margin * 2 - gap * (result.metrics.length - 1)) / result.metrics.length;

  result.metrics.forEach((metric, index) => {
    const x = margin + index * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: "F7F8F7" },
      line: { color: "E5E7EB", pt: 0.6 },
      rectRadius: 0.06,
    });
    slide.addShape("rect", {
      x,
      y: cardY,
      w: cardW,
      h: 0.08,
      fill: { color: secondaryColor },
      line: { color: secondaryColor, transparency: 100 },
    });
    slide.addText(metric.value, {
      x: x + 0.16,
      y: cardY + 0.22,
      w: cardW - 0.32,
      h: 0.55,
      fontSize: metric.value.length > 12 ? 20 : 26,
      bold: true,
      color: primaryColor,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(metric.label, {
      x: x + 0.16,
      y: cardY + 0.83,
      w: cardW - 0.32,
      h: 0.3,
      fontSize: 11.5,
      bold: true,
      color: "374151",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(metric.detail, {
      x: x + 0.16,
      y: cardY + 1.19,
      w: cardW - 0.32,
      h: 0.25,
      fontSize: 8.5,
      color: "6B7280",
      margin: 0,
      fit: "shrink",
    });
  });

  const panelX = margin;
  const panelY = 3.25;
  const panelW = SLIDE_W - margin * 2;
  const panelH = 3.65;
  slide.addShape("roundRect", {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    fill: { color: "F7F8F7" },
    line: { color: "F7F8F7", transparency: 100 },
    rectRadius: 0.06,
  });
  slide.addText("KEY OBSERVATIONS", {
    x: panelX + 0.35,
    y: panelY + 0.27,
    w: panelW - 0.7,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: "6B7280",
    charSpacing: 1.2,
    margin: 0,
  });

  result.observations.slice(0, 3).forEach((observation, index) => {
    const rowY = panelY + 0.78 + index * 0.88;
    slide.addShape("ellipse", {
      x: panelX + 0.35,
      y: rowY,
      w: 0.35,
      h: 0.35,
      fill: { color: primaryColor },
      line: { color: primaryColor, transparency: 100 },
    });
    slide.addText(String(index + 1), {
      x: panelX + 0.35,
      y: rowY,
      w: 0.35,
      h: 0.35,
      align: "center",
      valign: "middle",
      fontSize: 9,
      bold: true,
      color: "FFFFFF",
      margin: 0,
    });
    slide.addText(observation, {
      x: panelX + 0.88,
      y: rowY - 0.04,
      w: panelW - 1.25,
      h: 0.55,
      fontSize: 14,
      color: "273036",
      breakLine: false,
      margin: 0,
      fit: "shrink",
      valign: "middle",
    });
  });
}

export function addBenefitsParticipationSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "participation" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  const waivedColor = "D97706";
  const unreportedColor = "C9CDD1";
  addHeader(slide, result.title, primary, secondary);

  slide.addText("Eligible employees flow to enrolled, waived, or not recorded for each benefit.", {
    x: 0.55,
    y: 1.08,
    w: SLIDE_W - 1.1,
    h: 0.32,
    fontSize: 11.5,
    color: "6B7280",
    margin: 0,
  });

  const rowX = 0.5;
  const rowW = SLIDE_W - 1;
  const rowH = 1.43;
  const rowStart = 1.52;
  const rowGap = 0.25;

  result.benefits.forEach((benefit, index) => {
    const y = rowStart + index * (rowH + rowGap);
    slide.addShape("roundRect", {
      x: rowX,
      y,
      w: rowW,
      h: rowH,
      fill: { color: "F7F8F7" },
      line: { color: "E5E7EB", pt: 0.6 },
      rectRadius: 0.05,
    });

    slide.addText(benefit.name, {
      x: rowX + 0.28,
      y: y + 0.22,
      w: 1.8,
      h: 0.3,
      fontSize: 17,
      bold: true,
      color: "273036",
      margin: 0,
    });
    slide.addText(`${benefit.participation.toFixed(1)}%`, {
      x: rowX + 0.28,
      y: y + 0.57,
      w: 1.8,
      h: 0.46,
      fontSize: 25,
      bold: true,
      color: primaryColor,
      margin: 0,
    });
    slide.addText("participation", {
      x: rowX + 0.28,
      y: y + 1.05,
      w: 1.8,
      h: 0.2,
      fontSize: 9,
      color: "6B7280",
      margin: 0,
    });
    slide.addShape("line", {
      x: rowX + 2.2,
      y: y + 0.2,
      w: 0,
      h: rowH - 0.4,
      line: { color: "DDE0E2", pt: 1 },
    });

    const metrics = [
      { label: "Eligible", value: benefit.eligible, color: "273036" },
      { label: "Enrolled", value: benefit.enrolled, color: primaryColor },
      { label: "Waived", value: benefit.waived, color: waivedColor },
      { label: "Not recorded", value: benefit.unreported, color: "6B7280" },
    ];
    const metricStartX = rowX + 2.55;
    const metricW = 2.25;
    metrics.forEach((metric, metricIndex) => {
      const x = metricStartX + metricIndex * metricW;
      slide.addText(String(metric.value), {
        x,
        y: y + 0.2,
        w: metricW - 0.25,
        h: 0.38,
        fontSize: 20,
        bold: true,
        color: metric.color,
        margin: 0,
      });
      slide.addText(metric.label, {
        x,
        y: y + 0.61,
        w: metricW - 0.25,
        h: 0.2,
        fontSize: 9.5,
        color: "6B7280",
        margin: 0,
      });
    });

    const barX = metricStartX;
    const barY = y + 1.01;
    const barW = rowW - (barX - rowX) - 0.32;
    const barH = 0.18;
    slide.addShape("roundRect", {
      x: barX,
      y: barY,
      w: barW,
      h: barH,
      fill: { color: "E5E7EB" },
      line: { color: "E5E7EB", transparency: 100 },
      rectRadius: 0.04,
    });

    if (benefit.eligible > 0) {
      const enrolledW = barW * (benefit.enrolled / benefit.eligible);
      const waivedW = barW * (benefit.waived / benefit.eligible);
      const unreportedW = barW * (benefit.unreported / benefit.eligible);
      let segmentX = barX;
      for (const segment of [
        { width: enrolledW, color: primaryColor },
        { width: waivedW, color: waivedColor },
        { width: unreportedW, color: unreportedColor },
      ]) {
        if (segment.width <= 0) continue;
        slide.addShape("rect", {
          x: segmentX,
          y: barY,
          w: segment.width,
          h: barH,
          fill: { color: segment.color },
          line: { color: segment.color, transparency: 100 },
        });
        segmentX += segment.width;
      }
    }
  });

  slide.addShape("rect", {
    x: 0.55,
    y: 6.77,
    w: 0.12,
    h: 0.28,
    fill: { color: secondaryColor },
    line: { color: secondaryColor, transparency: 100 },
  });
  slide.addText(result.note, {
    x: 0.78,
    y: 6.74,
    w: SLIDE_W - 1.35,
    h: 0.34,
    fontSize: 9.5,
    color: "6B7280",
    margin: 0,
    fit: "shrink",
  });
}

function addStatsSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "stats" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, result.title, primary, secondary);

  const count = result.stats.length;
  const gap = 0.4;
  const cardW = (SLIDE_W - gap * (count + 1)) / count;
  const cardH = 2;
  const y = (SLIDE_H - cardH) / 2;

  result.stats.forEach((stat, i) => {
    const x = gap + i * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: "F3F4F6" },
      rectRadius: 0.08,
    });
    slide.addText(stat.value, {
      x,
      y: y + 0.3,
      w: cardW,
      h: 1,
      align: "center",
      fontSize: 32,
      bold: true,
      color: stripHash(primary),
    });
    slide.addText(stat.label, {
      x,
      y: y + 1.3,
      w: cardW,
      h: 0.5,
      align: "center",
      fontSize: 13,
      color: "6B7280",
    });
  });
}

function addBarSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "bar" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, result.title, primary, secondary);

  const svg = renderBarChartSvg(result, paletteFor(primary, secondary), 1200, 560);
  const png = svgToPng(svg);
  const imgH = SLIDE_H - 2.3;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: 0.6,
    y: 1.2,
    w: SLIDE_W - 1.2,
    h: imgH,
  });

  addCaption(slide, generateCaption(result), 1.2 + imgH + 0.1);
}

function addPieSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "pie" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, result.title, primary, secondary);

  const svg = renderPieChartSvg(result, paletteFor(primary, secondary), 700, 620);
  const png = svgToPng(svg);
  const imgSize = SLIDE_H - 2.3;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: SLIDE_W / 2 - imgSize / 2,
    y: 1.2,
    w: imgSize,
    h: imgSize,
  });

  addCaption(slide, generateCaption(result), 1.2 + imgSize + 0.1);
}

function addTableSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "table" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, result.title, primary, secondary);

  const headerRow: PptxGenJS.TableRow = result.columns.map((c) => ({
    text: c,
    options: { fill: { color: stripHash(primary) }, color: "FFFFFF", bold: true, fontSize: 12 },
  }));

  const bodyRows: PptxGenJS.TableRow[] = result.rows.slice(0, 14).map((row, i) =>
    row.map((cell) => ({
      text: String(cell),
      options: {
        fill: { color: i % 2 === 0 ? "FFFFFF" : "F9FAFB" },
        fontSize: 11,
        color: "1F2937",
      },
    }))
  );

  slide.addTable([headerRow, ...bodyRows], {
    x: 0.5,
    y: 1.2,
    w: SLIDE_W - 1,
    fontSize: 11,
    border: { type: "solid", color: "E5E7EB", pt: 0.5 },
    autoPage: false,
  });

  addCaption(slide, generateCaption(result), SLIDE_H - 0.55);
}

function addMapSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "map" }>,
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, result.title, primary, secondary);

  const svg = renderWorkforceMapSvg(result, primary, 1200, 560);
  const png = svgToPng(svg);
  const imgH = SLIDE_H - 2.3;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: 0.6,
    y: 1.15,
    w: SLIDE_W - 1.2,
    h: imgH,
  });

  addCaption(slide, generateCaption(result), 1.15 + imgH + 0.1);
}

function addPanelSlide(
  pres: PptxGenJS,
  title: string,
  panels: ChartResult[],
  primary: string,
  secondary: string
) {
  const slide = pres.addSlide();
  addHeader(slide, title, primary, secondary);

  const colors = paletteFor(primary, secondary);
  const n = panels.length;
  const gap = 0.35;
  const panelW = (SLIDE_W - gap * (n + 1)) / n;
  const panelTop = 1.25;
  const titleH = 0.45;
  const imgH = 3.9;
  const captionY = panelTop + titleH + imgH + 0.15;

  panels.forEach((result, i) => {
    const x = gap + i * (panelW + gap);

    slide.addText(result.title, {
      x,
      y: panelTop,
      w: panelW,
      h: titleH,
      fontSize: 15,
      bold: true,
      color: stripHash(primary),
      align: "center",
    });

    if (result.kind === "bar") {
      const svg = renderBarChartSvg(result, colors, 700, 520);
      const png = svgToPng(svg);
      slide.addImage({
        data: `image/png;base64,${png.toString("base64")}`,
        x,
        y: panelTop + titleH,
        w: panelW,
        h: imgH,
      });
    } else if (result.kind === "pie") {
      const svg = renderPieChartSvg(result, colors, 600, 600);
      const png = svgToPng(svg);
      const imgSize = Math.min(panelW, imgH);
      slide.addImage({
        data: `image/png;base64,${png.toString("base64")}`,
        x: x + (panelW - imgSize) / 2,
        y: panelTop + titleH,
        w: imgSize,
        h: imgSize,
      });
    }

    const caption = generateCaption(result);
    if (caption) {
      slide.addText(caption, {
        x,
        y: captionY,
        w: panelW,
        h: 0.6,
        fontSize: 11,
        italic: true,
        color: "4B5563",
        align: "center",
      });
    }
  });
}

export async function generateDeckBuffer(planYearId: string): Promise<Buffer> {
  const planYear = await prisma.planYear.findUniqueOrThrow({
    where: { id: planYearId },
    include: { client: true, deckConfig: true },
  });

  const chartDefinitions = await prisma.chartDefinition.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const defsByKey = new Map(chartDefinitions.map((d) => [d.key, d]));

  const selections =
    (planYear.deckConfig?.selections as Record<string, { enabled: boolean }> | undefined) ?? {};

  const isEnabled = (key: string) =>
    selections[key]?.enabled ?? defsByKey.get(key)?.defaultEnabled ?? false;

  const dataset = await loadChartDataset(planYearId);

  const primary = planYear.client.primaryColor;
  const secondary = planYear.client.secondaryColor;

  const pres = new PptxGenJS();
  pres.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H });
  pres.layout = "WIDE";

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: stripHash(primary) };
  titleSlide.addShape("rect", {
    x: 0,
    y: SLIDE_H - 0.15,
    w: SLIDE_W,
    h: 0.15,
    fill: { color: stripHash(secondary) },
  });

  if (planYear.client.logoPath) {
    try {
      const logoAbsPath = path.join(process.cwd(), "public", planYear.client.logoPath);
      titleSlide.addImage({ path: logoAbsPath, x: 0.6, y: 0.5, w: 1.4, h: 1.4, sizing: { type: "contain", w: 1.4, h: 1.4 } });
    } catch {
      // Logo failed to load — proceed without it rather than failing the whole deck.
    }
  }

  titleSlide.addText(planYear.client.name, {
    x: 0.6,
    y: SLIDE_H / 2 - 0.9,
    w: SLIDE_W - 1.2,
    h: 1.4,
    fontSize: 36,
    bold: true,
    color: "FFFFFF",
  });
  titleSlide.addText(`Benefits Renewal Analysis — ${planYear.label}`, {
    x: 0.6,
    y: SLIDE_H / 2 + 0.5,
    w: SLIDE_W - 1.2,
    h: 0.6,
    fontSize: 18,
    color: stripHash(secondary),
  });
  titleSlide.addText(`Prepared ${formatDate(new Date())}`, {
    x: 0.6,
    y: SLIDE_H - 0.9,
    w: SLIDE_W - 1.2,
    h: 0.4,
    fontSize: 12,
    color: "D1D5DB",
  });

  // Map every key (not just the first) to its group, so whichever member key
  // happens to sort first still triggers the combined panel exactly once.
  const keyToGroup = new Map<string, (typeof CHART_GROUPS)[number]>();
  for (const g of CHART_GROUPS) for (const k of g.keys) keyToGroup.set(k, g);

  const activeGroups = new Set(
    CHART_GROUPS.filter((g) => g.keys.every((k) => isEnabled(k) && CHART_COMPUTE[k]))
  );
  const consumedKeys = new Set<string>();

  // Chart/table slides, in catalog order, for every enabled chart with data
  for (const def of chartDefinitions) {
    if (consumedKeys.has(def.key)) continue;

    const group = keyToGroup.get(def.key);
    if (group && activeGroups.has(group)) {
      const panelResults = group.keys.map((k) => CHART_COMPUTE[k](dataset));
      addPanelSlide(pres, group.title, panelResults, primary, secondary);
      group.keys.forEach((k) => consumedKeys.add(k));
      continue;
    }

    if (!isEnabled(def.key)) continue;

    const compute = CHART_COMPUTE[def.key];
    if (!compute) continue;
    const result = compute(dataset);

    if (result.kind === "executive") addExecutiveSummarySlide(pres, result, primary, secondary);
    else if (result.kind === "participation")
      addBenefitsParticipationSlide(pres, result, primary, secondary);
    else if (result.kind === "stats") addStatsSlide(pres, result, primary, secondary);
    else if (result.kind === "bar") addBarSlide(pres, result, primary, secondary);
    else if (result.kind === "pie") addPieSlide(pres, result, primary, secondary);
    else if (result.kind === "map") addMapSlide(pres, result, primary, secondary);
    else addTableSlide(pres, result, primary, secondary);
  }

  const output = await pres.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Uint8Array);
}
