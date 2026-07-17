import path from "path";
import PptxGenJS from "pptxgenjs";
import { prisma } from "@/lib/prisma";
import { loadChartDataset } from "@/lib/charts/dataset";
import { CHART_COMPUTE } from "@/lib/charts/compute";
import {
  renderBarChartSvg,
  renderPieChartSvg,
  renderStackedBarChartSvg,
  svgToPng,
} from "@/lib/charts/svgRender";
import { renderWorkforceMapSvg } from "@/lib/geography/mapRender";
import { generateCaption } from "@/lib/deck/captions";
import {
  buildDeckRecommendations,
  insightTitle,
  sectionNarrative,
  takeawayForResult,
  type DeckRecommendation,
} from "@/lib/deck/narrative";
import { formatDate } from "@/lib/date";
import type { ChartResult } from "@/lib/charts/types";
import {
  chartView,
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
  tierCombinedBarResult,
  tierTableResult,
} from "@/lib/charts/viewTransforms";

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const CONTENT_MASTER = "BENEFIT_HQ_CONTENT";
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

function mixWithWhite(hex: string, intensity: number): string {
  const color = stripHash(hex);
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(255 - (255 - channel) * Math.max(0, Math.min(1, intensity)))
      .toString(16)
      .padStart(2, "0");
  return `${mix(red)}${mix(green)}${mix(blue)}`.toUpperCase();
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(value);
}

function rateCurrency(value: number, ratePeriod: string): string {
  const suffix =
    ratePeriod === "monthly"
      ? "mo"
      : ratePeriod === "per-pay-period"
        ? "pay"
        : ratePeriod === "annual"
          ? "yr"
          : ratePeriod;
  return `$${value.toFixed(2)} / ${suffix}`;
}

function signedCompactCurrency(value: number): string {
  if (value === 0) return compactCurrency(0);
  return `${value > 0 ? "+" : "−"}${compactCurrency(Math.abs(value))}`;
}

function percentageChangeLabel(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "0.0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function addContentSlide(pres: PptxGenJS): PptxGenJS.Slide {
  return pres.addSlide({ masterName: CONTENT_MASTER });
}

function addHeader(
  slide: PptxGenJS.Slide,
  title: string,
  primary: string,
  secondary: string,
  topic?: string
) {
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.13,
    h: 0.96,
    fill: { color: primaryColor },
    line: { color: primaryColor, transparency: 100 },
  });
  slide.addText((topic ?? "Benefits renewal analysis").toUpperCase(), {
    x: 0.5,
    y: 0.14,
    w: SLIDE_W - 1,
    h: 0.15,
    fontSize: 8,
    bold: true,
    color: secondaryColor,
    charSpacing: 1.1,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.34,
    w: SLIDE_W - 1,
    h: 0.43,
    fontSize: 27,
    bold: true,
    color: primaryColor,
    valign: "middle",
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
  slide.addShape("line", {
    x: 0.5,
    y: 0.94,
    w: SLIDE_W - 1,
    h: 0,
    line: { color: "DCE2DF", pt: 0.8 },
  });
}

function addTakeawayPanel(
  slide: PptxGenJS.Slide,
  takeaway: string,
  primary: string,
  secondary: string,
  y = 6.14,
  h = 0.74
) {
  if (!takeaway) return;
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  slide.addShape("roundRect", {
    x: 0.55,
    y,
    w: SLIDE_W - 1.1,
    h,
    fill: { color: "F5F8F7" },
    line: { color: "DCE2DF", pt: 0.6 },
    rectRadius: 0.04,
  });
  slide.addShape("rect", {
    x: 0.55,
    y,
    w: 0.09,
    h,
    fill: { color: secondaryColor },
    line: { color: secondaryColor, transparency: 100 },
  });
  slide.addText("KEY TAKEAWAY", {
    x: 0.82,
    y: y + 0.14,
    w: 1.35,
    h: 0.16,
    fontSize: 8,
    bold: true,
    color: primaryColor,
    charSpacing: 0.8,
    margin: 0,
  });
  slide.addText(takeaway, {
    x: 2.05,
    y: y + 0.11,
    w: SLIDE_W - 2.85,
    h: h - 0.2,
    fontSize: 12.5,
    color: "374151",
    margin: 0,
    valign: "middle",
    fit: "shrink",
  });
}

function defineContentMaster(
  pres: PptxGenJS,
  clientName: string,
  planYearLabel: string,
  effectiveDate: Date
) {
  pres.defineSlideMaster({
    title: CONTENT_MASTER,
    background: { color: "FFFFFF" },
    objects: [
      {
        line: {
          x: 0.5,
          y: 7.19,
          w: SLIDE_W - 1,
          h: 0,
          line: { color: "DCE2DF", pt: 0.6 },
        },
      },
      {
        text: {
          text: `${clientName}  ·  ${planYearLabel}`,
          options: {
            x: 0.52,
            y: 7.27,
            w: 5.4,
            h: 0.12,
            fontSize: 7.5,
            color: "6B7280",
            margin: 0,
            fit: "shrink",
          },
        },
      },
      {
        text: {
          text: `EFFECTIVE ${formatDate(effectiveDate).toUpperCase()}`,
          options: {
            x: 8.2,
            y: 7.27,
            w: 4.2,
            h: 0.12,
            fontSize: 7.5,
            color: "6B7280",
            align: "right",
            margin: 0,
          },
        },
      },
    ],
    slideNumber: {
      x: 12.52,
      y: 7.25,
      w: 0.3,
      h: 0.14,
      fontSize: 7.5,
      bold: true,
      color: "4B5563",
      align: "right",
      margin: 0,
    },
  });
}

function addSectionDividerSlide(
  pres: PptxGenJS,
  category: string,
  sectionNumber: number,
  primary: string,
  secondary: string,
  clientName: string,
  planYearLabel: string
) {
  const slide = pres.addSlide();
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  const copy = sectionNarrative(category);
  slide.background = { color: primaryColor };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.16,
    h: SLIDE_H,
    fill: { color: secondaryColor },
    line: { color: secondaryColor, transparency: 100 },
  });
  slide.addText(String(sectionNumber).padStart(2, "0"), {
    x: 0.7,
    y: 1.2,
    w: 2.2,
    h: 1.1,
    fontSize: 62,
    bold: true,
    color: secondaryColor,
    margin: 0,
  });
  slide.addText(copy.title, {
    x: 0.72,
    y: 2.65,
    w: 10.9,
    h: 0.72,
    fontSize: 38,
    bold: true,
    color: "FFFFFF",
    margin: 0,
    fit: "shrink",
  });
  slide.addText(copy.subtitle, {
    x: 0.74,
    y: 3.55,
    w: 9.8,
    h: 0.54,
    fontSize: 19,
    color: "E7ECE9",
    margin: 0,
    fit: "shrink",
  });
  slide.addShape("line", {
    x: 0.74,
    y: 6.82,
    w: SLIDE_W - 1.48,
    h: 0,
    line: { color: "FFFFFF", transparency: 70, pt: 0.7 },
  });
  slide.addText(`${clientName}  ·  ${planYearLabel}`, {
    x: 0.74,
    y: 6.98,
    w: 7,
    h: 0.16,
    fontSize: 8,
    color: "FFFFFF",
    transparency: 20,
    margin: 0,
  });
}

