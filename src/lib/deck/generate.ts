import path from "path";
import PptxGenJS from "pptxgenjs";
import { prisma } from "@/lib/prisma";
import { loadChartDataset } from "@/lib/charts/dataset";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import { renderBarChartSvg, renderPieChartSvg, svgToPng } from "@/lib/charts/svgRender";
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

    if (result.kind === "stats") addStatsSlide(pres, result, primary, secondary);
    else if (result.kind === "bar") addBarSlide(pres, result, primary, secondary);
    else if (result.kind === "pie") addPieSlide(pres, result, primary, secondary);
    else addTableSlide(pres, result, primary, secondary);
  }

  const output = await pres.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Uint8Array);
}
