export type AcceptedLogo = {
  extension: "png" | "jpg" | "webp";
  mediaType: "image/png" | "image/jpeg" | "image/webp";
};

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((byte, index) => buffer[index] === byte)
  );
}

export function detectLogoType(buffer: Buffer): AcceptedLogo | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mediaType: "image/png" };
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mediaType: "image/jpeg" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mediaType: "image/webp" };
  }

  return null;
}

export function isXlsxFile(buffer: Buffer): boolean {
  return ZIP_SIGNATURES.some((signature) => startsWith(buffer, signature));
}