function addRecommendationsSlide(
  pres: PptxGenJS,
  recommendations: DeckRecommendation[],
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  const countLabel = ["Zero", "One", "Two", "Three", "Four", "Five"][recommendations.length];
  addHeader(
    slide,
    `${countLabel} ${recommendations.length === 1 ? "priority" : "priorities"} can strengthen the next renewal cycle`,
    primary,
    secondary,
    "Prioritized actions"
  );
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  const startY = 1.25;
  const rowH = Math.min(1.03, 5.45 / recommendations.length);

  recommendations.forEach((recommendation, index) => {
    const y = startY + index * rowH;
    const priorityColor =
      recommendation.priority === "Immediate attention"
        ? "B45309"
        : recommendation.priority === "Renewal consideration"
          ? primaryColor
          : secondaryColor;
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 0.62,
      y: y + 0.08,
      w: 0.55,
      h: 0.35,
      fontSize: 18,
      bold: true,
      color: priorityColor,
      margin: 0,
    });
    slide.addText(recommendation.priority.toUpperCase(), {
      x: 1.42,
      y: y + 0.04,
      w: 2.15,
      h: 0.15,
      fontSize: 7.5,
      bold: true,
      color: priorityColor,
      charSpacing: 0.7,
      margin: 0,
    });
    slide.addText(recommendation.title, {
      x: 1.42,
      y: y + 0.26,
      w: 5.2,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: "273036",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(recommendation.detail, {
      x: 6.95,
      y: y + 0.21,
      w: 5.75,
      h: 0.42,
      fontSize: 11.5,
      color: "4B5563",
      margin: 0,
      valign: "middle",
      fit: "shrink",
    });
    if (index < recommendations.length - 1) {
      slide.addShape("line", {
        x: 1.42,
        y: y + rowH - 0.08,
        w: 11.28,
        h: 0,
        line: { color: "E4E8E6", pt: 0.7 },
      });
    }
  });
}

export function addExecutiveSummarySlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "executive" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

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
  const slide = addContentSlide(pres);
  const primaryColor = stripHash(primary);
  const waivedColor = "D97706";
  const unreportedColor = "C9CDD1";
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

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

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.42, 0.56);
}

