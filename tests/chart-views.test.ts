import assert from "node:assert/strict";
import test from "node:test";
import type { ChartResult } from "@/lib/charts/types";
import {
  chartView,
  normalizeCoverageTierViews,
} from "@/lib/charts/viewOptions";
import {
  participationBarResult,
  tierCombinedBarResult,
  tierTableResult,
} from "@/lib/charts/viewTransforms";
import { renderStackedBarChartSvg } from "@/lib/charts/svgRender";

test("chart views use curated defaults and reject unsupported persisted values", () => {
  assert.equal(chartView("geographic-distribution"), "map");
  assert.equal(
    chartView("geographic-distribution", {
      enabled: true,
      params: { view: "unsupported" },
    }),
    "map"
  );
  assert.equal(
    chartView("geographic-distribution", { enabled: true, params: { view: "table" } }),
    "table"
  );
});

test("coverage tier views stay synchronized", () => {
  const selections = normalizeCoverageTierViews({
    "medical-tier-enrollment": { enabled: true },
    "dental-tier-enrollment": { enabled: true, params: { view: "stacked" } },
    "vision-tier-enrollment": { enabled: true },
  });

  assert.equal(selections["medical-tier-enrollment"].params?.view, "stacked");
  assert.equal(selections["dental-tier-enrollment"].params?.view, "stacked");
  assert.equal(selections["vision-tier-enrollment"].params?.view, "stacked");
});

test("participation and tier results transform into alternate chart views", () => {
  const participation = {
    kind: "participation",
    title: "Benefits Participation & Waivers",
    benefits: [
      {
        name: "Medical",
        eligible: 10,
        enrolled: 7,
        waived: 2,
        unreported: 1,
        participation: 70,
      },
    ],
    note: "Test note",
  } satisfies Extract<ChartResult, { kind: "participation" }>;
  const participationBars = participationBarResult(participation);
  assert.deepEqual(participationBars.data[0], {
    Benefit: "Medical",
    Enrolled: 7,
    Waived: 2,
    "Not recorded": 1,
  });

  const tierResults = ["Medical", "Dental", "Vision"].map(
    (benefit) =>
      ({
        kind: "bar",
        title: `${benefit} Coverage Tier Enrollment`,
        xKey: "plan",
        series: [
          { key: "Employee", label: "Employee" },
          { key: "Family", label: "Family" },
        ],
        data: [{ plan: benefit, Employee: 8, Family: 2 }],
      }) satisfies Extract<ChartResult, { kind: "bar" }>
  );
  assert.equal(tierCombinedBarResult(tierResults).data.length, 3);
  assert.deepEqual(tierTableResult(tierResults).rows[0], ["Medical", 8, 2]);

  const svg = renderStackedBarChartSvg(
    tierCombinedBarResult(tierResults),
    ["1F2937", "2FE0D2"],
    800,
    420,
    { normalize: true }
  );
  assert.match(svg, /80%/);
  assert.doesNotMatch(svg, /NaN/);
});
