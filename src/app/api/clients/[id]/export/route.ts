import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildClientExportPayload, clientExportFilename } from "@/lib/client-transfer";

export async function GET(
  _request: Request,
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

  return new NextResponse(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${clientExportFilename(client.name)}"`,
    },
  });
}