export function addContributionStrategySlides(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "contribution" }>,
  primary: string,
  secondary: string
) {
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  const firstPageRows = result.rows.slice(0, 7);
  const remainingRows = result.rows.slice(7);
  const pages = [
    { rows: firstPageRows, first: true },
    ...Array.from({ length: Math.ceil(remainingRows.length / 10) }, (_, index) => ({
      rows: remainingRows.slice(index * 10, index * 10 + 10),
      first: false,
    })),
  ];

  const tableRows = (rows: typeof result.rows): PptxGenJS.TableRow[] => {
    const header: PptxGenJS.TableRow = [
      "Benefit / plan",
      "Coverage tier",
      "Enrolled",
      "Employee deduction",
      "Employer contribution",
      "Employer paid",
      "Est. annual premium",
    ].map((text) => ({
      text,
      options: {
        fill: { color: primaryColor },
        color: "FFFFFF",
        bold: true,
        fontSize: 8.5,
        margin: 0.06,
      },
    }));

    const body: PptxGenJS.TableRow[] = rows.map((row, index) => {
      const fill = index % 2 === 0 ? "FFFFFF" : "F7F8F7";
      const baseOptions = { fill: { color: fill }, color: "273036", fontSize: 8.5, margin: 0.06 };
      const benefitPlan = row.plan ? `${row.benefit} · ${row.plan}` : row.benefit;
      return [
        { text: benefitPlan, options: { ...baseOptions, bold: true } },
        { text: row.tier, options: baseOptions },
        { text: String(row.enrolled), options: { ...baseOptions, bold: true, align: "center" } },
        { text: rateCurrency(row.employeeRate, row.ratePeriod), options: baseOptions },
        { text: rateCurrency(row.employerRate, row.ratePeriod), options: baseOptions },
        {
          text: `${row.employerPaidPercentage.toFixed(1)}%`,
          options: {
            ...baseOptions,
            bold: true,
            color: row.employerPaidPercentage < 50 ? "B45309" : primaryColor,
            align: "center",
          },
        },
        {
          text: compactCurrency(row.annualTotalSpend),
          options: { ...baseOptions, bold: true, align: "right" },
        },
      ];
    });
    return [header, ...body];
  };

  pages.forEach((page, pageIndex) => {
    const slide = addContentSlide(pres);
    addHeader(
      slide,
      page.first ? insightTitle(result) : `${result.title} — continued ${pageIndex + 1}`,
      primary,
      secondary,
      result.title
    );

    let tableY = 1.28;
    if (page.first) {
      const matchPercentage = result.totalElections
        ? (result.matchedElections / result.totalElections) * 100
        : 0;
      const summaryMetrics = [
        { label: "EST. ANNUAL PREMIUM", value: compactCurrency(result.annualTotalSpend) },
        { label: "EMPLOYER-FUNDED", value: compactCurrency(result.annualEmployerSpend) },
        { label: "EMPLOYEE-FUNDED", value: compactCurrency(result.annualEmployeeSpend) },
        {
          label: "ELECTIONS MATCHED",
          value: `${matchPercentage.toFixed(1)}%`,
          detail: `${result.matchedElections} of ${result.totalElections}`,
        },
      ];
      const summaryGap = 0.15;
      const summaryX = 0.5;
      const summaryW = (SLIDE_W - 1 - summaryGap * 3) / 4;
      summaryMetrics.forEach((metric, index) => {
        const x = summaryX + index * (summaryW + summaryGap);
        slide.addShape("roundRect", {
          x,
          y: 1.15,
          w: summaryW,
          h: 0.88,
          fill: { color: "F7F8F7" },
          line: { color: "E5E7EB", pt: 0.5 },
          rectRadius: 0.04,
        });
        slide.addShape("rect", {
          x,
          y: 1.15,
          w: 0.08,
          h: 0.88,
          fill: { color: secondaryColor },
          line: { color: secondaryColor, transparency: 100 },
        });
        slide.addText(metric.value, {
          x: x + 0.22,
          y: 1.31,
          w: summaryW - 0.36,
          h: 0.34,
          fontSize: 20,
          bold: true,
          color: primaryColor,
          margin: 0,
          fit: "shrink",
        });
        slide.addText(metric.label, {
          x: x + 0.22,
          y: 1.7,
          w: summaryW - 0.36,
          h: 0.15,
          fontSize: 7.5,
          bold: true,
          color: "6B7280",
          charSpacing: 0.7,
          margin: 0,
        });
        if (metric.detail) {
          slide.addText(metric.detail, {
            x: x + summaryW - 0.9,
            y: 1.7,
            w: 0.68,
            h: 0.15,
            fontSize: 7.5,
            color: "6B7280",
            align: "right",
            margin: 0,
          });
        }
      });
      tableY = 2.25;
    }

    if (page.rows.length > 0) {
      slide.addTable(tableRows(page.rows), {
        x: 0.5,
        y: tableY,
        w: SLIDE_W - 1,
        colW: [2.4, 1.8, 0.8, 1.8, 1.8, 1.25, 2.48],
        rowH: 0.46,
        border: { type: "solid", color: "E5E7EB", pt: 0.4 },
        autoPage: false,
        margin: 0.06,
      });
    } else {
      slide.addText("Add policy rates to calculate contribution strategy and annual spend.", {
        x: 0.75,
        y: 3.2,
        w: SLIDE_W - 1.5,
        h: 0.5,
        fontSize: 15,
        color: "6B7280",
        align: "center",
      });
    }

    if (page.first) {
      addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.14, 0.62);
      slide.addText(result.note, {
        x: 0.55,
        y: 6.88,
        w: SLIDE_W - 1.1,
        h: 0.18,
        fontSize: 6.5,
        color: "6B7280",
        margin: 0,
        fit: "shrink",
        align: "center",
      });
    }
  });
}

