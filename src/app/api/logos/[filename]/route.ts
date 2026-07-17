import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readStoredFile } from "@/lib/storage";

const MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }

  const mediaType = MEDIA_TYPES[path.extname(filename).toLowerCase()];
  if (!mediaType) {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }

  try {
    const buffer = await readStoredFile(path.join("logos", filename));
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": mediaType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  }
}
