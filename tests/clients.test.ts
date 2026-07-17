import assert from "node:assert/strict";
import test from "node:test";
import { clientDeletionNameMatches } from "@/lib/clients";

test("permanent deletion requires the exact client name", () => {
  assert.equal(clientDeletionNameMatches("Acme Benefits", "Acme Benefits"), true);
  assert.equal(clientDeletionNameMatches("  Acme Benefits  ", "Acme Benefits"), true);
  assert.equal(clientDeletionNameMatches("acme benefits", "Acme Benefits"), false);
  assert.equal(clientDeletionNameMatches(undefined, "Acme Benefits"), false);
});
