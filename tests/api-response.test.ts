import assert from "node:assert/strict";
import test from "node:test";
import { readApiError, readJsonResponse } from "@/lib/api-response";

test("API errors preserve a JSON error message", async () => {
  const response = Response.json({ error: "Plan year not found" }, { status: 404 });
  assert.equal(await readApiError(response, "Fallback error"), "Plan year not found");
});

test("API errors fall back safely when the server returns non-JSON", async () => {
  const response = new Response("Internal Server Error", {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
  assert.equal(await readApiError(response, "Fallback error"), "Fallback error");
});

test("JSON response parsing tolerates an invalid response body", async () => {
  const response = new Response("not json");
  assert.equal(await readJsonResponse(response), null);
});
