import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildClientExcelWorkbook, clientExcelFilename } from "@/lib/client-excel";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const workbook = await buildClientExcelWorkbook();
  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${clientExcelFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
