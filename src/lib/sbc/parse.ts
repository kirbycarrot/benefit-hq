import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

// pdfjs-dist (used internally by pdf-parse) resolves its worker script
// relative to its own bundled module by default, which breaks once Next.js
// (Turbopack) rewrites that module into a server chunk with a different
// layout. Point it at the real on-disk worker file instead of relying on
// that default resolution.
let workerConfigured = false;
function ensureWorkerConfigured() {
  if (workerConfigured) return;
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerConfigured = true;
}

// Summary of Benefits and Coverage (SBC) forms are a federally mandated
// template (ACA Section 2715) — every carrier fills the same wording into
// the same sections ("What is the overall deductible?", "coinsurance",
// etc.), which is what makes light-touch text-pattern extraction workable
// here. It is still a heuristic first pass: real-world PDFs vary in layout,
// spacing, and column order, so every extracted value is meant to be
// reviewed before being applied to a plan, not trusted blindly.

export type SbcExtractedFields = {
  planNameGuess: string | null;
  deductibleIndividual: number | null;
  deductibleFamily: number | null;
  oopMaximumIndividual: number | null;
  oopMaximumFamily: number | null;
  memberCoinsurance: number | null;
  primaryCareCopay: number | null;
  specialistCopay: number | null;
  urgentCareCopay: number | null;
  emergencyRoomCopay: number | null;
  genericCopay: number | null;
  formularyBrandCopay: number | null;
  nonFormularyBrandCopay: number | null;
  specialtyCopay: number | null;
};

export const SBC_FIELD_LABELS: Record<keyof Omit<SbcExtractedFields, "planNameGuess">, string> = {
  deductibleIndividual: "Individual deductible",
  deductibleFamily: "Family deductible",
  oopMaximumIndividual: "Individual out-of-pocket maximum",
  oopMaximumFamily: "Family out-of-pocket maximum",
  memberCoinsurance: "Member coinsurance",
  primaryCareCopay: "Physician office visit",
  specialistCopay: "Specialist visit",
  urgentCareCopay: "Urgent care",
  emergencyRoomCopay: "Emergency room",
  genericCopay: "Generic drug",
  formularyBrandCopay: "Formulary brand drug",
  nonFormularyBrandCopay: "Non-formulary brand drug",
  specialtyCopay: "Specialty drug",
};

export async function extractPdfText(buffer: Buffer): Promise<string> {
  ensureWorkerConfigured();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function findDollarPair(
  text: string,
  keyword: RegExp,
  windowSize = 220
): { first: number | null; second: number | null } {
  const match = keyword.exec(text);
  if (!match) return { first: null, second: null };
  const window = text.slice(match.index, match.index + windowSize);
  const amounts = Array.from(window.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)).map((m) =>
    toNumber(m[1])
  );
  return { first: amounts[0] ?? null, second: amounts[1] ?? null };
}

function findCopay(text: string, keyword: RegExp, windowSize = 150): number | null {
  const match = keyword.exec(text);
  if (!match) return null;
  const window = text.slice(match.index, match.index + windowSize);
  const copay = /\$\s?([\d,]+(?:\.\d{2})?)\s*copay/i.exec(window);
  return copay ? toNumber(copay[1]) : null;
}

function findCoinsurance(text: string): number | null {
  const match = /(\d{1,3})\s*%\s*coinsurance/i.exec(text);
  return match ? Number(match[1]) : null;
}

function guessPlanName(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 3 && line.length < 150);
  return firstLine ?? null;
}

export function parseSbcFields(text: string): SbcExtractedFields {
  const deductible = findDollarPair(text, /overall\s+deductible/i);
  const oopMax = findDollarPair(text, /out.of.pocket\s+limit/i);

  return {
    planNameGuess: guessPlanName(text),
    deductibleIndividual: deductible.first,
    deductibleFamily: deductible.second,
    oopMaximumIndividual: oopMax.first,
    oopMaximumFamily: oopMax.second,
    memberCoinsurance: findCoinsurance(text),
    primaryCareCopay: findCopay(text, /primary care (visit|services)/i),
    specialistCopay: findCopay(text, /specialist (visit|care)/i),
    urgentCareCopay: findCopay(text, /urgent care/i),
    emergencyRoomCopay: findCopay(text, /emergency room/i),
    genericCopay: findCopay(text, /generic drugs?/i),
    formularyBrandCopay: findCopay(text, /preferred brand drugs?/i),
    nonFormularyBrandCopay: findCopay(text, /non-?preferred brand drugs?/i),
    specialtyCopay: findCopay(text, /specialty drugs?/i),
  };
}

export async function parseSbcDocument(buffer: Buffer): Promise<SbcExtractedFields> {
  const text = await extractPdfText(buffer);
  return parseSbcFields(text);
}
