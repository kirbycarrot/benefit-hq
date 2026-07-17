import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const PRIVATE_STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.STORAGE_DIR ?? "./storage"
);
// Logos are non-sensitive brand assets, so they're served directly as static
// files from /public rather than through an authenticated download route.
const PUBLIC_UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads/logos");

export type PrivateBucket = "decks" | "uploads";

function safeFilename(filename: string): string {
  return `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export async function saveLogo(filename: string, data: Buffer): Promise<string> {
  await mkdir(PUBLIC_UPLOADS_DIR, { recursive: true });
  const safeName = safeFilename(filename);
  await writeFile(path.join(PUBLIC_UPLOADS_DIR, safeName), data);
  return `/uploads/logos/${safeName}`;
}

export async function saveFile(
  bucket: PrivateBucket,
  filename: string,
  data: Buffer
): Promise<string> {
  const dir = path.join(PRIVATE_STORAGE_DIR, bucket);
  await mkdir(dir, { recursive: true });
  const safeName = safeFilename(filename);
  await writeFile(path.join(dir, safeName), data);
  return path.join(bucket, safeName);
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(path.join(PRIVATE_STORAGE_DIR, relativePath));
}

export function storedFilePath(relativePath: string): string {
  return path.join(PRIVATE_STORAGE_DIR, relativePath);
}
