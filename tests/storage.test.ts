import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  legacyLogoFilenameFromUrl,
  storedLogoPathFromUrl,
} from "@/lib/storage";

test("managed logo URLs resolve only safe storage filenames", () => {
  assert.equal(
    storedLogoPathFromUrl("/api/logos/client-logo.png"),
    path.join("logos", "client-logo.png")
  );
  assert.equal(storedLogoPathFromUrl("/api/logos/../../secret"), null);
  assert.equal(storedLogoPathFromUrl("https://example.com/logo.png"), null);
});

test("legacy logo cleanup accepts only safe historical filenames", () => {
  assert.equal(
    legacyLogoFilenameFromUrl("/uploads/logos/old-logo.webp"),
    "old-logo.webp"
  );
  assert.equal(legacyLogoFilenameFromUrl("/uploads/logos/../secret"), null);
});
