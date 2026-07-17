import assert from "node:assert/strict";
import test from "node:test";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";

test("advisory locks project a Prisma-supported result type", async () => {
  let query = "";
  let values: unknown[] = [];
  const tx = {
    async $queryRaw(strings: TemplateStringsArray, ...parameters: unknown[]) {
      query = strings.join("$value");
      values = parameters;
      return [{ acquired: 1 }];
    },
  };

  await acquireAdvisoryTransactionLock(tx as never, "plan-year-id");

  assert.match(query, /SELECT 1 AS acquired/);
  assert.match(query, /pg_advisory_xact_lock/);
  assert.deepEqual(values, ["plan-year-id"]);
});
