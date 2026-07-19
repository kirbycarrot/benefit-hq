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

export type AcceptedClientDocument = {
  extension: "csv" | "docx" | "pdf" | "pptx" | "txt" | "xls" | "xlsx";
  mediaType: string;
};

const DOCUMENT_TYPES: Record<AcceptedClientDocument["extension"], string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function detectClientDocumentType(
  filename: string,
  buffer: Buffer
): AcceptedClientDocument | null {
  const extension = filename.toLowerCase().split(".").pop();
  if (!extension || !(extension in DOCUMENT_TYPES)) return null;
  const typedExtension = extension as AcceptedClientDocument["extension"];

  if (typedExtension === "pdf" && !startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return null;
  }
  if (
    ["docx", "pptx", "xlsx"].includes(typedExtension) &&
    !ZIP_SIGNATURES.some((signature) => startsWith(buffer, signature))
  ) {
    return null;
  }
  if (
    typedExtension === "xls" &&
    !startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    return null;
  }
  if (["csv", "txt"].includes(typedExtension)) {
    if (buffer.includes(0) || buffer.subarray(0, 8).some((byte) => byte < 0x09)) return null;
  }

  return { extension: typedExtension, mediaType: DOCUMENT_TYPES[typedExtension] };
}
