import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

const PRIVATE_STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR)
  : path.join(/* turbopackIgnore: true */ process.cwd(), "storage");
const LEGACY_LOGO_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
  "logos"
);
export type PrivateBucket = "decks" | "logos";

function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${randomUUID()}-${cleaned}`;
}

function resolveStoredPath(relativePath: string): string {
  const resolved = path.resolve(PRIVATE_STORAGE_DIR, relativePath);
  const storagePrefix = `${PRIVATE_STORAGE_DIR}${path.sep}`;
  if (!resolved.startsWith(storagePrefix)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function saveLogo(
  extension: "png" | "jpg" | "webp",
  data: Buffer
): Promise<string> {
  const relativePath = await saveFile("logos", `logo.${extension}`, data);
  return `/api/logos/${path.basename(relativePath)}`;
}

export async function saveFile(
  bucket: PrivateBucket,
  filename: string,
  data: Buffer
): Promise<string> {
  const dir = path.join(PRIVATE_STORAGE_DIR, bucket);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const safeName = safeFilename(filename);
  await writeFile(path.join(dir, safeName), data, { mode: 0o600 });
  return path.join(bucket, safeName);
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveStoredPath(relativePath));
}

export function storedFilePath(relativePath: string): string {
  return resolveStoredPath(relativePath);
}

export async function deleteStoredFile(relativePath: string): Promise<void> {
  await unlink(resolveStoredPath(relativePath)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export function storedLogoPathFromUrl(logoUrl: string | null | undefined): string | null {
  const prefix = "/api/logos/";
  if (!logoUrl?.startsWith(prefix)) return null;
  const filename = logoUrl.slice(prefix.length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  return path.join("logos", filename);
}

export function legacyLogoFilenameFromUrl(
  logoUrl: string | null | undefined
): string | null {
  const prefix = "/uploads/logos/";
  if (!logoUrl?.startsWith(prefix)) return null;
  const filename = logoUrl.slice(prefix.length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  return filename;
}

export async function deleteLogoForUrl(
  logoUrl: string | null | undefined
): Promise<void> {
  const storedLogo = storedLogoPathFromUrl(logoUrl);
  if (storedLogo) {
    await deleteStoredFile(storedLogo);
    return;
  }

  const legacyFilename = legacyLogoFilenameFromUrl(logoUrl);
  if (legacyFilename) {
    await unlink(path.join(LEGACY_LOGO_DIR, legacyFilename)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      }
    );
  }
}