export function addWorkforceRiskSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "risk" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const margin = 0.48;
  const gap = 0.16;
  const cardY = 1.15;
  const cardH = 1.28;
  const cardW = (SLIDE_W - margin * 2 - gap * 3) / 4;

  result.indicators.forEach((indicator, index) => {
    const x = margin + index * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: "F7F8F7" },
      line: { color: "E2E5E3", pt: 0.6 },
      rectRadius: 0.05,
    });
    slide.addShape("rect", {
      x,
      y: cardY,
      w: 0.08,
      h: cardH,
      fill: { color: index === 2 ? secondaryColor : primaryColor },
      line: { color: index === 2 ? secondaryColor : primaryColor, transparency: 100 },
    });
    slide.addText(String(indicator.value), {
      x: x + 0.24,
      y: cardY + 0.16,
      w: 0.7,
      h: 0.43,
      fontSize: 23,
      bold: true,
      color: primaryColor,
      margin: 0,
    });
    slide.addText(`${indicator.percentage.toFixed(1)}%`, {
      x: x + 0.9,
      y: cardY + 0.24,
      w: 0.75,
      h: 0.25,
      fontSize: 11,
      bold: true,
      color: "5B6661",
      margin: 0,
    });
    slide.addText(indicator.label, {
      x: x + 0.24,
      y: cardY + 0.66,
      w: cardW - 0.45,
      h: 0.22,
      fontSize: 10.5,
      bold: true,
      color: "273036",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(`${indicator.definition} · ${indicator.denominator} records`, {
      x: x + 0.24,
      y: cardY + 0.94,
      w: cardW - 0.45,
      h: 0.18,
      fontSize: 7.8,
      color: "6B7280",
      margin: 0,
      fit: "shrink",
    });
  });

  const heatX = margin;
  const heatY = 2.66;
  const heatW = 7.62;
  const heatH = 3.96;
  slide.addShape("roundRect", {
    x: heatX,
    y: heatY,
    w: heatW,
    h: heatH,
    fill: { color: "FFFFFF" },
    line: { color: "E2E5E3", pt: 0.7 },
    rectRadius: 0.05,
  });
  slide.addText("Age × tenure concentration", {
    x: heatX + 0.24,
    y: heatY + 0.17,
    w: 2.8,
    h: 0.24,
    fontSize: 12,
    bold: true,
    color: "273036",
    margin: 0,
  });
  slide.addText(`${result.completeRecords} of ${result.totalEmployees} employees have both dates`, {
    x: heatX + 0.24,
    y: heatY + 0.47,
    w: 3.2,
    h: 0.17,
    fontSize: 8,
    color: "6B7280",
    margin: 0,
  });
  slide.addText("Darker cells = more employees", {
    x: heatX + heatW - 2.18,
    y: heatY + 0.24,
    w: 1.92,
    h: 0.17,
    fontSize: 7.7,
    color: "6B7280",
    align: "right",
    margin: 0,
  });

  const labelW = 0.8;
  const cellGap = 0.08;
  const gridX = heatX + 0.28 + labelW;
  const gridY = heatY + 1.02;
  const gridW = heatW - 0.56 - labelW;
  const cellW = (gridW - cellGap * (result.tenureBands.length - 1)) / result.tenureBands.length;
  const cellH = 0.4;
  const rowGap = 0.07;
  const maximumCell = Math.max(0, ...result.cells.map((cell) => cell.count));

  slide.addText("AGE", {
    x: heatX + 0.25,
    y: gridY - 0.35,
    w: labelW,
    h: 0.18,
    fontSize: 7.5,
    bold: true,
    color: "8A918D",
    charSpacing: 0.7,
    margin: 0,
  });
  result.tenureBands.forEach((tenureBand, columnIndex) => {
    slide.addText(tenureBand, {
      x: gridX + columnIndex * (cellW + cellGap),
      y: gridY - 0.35,
      w: cellW,
      h: 0.18,
      fontSize: 8,
      bold: true,
      color: "5B6661",
      align: "center",
      margin: 0,
    });
  });

  result.ageBands.forEach((ageBand, rowIndex) => {
    const y = gridY + rowIndex * (cellH + rowGap);
    slide.addText(ageBand, {
      x: heatX + 0.25,
      y: y + 0.09,
      w: labelW - 0.08,
      h: 0.18,
      fontSize: 8.5,
      bold: true,
      color: "5B6661",
      margin: 0,
    });

    result.tenureBands.forEach((tenureBand, columnIndex) => {
      const count =
        result.cells.find(
          (cell) => cell.ageBand === ageBand && cell.tenureBand === tenureBand
        )?.count ?? 0;
      const ratio = maximumCell ? count / maximumCell : 0;
      const fill = count === 0 ? "F3F4F3" : mixWithWhite(primaryColor, 0.22 + ratio * 0.78);
      slide.addShape("roundRect", {
        x: gridX + columnIndex * (cellW + cellGap),
        y,
        w: cellW,
        h: cellH,
        fill: { color: fill },
        line: { color: fill, transparency: 100 },
        rectRadius: 0.03,
      });
      slide.addText(String(count), {
        x: gridX + columnIndex * (cellW + cellGap),
        y: y + 0.07,
        w: cellW,
        h: 0.22,
        fontSize: 9.5,
        bold: true,
        color: ratio >= 0.5 ? "FFFFFF" : "273036",
        align: "center",
        margin: 0,
      });
    });
  });

  const insightX = 8.3;
  const insightW = SLIDE_W - insightX - margin;
  slide.addShape("roundRect", {
    x: insightX,
    y: heatY,
    w: insightW,
    h: heatH,
    fill: { color: "F7F8F7" },
    line: { color: "E2E5E3", pt: 0.7 },
    rectRadius: 0.05,
  });
  slide.addText("PLANNING OBSERVATIONS", {
    x: insightX + 0.28,
    y: heatY + 0.22,
    w: insightW - 0.56,
    h: 0.2,
    fontSize: 8.5,
    bold: true,
    color: "7A827E",
    charSpacing: 0.8,
    margin: 0,
  });

  result.observations.forEach((observation, index) => {
    const y = heatY + 0.66 + index * 0.88;
    slide.addShape("ellipse", {
      x: insightX + 0.28,
      y,
      w: 0.28,
      h: 0.28,
      fill: { color: primaryColor },
      line: { color: primaryColor, transparency: 100 },
    });
    slide.addText(String(index + 1), {
      x: insightX + 0.28,
      y: y + 0.055,
      w: 0.28,
      h: 0.14,
      fontSize: 7,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    });
    slide.addText(observation, {
      x: insightX + 0.7,
      y: y - 0.02,
      w: insightW - 1,
      h: 0.65,
      fontSize: 8.8,
      color: "4B5563",
      margin: 0,
      breakLine: false,
      fit: "shrink",
      valign: "top",
    });
  });

  slide.addShape("line", {
    x: insightX + 0.28,
    y: heatY + heatH - 0.72,
    w: insightW - 0.56,
    h: 0,
    line: { color: "DDE0DE", pt: 0.7 },
  });
  slide.addText(result.note, {
    x: insightX + 0.28,
    y: heatY + heatH - 0.58,
    w: insightW - 0.56,
    h: 0.42,
    fontSize: 7.4,
    color: "6B7280",
    margin: 0,
    fit: "shrink",
  });

  slide.addText(
    `Data coverage: birth dates ${result.birthDateRecords}/${result.totalEmployees} · hire dates ${result.hireDateRecords}/${result.totalEmployees} · both ${result.completeRecords}/${result.totalEmployees}`,
    {
      x: margin,
      y: 6.84,
      w: SLIDE_W - margin * 2,
      h: 0.2,
      fontSize: 8,
      color: "6B7280",
      margin: 0,
      align: "center",
    }
  );
}

