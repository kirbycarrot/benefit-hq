import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import {
  importClientExportPayload,
  parseClientExportPayload,
  CLIENT_EXPORT_FORMAT,
  CLIENT_EXPORT_VERSION,
} from "@/lib/client-transfer";
import {
  CLIENT_EXCEL_MAX_BYTES,
  ClientExcelValidationError,
  parseClientExcelWorkbook,
} from "@/lib/client-excel";
import { isXlsxFile } from "@/lib/uploads";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a client export file" }, { status: 400 });
  }

  let payload;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (isXlsxFile(buffer)) {
    if (file.size > CLIENT_EXCEL_MAX_BYTES) {
      return NextResponse.json({ error: "Excel intake files must be 25 MB or smaller." }, { status: 400 });
    }
    try {
      payload = await parseClientExcelWorkbook(buffer);
    } catch (error) {
      if (error instanceof ClientExcelValidationError) {
        return NextResponse.json(
          { error: error.message, issues: error.issues },
          { status: 400 }
        );
      }
      console.error("Client Excel validation failed", error);
      return NextResponse.json({ error: "Unable to read this Excel intake workbook." }, { status: 400 });
    }
  } else {
    let raw: unknown;
    try {
      raw = JSON.parse(buffer.toString("utf8"));
    } catch {
      return NextResponse.json({ error: "This file isn't a valid Benefit HQ client file" }, { status: 400 });
    }

    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as { format?: unknown }).format !== CLIENT_EXPORT_FORMAT
    ) {
      return NextResponse.json({ error: "This file isn't a valid Benefit HQ client file" }, { status: 400 });
    }
    if ((raw as { version?: unknown }).version !== CLIENT_EXPORT_VERSION) {
      return NextResponse.json(
        { error: "This file was created by an incompatible version of the import/export feature" },
        { status: 400 }
      );
    }

    try {
      payload = parseClientExportPayload(raw);
    } catch (error) {
      const message = error instanceof ZodError ? (error.issues[0]?.message ?? "Invalid export file") : "Invalid export file";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const result = await importClientExportPayload(payload, { createdById: session.user.id });
    return NextResponse.json({ id: result.clientId, warnings: result.warnings });
  } catch (error) {
    console.error("Client import failed", error);
    return NextResponse.json({ error: "Unable to import this client. No data was changed." }, { status: 500 });
  }
}
