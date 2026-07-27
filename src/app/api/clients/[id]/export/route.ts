import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildClientExportPayload, clientExportFilename } from "@/lib/client-transfer";
import { buildClientExcelWorkbook, clientExcelFilename } from "@/lib/client-excel";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const payload = await buildClientExportPayload(id);
  const format = new URL(request.url).searchParams.get("format");
  if (format === "xlsx") {
    const workbook = await buildClientExcelWorkbook(payload);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${clientExcelFilename(client.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${clientExportFilename(client.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