export function addDataQualitySlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "quality" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  const primaryColor = stripHash(primary);
  const secondaryColor = stripHash(secondary);
  const warningColor = "D97706";
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

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
      detail: "Birth date, hire date, ZIP, and salary",
      color: primaryColor,
    },
    {
      label: "Valid ZIP coverage",
      value: `${validZipPercentage.toFixed(1)}%`,
      detail: `${result.validZipRecords} of ${result.totalEmployees} employees mapped`,
      color: primaryColor,
    },
    {
      label: "Unmatched elections",
      value: String(result.unmatchedElections),
      detail:
        matchPercentage === null
          ? "No active elections to match"
          : `${matchPercentage.toFixed(1)}% rate-row match coverage`,
      color: result.unmatchedElections > 0 ? warningColor : primaryColor,
    },
    {
      label: "Fully complete records",
      value: `${completeRecordPercentage.toFixed(1)}%`,
      detail: `${result.completeRecords} of ${result.totalEmployees} employees`,
      color: primaryColor,
    },
  ];

  const margin = 0.48;
  const gap = 0.16;
  const cardY = 1.15;
  const cardH = 1.3;
  const cardW = (SLIDE_W - margin * 2 - gap * 3) / 4;
  metrics.forEach((metric, index) => {
    const x = margin + index * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: "F7F8F7" },
      line: { color: "E2E5E3", pt: 0.6 },
      rectRadius: 0.05,
    });
    slide.addShape("rect", {
      x,
      y: cardY,
      w: 0.08,
      h: cardH,
      fill: { color: index === 1 ? secondaryColor : metric.color },
      line: { color: index === 1 ? secondaryColor : metric.color, transparency: 100 },
    });
    slide.addText(metric.value, {
      x: x + 0.24,
      y: cardY + 0.17,
      w: cardW - 0.48,
      h: 0.42,
      fontSize: 23,
      bold: true,
      color: metric.color,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(metric.label, {
      x: x + 0.24,
      y: cardY + 0.68,
      w: cardW - 0.48,
      h: 0.2,
      fontSize: 10.5,
      bold: true,
      color: "273036",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(metric.detail, {
      x: x + 0.24,
      y: cardY + 0.98,
      w: cardW - 0.48,
      h: 0.17,
      fontSize: 7.8,
      color: "6B7280",
      margin: 0,
      fit: "shrink",
    });
  });

  const panelY = 2.7;
  const panelH = 3.92;
  const auditX = margin;
  const auditW = 6.35;
  slide.addShape("roundRect", {
    x: auditX,
    y: panelY,
    w: auditW,
    h: panelH,
    fill: { color: "FFFFFF" },
    line: { color: "E2E5E3", pt: 0.7 },
    rectRadius: 0.05,
  });
  slide.addText("CENSUS FIELD AUDIT", {
    x: auditX + 0.3,
    y: panelY + 0.25,
    w: auditW - 0.6,
    h: 0.2,
    fontSize: 8.5,
    bold: true,
    color: "7A827E",
    charSpacing: 0.8,
    margin: 0,
  });
  slide.addText("Field", {
    x: auditX + 0.3,
    y: panelY + 0.67,
    w: 1.6,
    h: 0.18,
    fontSize: 8,
    bold: true,
    color: "6B7280",
    margin: 0,
  });
  slide.addText("Complete / missing", {
    x: auditX + 2.1,
    y: panelY + 0.67,
    w: 1.45,
    h: 0.18,
    fontSize: 8,
    bold: true,
    color: "6B7280",
    margin: 0,
    align: "center",
  });
  slide.addText("Coverage", {
    x: auditX + 4.05,
    y: panelY + 0.67,
    w: 1.75,
    h: 0.18,
    fontSize: 8,
    bold: true,
    color: "6B7280",
    margin: 0,
    align: "center",
  });

  result.fields.forEach((field, index) => {
    const y = panelY + 1.02 + index * 0.68;
    if (index > 0) {
      slide.addShape("line", {
        x: auditX + 0.3,
        y: y - 0.14,
        w: auditW - 0.6,
        h: 0,
        line: { color: "EBEDEB", pt: 0.5 },
      });
    }
    slide.addText(field.label, {
      x: auditX + 0.3,
      y,
      w: 1.6,
      h: 0.22,
      fontSize: 10,
      bold: true,
      color: "273036",
      margin: 0,
    });
    slide.addText(`${field.complete} / ${field.missing}`, {
      x: auditX + 2.1,
      y,
      w: 1.45,
      h: 0.22,
      fontSize: 9.5,
      color: "4B5563",
      align: "center",
      margin: 0,
    });
    const barX = auditX + 3.82;
    const barY = y + 0.03;
    const barW = 1.45;
    slide.addShape("roundRect", {
      x: barX,
      y: barY,
      w: barW,
      h: 0.14,
      fill: { color: "E5E7EB" },
      line: { color: "E5E7EB", transparency: 100 },
      rectRadius: 0.03,
    });
    if (field.coverage > 0) {
      slide.addShape("roundRect", {
        x: barX,
        y: barY,
        w: barW * Math.min(1, field.coverage / 100),
        h: 0.14,
        fill: { color: primaryColor },
        line: { color: primaryColor, transparency: 100 },
        rectRadius: 0.03,
      });
    }
    slide.addText(`${field.coverage.toFixed(1)}%`, {
      x: auditX + 5.38,
      y,
      w: 0.58,
      h: 0.2,
      fontSize: 8.5,
      bold: true,
      color: "4B5563",
      align: "right",
      margin: 0,
    });
  });

  const findingX = 7.06;
  const findingW = SLIDE_W - findingX - margin;
  slide.addShape("roundRect", {
    x: findingX,
    y: panelY,
    w: findingW,
    h: panelH,
    fill: { color: "F7F8F7" },
    line: { color: "E2E5E3", pt: 0.7 },
    rectRadius: 0.05,
  });
  slide.addText("QUALITY FINDINGS", {
    x: findingX + 0.3,
    y: panelY + 0.25,
    w: findingW - 0.6,
    h: 0.2,
    fontSize: 8.5,
    bold: true,
    color: "7A827E",
    charSpacing: 0.8,
    margin: 0,
  });
  result.findings.forEach((finding, index) => {
    const y = panelY + 0.75 + index * 0.9;
    slide.addShape("ellipse", {
      x: findingX + 0.3,
      y,
      w: 0.28,
      h: 0.28,
      fill: { color: index === 2 && result.unmatchedElections > 0 ? warningColor : primaryColor },
      line: {
        color: index === 2 && result.unmatchedElections > 0 ? warningColor : primaryColor,
        transparency: 100,
      },
    });
    slide.addText(String(index + 1), {
      x: findingX + 0.3,
      y: y + 0.055,
      w: 0.28,
      h: 0.14,
      fontSize: 7,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    });
    slide.addText(finding, {
      x: findingX + 0.72,
      y: y - 0.02,
      w: findingW - 1.05,
      h: 0.63,
      fontSize: 9.2,
      color: "4B5563",
      margin: 0,
      fit: "shrink",
      valign: "top",
    });
  });

  slide.addText(result.note, {
    x: margin,
    y: 6.84,
    w: SLIDE_W - margin * 2,
    h: 0.31,
    fontSize: 7.5,
    color: "6B7280",
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

export function addRenewalComparisonSlides(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "renewal"; available: true }>,
  primary: string,
  secondary: string
) {
  const primaryColor = stripHash(primary);
  const warningColor = "D97706";
  const firstPageRows = result.rows.slice(0, 6);
  const remainingRows = result.rows.slice(6);
  const pages = [
    { rows: firstPageRows, first: true },
    ...Array.from({ length: Math.ceil(remainingRows.length / 10) }, (_, index) => ({
      rows: remainingRows.slice(index * 10, index * 10 + 10),
      first: false,
    })),
  ];

  const rateTransition = (
    priorRate: number | null,
    priorPeriod: string | null,
    currentRate: number | null,
    currentPeriod: string | null,
    status: (typeof result.rows)[number]["status"]
  ) => {
    if (status === "new")
      return `New · ${rateCurrency(currentRate ?? 0, currentPeriod ?? "")}`;
    if (status === "removed")
      return `${rateCurrency(priorRate ?? 0, priorPeriod ?? "")} · Removed`;
    return `${rateCurrency(priorRate ?? 0, priorPeriod ?? "")} → ${rateCurrency(currentRate ?? 0, currentPeriod ?? "")}`;
  };

  const tableRows = (rows: typeof result.rows): PptxGenJS.TableRow[] => {
    const header: PptxGenJS.TableRow = [
      "Benefit / plan",
      "Coverage tier",
      `${result.currentLabel} enrolled`,
      "Employee rate",
      "Employer rate",
      "Annual impact",
      "Rate change",
    ].map((text) => ({
      text,
      options: {
        fill: { color: primaryColor },
        color: "FFFFFF",
        bold: true,
        fontSize: 8.2,
        margin: 0.05,
      },
    }));

    const body: PptxGenJS.TableRow[] = rows.map((row, index) => {
      const fill = index % 2 === 0 ? "FFFFFF" : "F7F8F7";
      const baseOptions = {
        fill: { color: fill },
        color: "273036",
        fontSize: 7.9,
        margin: 0.05,
      };
      const plan =
        row.status === "renamed"
          ? `${row.benefit} · ${row.priorPlan} → ${row.currentPlan} (renamed)`
          : `${row.benefit} · ${row.currentPlan ?? row.priorPlan}${row.status === "new" ? " (new)" : row.status === "removed" ? " (removed)" : ""}`;
      return [
        { text: plan, options: { ...baseOptions, bold: true } },
        { text: row.tier, options: baseOptions },
        {
          text: row.status === "removed" ? "—" : String(row.enrolled),
          options: { ...baseOptions, bold: true, align: "center" },
        },
        {
          text: rateTransition(
            row.priorEmployeeRate,
            row.priorRatePeriod,
            row.currentEmployeeRate,
            row.currentRatePeriod,
            row.status
          ),
          options: baseOptions,
        },
        {
          text: rateTransition(
            row.priorEmployerRate,
            row.priorRatePeriod,
            row.currentEmployerRate,
            row.currentRatePeriod,
            row.status
          ),
          options: baseOptions,
        },
        {
          text: row.totalChange === null ? "—" : signedCompactCurrency(row.totalChange),
          options: {
            ...baseOptions,
            bold: true,
            color: row.totalChange !== null && row.totalChange > 0 ? warningColor : primaryColor,
            align: "right",
          },
        },
        {
          text: percentageChangeLabel(row.totalChangePercentage),
          options: {
            ...baseOptions,
            bold: true,
            color:
              row.totalChangePercentage !== null && row.totalChangePercentage > 0
                ? warningColor
                : primaryColor,
            align: "center",
          },
        },
      ];
    });
    return [header, ...body];
  };

  pages.forEach((page, pageIndex) => {
    const slide = addContentSlide(pres);
    addHeader(
      slide,
      page.first ? insightTitle(result) : `${result.title} — continued ${pageIndex + 1}`,
      primary,
      secondary,
      result.title
    );

    let tableY = 1.25;
    if (page.first) {
      const summaryCards = [
        {
          label: "Employer annual impact",
          value: signedCompactCurrency(result.summary.employerChange),
          change: percentageChangeLabel(result.summary.employerChangePercentage),
          detail: `${compactCurrency(result.summary.priorAnnualEmployerCost)} → ${compactCurrency(result.summary.currentAnnualEmployerCost)}`,
        },
        {
          label: "Employee annual impact",
          value: signedCompactCurrency(result.summary.employeeChange),
          change: percentageChangeLabel(result.summary.employeeChangePercentage),
          detail: `${compactCurrency(result.summary.priorAnnualEmployeeCost)} → ${compactCurrency(result.summary.currentAnnualEmployeeCost)}`,
        },
        {
          label: "Total renewal impact",
          value: signedCompactCurrency(result.summary.totalChange),
          change: percentageChangeLabel(result.summary.totalChangePercentage),
          detail: `${compactCurrency(result.summary.priorAnnualTotalCost)} → ${compactCurrency(result.summary.currentAnnualTotalCost)}`,
        },
        {
          label: "Comparable rate rows",
          value: String(result.comparableRows),
          change: `${result.renamedRows} renamed`,
          detail: `${result.newRows} new · ${result.removedRows} removed`,
        },
      ];
      const margin = 0.48;
      const gap = 0.16;
      const cardW = (SLIDE_W - margin * 2 - gap * 3) / 4;
      summaryCards.forEach((card, index) => {
        const x = margin + index * (cardW + gap);
        slide.addShape("roundRect", {
          x,
          y: 1.14,
          w: cardW,
          h: 1.05,
          fill: { color: "F7F8F7" },
          line: { color: "E2E5E3", pt: 0.6 },
          rectRadius: 0.05,
        });
        slide.addText(card.value, {
          x: x + 0.2,
          y: 1.28,
          w: 1.4,
          h: 0.32,
          fontSize: 18,
          bold: true,
          color:
            index < 3 && card.value.startsWith("+") ? warningColor : primaryColor,
          margin: 0,
          fit: "shrink",
        });
        slide.addText(card.change, {
          x: x + 1.58,
          y: 1.34,
          w: cardW - 1.78,
          h: 0.18,
          fontSize: 8.5,
          bold: true,
          color:
            index < 3 && card.change.startsWith("+") ? warningColor : "5B6661",
          align: "right",
          margin: 0,
          fit: "shrink",
        });
        slide.addText(card.label, {
          x: x + 0.2,
          y: 1.66,
          w: cardW - 0.4,
          h: 0.17,
          fontSize: 8.7,
          bold: true,
          color: "273036",
          margin: 0,
        });
        slide.addText(card.detail, {
          x: x + 0.2,
          y: 1.9,
          w: cardW - 0.4,
          h: 0.14,
          fontSize: 7,
          color: "6B7280",
          margin: 0,
          fit: "shrink",
        });
      });
      tableY = 2.45;
    }

    if (page.rows.length) {
      slide.addTable(tableRows(page.rows), {
        x: 0.5,
        y: tableY,
        w: SLIDE_W - 1,
        colW: [2.85, 1.35, 0.75, 2.2, 2.2, 1.65, 1.33],
        rowH: 0.5,
        border: { type: "solid", color: "E5E7EB", pt: 0.4 },
        autoPage: false,
        margin: 0.05,
      });
    } else {
      slide.addText("Add policy rates to both plan years to calculate renewal changes.", {
        x: 0.75,
        y: 3.25,
        w: SLIDE_W - 1.5,
        h: 0.4,
        fontSize: 14,
        color: "6B7280",
        align: "center",
      });
    }

    if (page.first) {
      addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.12, 0.61);
      slide.addText(result.note, {
        x: 0.55,
        y: 6.87,
        w: SLIDE_W - 1.1,
        h: 0.18,
        fontSize: 6.5,
        color: "6B7280",
        margin: 0,
        fit: "shrink",
        align: "center",
      });
    }
  });
}

function addStatsSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "stats" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

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
  secondary: string,
  options: { valueFormat?: "number" | "currency" } = {}
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const svg = renderBarChartSvg(
    result,
    paletteFor(primary, secondary),
    1200,
    560,
    options
  );
  const png = svgToPng(svg);
  const imgH = 4.55;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: 0.6,
    y: 1.2,
    w: SLIDE_W - 1.2,
    h: imgH,
  });

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.05, 0.76);
}

function addStackedBarSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "bar" }>,
  primary: string,
  secondary: string,
  options: { normalize?: boolean; valueFormat?: "number" | "currency" } = {}
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const svg = renderStackedBarChartSvg(
    result,
    paletteFor(primary, secondary),
    1200,
    560,
    options
  );
  const png = svgToPng(svg);
  const imgH = 4.55;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: 0.6,
    y: 1.2,
    w: SLIDE_W - 1.2,
    h: imgH,
  });

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.05, 0.76);
}

function addPieSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "pie" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const svg = renderPieChartSvg(result, paletteFor(primary, secondary), 700, 620);
  const png = svgToPng(svg);
  const imgSize = 4.55;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: SLIDE_W / 2 - imgSize / 2,
    y: 1.2,
    w: imgSize,
    h: imgSize,
  });

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.05, 0.76);
}

function addTableSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "table" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const headerRow: PptxGenJS.TableRow = result.columns.map((c) => ({
    text: c,
    options: { fill: { color: stripHash(primary) }, color: "FFFFFF", bold: true, fontSize: 12 },
  }));

  const bodyRows: PptxGenJS.TableRow[] = result.rows.slice(0, 11).map((row, i) =>
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

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.05, 0.76);
}

function addMapSlide(
  pres: PptxGenJS,
  result: Extract<ChartResult, { kind: "map" }>,
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  addHeader(slide, insightTitle(result), primary, secondary, result.title);

  const svg = renderWorkforceMapSvg(result, primary, 1200, 560);
  const png = svgToPng(svg);
  const imgH = 4.55;
  slide.addImage({
    data: `image/png;base64,${png.toString("base64")}`,
    x: 0.6,
    y: 1.15,
    w: SLIDE_W - 1.2,
    h: imgH,
  });

  addTakeawayPanel(slide, takeawayForResult(result), primary, secondary, 6.05, 0.76);
}

