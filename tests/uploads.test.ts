import assert from "node:assert/strict";
import test from "node:test";
import { detectLogoType, isXlsxFile } from "@/lib/uploads";

test("logo validation uses file signatures instead of names or MIME claims", () => {
  assert.deepEqual(
    detectLogoType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { extension: "png", mediaType: "image/png" }
  );
  assert.deepEqual(detectLogoType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {
    extension: "jpg",
    mediaType: "image/jpeg",
  });
  assert.deepEqual(detectLogoType(Buffer.from("RIFF0000WEBP", "ascii")), {
    extension: "webp",
    mediaType: "image/webp",
  });
  assert.equal(detectLogoType(Buffer.from("<svg><script /></svg>")), null);
});

test("xlsx validation requires a ZIP container signature", () => {
  assert.equal(isXlsxFile(Buffer.from([0x50, 0x4b, 0x03, 0x04])), true);
  assert.equal(isXlsxFile(Buffer.from("not an xlsx workbook")), false);
});
