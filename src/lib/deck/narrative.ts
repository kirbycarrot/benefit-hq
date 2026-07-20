import type { ChartResult } from "@/lib/charts/types";
import { generateCaption } from "@/lib/deck/captions";
import { formatDisplayValue, formatWholeNumber } from "@/lib/number-format";

export type DeckRecommendation = {
  priority: "Immediate attention" | "Renewal consideration" | "Longer-term opportunity";
  title: string;
  detail: string;
};

const SECTION_COPY: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: "Executive overview",
    subtitle: "The workforce and benefit picture at a glance.",
  },
  "renewal & cost": {
    title: "Renewal and cost",
    subtitle: "How rates and contributions shape the renewal outlook.",
  },
  "participation & enrollment": {
    title: "Participation and enrollment",
    subtitle: "Where employees engage with the benefits program—and where they do not.",
  },
  "workforce profile": {
    title: "Workforce profile",
    subtitle: "The demographic, geographic, and continuity factors behind plan needs.",
  },
  "dependent profile": {
    title: "Dependent profile",
    subtitle: "How covered family members influence enrollment and plan demand.",
  },
  "ancillary benefits": {
    title: "Ancillary benefits",
    subtitle: "Participation beyond the core medical, dental, and vision program.",
  },
  "data quality": {
    title: "Data quality",
    subtitle: "The completeness and matching confidence behind the analysis.",
  },
  appendix: {
    title: "Data quality appendix",
    subtitle: "The completeness and matching confidence behind the analysis.",
  },
};

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value);
}