function addPanelSlide(
  pres: PptxGenJS,
  title: string,
  panels: ChartResult[],
  primary: string,
  secondary: string
) {
  const slide = addContentSlide(pres);
  const panelHeadline =
    title === "Coverage Tier Enrollment"
      ? "Coverage tiers reveal how enrollment differs across core benefits"
      : insightTitle(panels[0], title);
  addHeader(slide, panelHeadline, primary, secondary, title);

  const colors = paletteFor(primary, secondary);
  const n = panels.length;
  const gap = 0.35;
  const panelW = (SLIDE_W - gap * (n + 1)) / n;
  const panelTop = 1.25;
  const titleH = 0.45;
  const imgH = 3.45;
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
        h: 0.5,
        fontSize: 11,
        italic: true,
        color: "4B5563",
        align: "center",
      });
    }
  });

  let panelTakeaway = panels.map((panel) => generateCaption(panel)).filter(Boolean).join("  ");
  if (title === "Coverage Tier Enrollment") {
    const leaders = panels.flatMap((panel) => {
      if (panel.kind !== "bar" || panel.data.length === 0) return [];
      const row = panel.data[0];
      const ranked = panel.series
        .map((series) => ({ label: series.label, value: Number(row[series.key]) || 0 }))
        .sort((a, b) => b.value - a.value);
      const total = ranked.reduce((sum, item) => sum + item.value, 0);
      const benefit = panel.title.split(" ")[0];
      return ranked[0] && total > 0
        ? [{ benefit, label: ranked[0].label, share: Math.round((ranked[0].value / total) * 100) }]
        : [];
    });
    if (leaders.length > 0 && leaders.every((leader) => leader.label === leaders[0].label)) {
      panelTakeaway = `${leaders[0].label} is the largest tier across ${leaders
        .map((leader) => `${leader.benefit} (${leader.share}%)`)
        .join(", ")}.`;
    }
  }

  addTakeawayPanel(
    slide,
    panelTakeaway,
    primary,
    secondary,
    6.08,
    0.72
  );
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
    (planYear.deckConfig?.selections as Record<string, ChartSelection> | undefined) ?? {};

  const isEnabled = (key: string) =>
    selections[key]?.enabled ?? defsByKey.get(key)?.defaultEnabled ?? false;
  const selectedView = (key: string) => chartView(key, selections[key]);

  const dataset = await loadChartDataset(planYearId);

  const primary = planYear.client.primaryColor;
  const secondary = planYear.client.secondaryColor;

  const pres = new PptxGenJS();
  pres.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H });
  pres.layout = "WIDE";
  pres.author = "Benefit HQ";
  pres.company = planYear.client.name;
  pres.subject = `Benefits renewal analysis for ${planYear.label}`;
  pres.title = `${planYear.client.name} — ${planYear.label}`;
  defineContentMaster(
    pres,
    planYear.client.name,
    planYear.label,
    planYear.effectiveDate
  );

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
    y: SLIDE_H / 2 - 1.05,
    w: SLIDE_W - 1.2,
    h: 1.4,
    fontSize: 42,
    bold: true,
    color: "FFFFFF",
    margin: 0,
    fit: "shrink",
  });
  titleSlide.addText(`Benefits Renewal Analysis — ${planYear.label}`, {
    x: 0.6,
    y: SLIDE_H / 2 + 0.42,
    w: SLIDE_W - 1.2,
    h: 0.6,
    fontSize: 20,
    color: stripHash(secondary),
    margin: 0,
  });
  titleSlide.addText("PREPARED FOR BENEFITS PLANNING", {
    x: 2.25,
    y: 0.62,
    w: 4.5,
    h: 0.18,
    fontSize: 8.5,
    bold: true,
    color: "FFFFFF",
    transparency: 18,
    charSpacing: 1.1,
    margin: 0,
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
  const renderedResults: ChartResult[] = [];
  let currentCategory: string | null = null;
  let sectionNumber = 0;
  const ensureSection = (category: string) => {
    if (category === currentCategory) return;
    currentCategory = category;
    sectionNumber += 1;
    addSectionDividerSlide(
      pres,
      category,
      sectionNumber,
      primary,
      secondary,
      planYear.client.name,
      planYear.label
    );
  };

  // Chart/table slides, in catalog order, for every enabled chart with data
  for (const def of chartDefinitions) {
    if (consumedKeys.has(def.key)) continue;

    const group = keyToGroup.get(def.key);
    if (group && activeGroups.has(group)) {
      const panelResults = group.keys.map((k) => CHART_COMPUTE[k](dataset));
      ensureSection(def.category);
      renderedResults.push(...panelResults);
      if (group.title === "Coverage Tier Enrollment") {
        const tierResults = panelResults.filter(
          (result): result is Extract<ChartResult, { kind: "bar" }> =>
            result.kind === "bar"
        );
        const view = selectedView(group.keys[0]);
        if (view === "table") {
          addTableSlide(pres, tierTableResult(tierResults), primary, secondary);
        } else if (view === "stacked") {
          addStackedBarSlide(
            pres,
            tierCombinedBarResult(tierResults),
            primary,
            secondary,
            { normalize: true }
          );
        } else {
          addPanelSlide(pres, group.title, panelResults, primary, secondary);
        }
      } else {
        addPanelSlide(pres, group.title, panelResults, primary, secondary);
      }
      group.keys.forEach((k) => consumedKeys.add(k));
      continue;
    }

    if (!isEnabled(def.key)) continue;

    const compute = CHART_COMPUTE[def.key];
    if (!compute) continue;
    const result = compute(dataset);
    const view = selectedView(def.key);

    if (result.kind === "renewal" && !result.available) continue;
    ensureSection(def.category);
    renderedResults.push(result);

    if (result.kind === "executive") addExecutiveSummarySlide(pres, result, primary, secondary);
    else if (result.kind === "risk") addWorkforceRiskSlide(pres, result, primary, secondary);
    else if (result.kind === "quality") addDataQualitySlide(pres, result, primary, secondary);
    else if (result.kind === "renewal") {
      if (view === "bar")
        addBarSlide(pres, renewalBarResult(result), primary, secondary, {
          valueFormat: "currency",
        });
      else addRenewalComparisonSlides(pres, result, primary, secondary);
    }
    else if (result.kind === "participation") {
      if (view === "table")
        addTableSlide(pres, participationTableResult(result), primary, secondary);
      else if (view === "stacked")
        addStackedBarSlide(
          pres,
          participationBarResult(result),
          primary,
          secondary
        );
      else addBenefitsParticipationSlide(pres, result, primary, secondary);
    }
    else if (result.kind === "contribution") {
      if (view === "stacked")
        addStackedBarSlide(
          pres,
          contributionBarResult(result),
          primary,
          secondary,
          { valueFormat: "currency" }
        );
      else addContributionStrategySlides(pres, result, primary, secondary);
    }
    else if (result.kind === "stats") addStatsSlide(pres, result, primary, secondary);
    else if (result.kind === "bar") {
      if (
        COVERAGE_TIER_KEYS.includes(
          def.key as (typeof COVERAGE_TIER_KEYS)[number]
        ) && view === "table"
      )
        addTableSlide(pres, tierTableResult([result]), primary, secondary);
      else if (
        COVERAGE_TIER_KEYS.includes(
          def.key as (typeof COVERAGE_TIER_KEYS)[number]
        ) && view === "stacked"
      )
        addStackedBarSlide(pres, result, primary, secondary, { normalize: true });
      else addBarSlide(pres, result, primary, secondary);
    }
    else if (result.kind === "pie") addPieSlide(pres, result, primary, secondary);
    else if (result.kind === "map") {
      if (view === "bar")
        addBarSlide(pres, geographyBarResult(result), primary, secondary);
      else if (view === "table")
        addTableSlide(pres, geographyTableResult(result), primary, secondary);
      else addMapSlide(pres, result, primary, secondary);
    }
    else addTableSlide(pres, result, primary, secondary);
  }

  addRecommendationsSlide(
    pres,
    buildDeckRecommendations(renderedResults),
    primary,
    secondary
  );

  const output = await pres.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Uint8Array);
}
