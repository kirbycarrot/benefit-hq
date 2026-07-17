import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseWorkbook } from "@/lib/census/parseWorkbook";
import { normalizeCensus } from "@/lib/census/normalize";
import { persistCensus } from "@/lib/census/persist";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planYearId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planYearId } = await params;
  const planYear = await prisma.planYear.findUnique({ where: { id: planYearId } });
  if (!planYear) {
    return NextResponse.json({ error: "Plan year not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a census file to upload" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be under 20MB" }, { status: 400 });
  }

  // The workbook contains SSNs used only to join sheets in-memory below; the
  // raw file is never written to disk and SSNs are discarded once normalized.
  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    const sheets = await parseWorkbook(buffer);
    result = normalizeCensus(sheets);
  } catch {
    return NextResponse.json(
      { error: "Could not read that file. Is it a valid .xlsx workbook?" },
      { status: 400 }
    );
  }

  if (result.blocking) {
    await prisma.censusUpload.create({
      data: {
        planYearId,
        filenames: [file.name],
        status: "failed",
        warnings: result.warnings,
        summary: result.summary,
      },
    });
    return NextResponse.json({ error: result.warnings[0], warnings: result.warnings }, { status: 422 });
  }

  await persistCensus(planYearId, result);

  const censusUpload = await prisma.censusUpload.create({
    data: {
      planYearId,
      filenames: [file.name],
      status: "committed",
      warnings: result.warnings,
      summary: result.summary,
    },
  });

  return NextResponse.json({
    id: censusUpload.id,
    warnings: result.warnings,
    summary: result.summary,
  });
}