function concise(text: string, maximum = 84): string {
  const normalized = text.replace(/\s+/g, " ").trim().replace(/[.]$/, "");
  if (normalized.length <= maximum) return normalized;
  const shortened = normalized.slice(0, maximum - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(lastSpace, maximum - 14)).trim()}…`;
}

function executiveMetric(result: Extract<ChartResult, { kind: "executive" }>, label: string) {
  return result.metrics.find((metric) => metric.label.toLowerCase() === label)?.value;
}

export function sectionNarrative(category: string): { title: string; subtitle: string } {
  return (
    SECTION_COPY[category.toLowerCase()] ?? {
      title: category.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      subtitle: "Supporting analysis for the benefits planning discussion.",
    }
  );
}

export function insightTitle(result: ChartResult, fallback = result.title): string {
  if (result.kind === "executive") {
    const employees = executiveMetric(result, "total employees");
    const participation = executiveMetric(result, "medical participation");
    if (employees && participation)
      return `${employees} employees anchor a workforce with ${participation} medical participation`;
    return concise(result.observations[0] ?? fallback);
  }

  if (result.kind === "participation") {
    const ranked = [...result.benefits].sort((a, b) => b.participation - a.participation);
    const highest = ranked[0];
    const lowest = ranked.at(-1);
    if (highest && lowest && highest.name !== lowest.name)
      return `${highest.name} leads participation at ${percent(highest.participation)}; ${lowest.name} trails at ${percent(lowest.participation)}`;
  }

  if (result.kind === "contribution" && result.annualTotalSpend > 0) {
    const employerShare = (result.annualEmployerSpend / result.annualTotalSpend) * 100;
    return `The employer funds ${percent(employerShare)} of estimated annual premium`;
  }

  if (result.kind === "risk") {
    const continuity = result.indicators.find((indicator) => indicator.key === "continuity-exposure");
    if (continuity)
      return `${formatWholeNumber(continuity.value)} employees combine age 60+ with 10+ years of service`;
  }

  if (result.kind === "quality") {
    return `${percent(result.censusCompleteness)} of core census fields are complete`;
  }

  if (result.kind === "renewal" && result.available) {
    const change = result.summary.totalChange;
    const direction = change > 0 ? "increases" : change < 0 ? "decreases" : "remains flat";
    const changeLabel = result.summary.totalChangePercentage;
    return change === 0
      ? "Estimated annual renewal cost remains flat"
      : `Estimated annual renewal cost ${direction} by ${compactCurrency(Math.abs(change))}${changeLabel === null ? "" : ` (${percent(Math.abs(changeLabel))})`}`;
  }

  if (result.kind === "map") {
    const top = [...result.areas].sort((a, b) => b.value - a.value)[0];
    if (top && result.mappedEmployees > 0)
      return `${top.name} contains ${Math.round((top.value / result.mappedEmployees) * 100)}% of mapped employees`;
  }

  if (result.kind === "pie" || result.kind === "bar") {
    const caption = generateCaption(result);
    const rankedMatch = caption.match(
      /^(?:Largest group|Largest tier):\s*(.+?)\s+—\s+([\d,.]+)\s+\(([\d.]+)%\)\.?$/i
    );
    if (rankedMatch) {
      const [, label, count, share] = rankedMatch;
      if (result.title.toLowerCase().includes("age"))
        return `${label} is the largest age cohort at ${share}% (${count} employees)`;
      if (result.title.toLowerCase().includes("dependent count") && label === "0")
        return `${count} employees have no covered dependents (${share}%)`;
      return `${label} is the largest group at ${share}% (${count})`;
    }
    if (caption) return concise(caption);
  }

  if (result.kind === "table" && result.rows.length > 0) {
    const first = result.rows[0];
    if (result.columns.some((column) => column.toLowerCase() === "employees"))
      return concise(`${first[0]} is the most common option with ${formatDisplayValue(first[1])} employees`);
    if (result.columns.some((column) => column.toLowerCase() === "participants"))
      return concise(`${first[0]} leads participation with ${formatDisplayValue(first[1])} participants`);
    return concise(`${first[0]} leads the reported results`);
  }

  return concise(fallback);
}

export function takeawayForResult(result: ChartResult): string {
  if (result.kind === "executive") return result.observations[0] ?? "";

  if (result.kind === "participation") {
    const lowest = [...result.benefits].sort((a, b) => a.participation - b.participation)[0];
    if (!lowest) return result.note;
    const unreported = result.benefits.reduce((sum, benefit) => sum + benefit.unreported, 0);
    return unreported > 0
      ? `${lowest.name} has the lowest participation at ${percent(lowest.participation)}; ${formatWholeNumber(unreported)} benefit ${unreported === 1 ? "election is" : "elections are"} not recorded across the three programs.`
      : `${lowest.name} has the lowest participation at ${percent(lowest.participation)}, defining the clearest enrollment opportunity.`;
  }

  if (result.kind === "contribution") {
    if (result.annualTotalSpend === 0) return result.note;
    const employerShare = (result.annualEmployerSpend / result.annualTotalSpend) * 100;
    return `The employer funds ${percent(employerShare)} of ${compactCurrency(result.annualTotalSpend)} in estimated annual premium.`;
  }

  if (result.kind === "risk") return result.observations[2] ?? result.observations[0] ?? result.note;
  if (result.kind === "quality") return result.findings[0] ?? result.note;

  if (result.kind === "renewal") {
    if (!result.available) return result.message;
    const direction = result.summary.totalChange > 0 ? "increase" : result.summary.totalChange < 0 ? "decrease" : "change";
    return `At current enrollment, the modeled renewal produces a ${compactCurrency(Math.abs(result.summary.totalChange))} annual ${direction} in total premium.`;
  }

  if (result.kind === "table" && result.rows.length > 0) {
    const first = result.rows[0];
    if (result.columns.some((column) => column.toLowerCase() === "employees"))
      return `${first[0]} is the largest reported option with ${formatDisplayValue(first[1])} employees.`;
    if (result.columns.some((column) => column.toLowerCase() === "participants")) {
      const participationIndex = result.columns.findIndex(
        (column) => column.toLowerCase() === "participation"
      );
      return `${first[0]} leads with ${formatDisplayValue(first[1])} participants${participationIndex >= 0 ? ` and ${first[participationIndex]} participation` : ""}.`;
    }
  }

  return generateCaption(result);
}

export function buildDeckRecommendations(results: ChartResult[]): DeckRecommendation[] {
  const recommendations: DeckRecommendation[] = [];
  const add = (recommendation: DeckRecommendation) => {
    if (!recommendations.some((item) => item.title === recommendation.title))
      recommendations.push(recommendation);
  };

  const quality = results.find(
    (result): result is Extract<ChartResult, { kind: "quality" }> => result.kind === "quality"
  );
  if (quality && (quality.unmatchedElections > 0 || quality.censusCompleteness < 90)) {
    add({
      priority: "Immediate attention",
      title: "Resolve the remaining data gaps before final renewal decisions",
      detail: `${formatWholeNumber(quality.unmatchedElections)} elections are unmatched and core census completeness is ${percent(quality.censusCompleteness)}.`,
    });
  }

  const participation = results.find(
    (result): result is Extract<ChartResult, { kind: "participation" }> => result.kind === "participation"
  );
  if (participation) {
    const lowest = [...participation.benefits].sort((a, b) => a.participation - b.participation)[0];
    const unreported = participation.benefits.reduce((sum, benefit) => sum + benefit.unreported, 0);
    if (unreported > 0) {
      add({
        priority: "Immediate attention",
        title: "Reconcile elections that are neither enrolled nor waived",
        detail: `${formatWholeNumber(unreported)} election ${unreported === 1 ? "record is" : "records are"} not recorded across Medical, Dental, and Vision.`,
      });
    }
    if (lowest && lowest.participation < 85) {
      add({
        priority: "Renewal consideration",
        title: `Target ${lowest.name.toLowerCase()} enrollment communications`,
        detail: `${lowest.name} participation is ${percent(lowest.participation)}, the lowest of the three core benefits.`,
      });
    }
  }

  const renewal = results.find(
    (result): result is Extract<ChartResult, { kind: "renewal"; available: true }> =>
      result.kind === "renewal" && result.available
  );
  if (renewal && renewal.summary.totalChange > 0) {
    add({
      priority: "Renewal consideration",
      title: "Review the rate rows driving the modeled premium increase",
      detail: `At current enrollment, estimated annual premium increases by ${compactCurrency(renewal.summary.totalChange)}${renewal.summary.totalChangePercentage === null ? "" : ` (${percent(renewal.summary.totalChangePercentage)})`}.`,
    });
  }

  const contribution = results.find(
    (result): result is Extract<ChartResult, { kind: "contribution" }> =>
      result.kind === "contribution"
  );
  if (contribution && contribution.rows.length > 1) {
    const shares = contribution.rows.map((row) => row.employerPaidPercentage);
    const spread = Math.max(...shares) - Math.min(...shares);
    if (spread >= 15) {
      add({
        priority: "Renewal consideration",
        title: "Evaluate contribution consistency across plans and tiers",
        detail: `Employer-paid percentages span ${percent(Math.min(...shares))} to ${percent(Math.max(...shares))} across matched rate rows.`,
      });
    }
  }

  const risk = results.find(
    (result): result is Extract<ChartResult, { kind: "risk" }> => result.kind === "risk"
  );
  const continuity = risk?.indicators.find((indicator) => indicator.key === "continuity-exposure");
  if (continuity && continuity.value > 0) {
    add({
      priority: "Longer-term opportunity",
      title: "Incorporate workforce continuity into benefits planning",
      detail: `${formatWholeNumber(continuity.value)} employees (${percent(continuity.percentage)}) combine age 60+ with 10+ years of service.`,
    });
  }

  const geography = results.find(
    (result): result is Extract<ChartResult, { kind: "map" }> => result.kind === "map"
  );
  if (geography && geography.mappedEmployees > 0) {
    const top = [...geography.areas].sort((a, b) => b.value - a.value)[0];
    const share = top ? (top.value / geography.mappedEmployees) * 100 : 0;
    if (top && share >= 60) {
      add({
        priority: "Longer-term opportunity",
        title: `Validate network access around ${top.name}`,
        detail: `${top.name} contains ${percent(share)} of mapped employees, making local access especially important.`,
      });
    }
  }

  if (recommendations.length === 0) {
    add({
      priority: "Renewal consideration",
      title: "Maintain the current program strengths through renewal",
      detail: "The selected analyses do not identify a material exception requiring immediate action.",
    });
  }

  return recommendations.slice(0, 5);
}
