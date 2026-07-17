import assert from "node:assert/strict";
import test from "node:test";
import {
  BootstrapClosedError,
  bootstrapAdmin,
  bootstrapTokenMatches,
} from "@/lib/bootstrap";

test("bootstrap tokens are compared exactly", () => {
  assert.equal(bootstrapTokenMatches("correct horse", "correct horse"), true);
  assert.equal(bootstrapTokenMatches("correct horse", "wrong horse"), false);
  assert.equal(bootstrapTokenMatches("short", "much longer"), false);
});

test("bootstrap refuses to create an administrator after initialization", async () => {
  let created = false;
  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      return callback({
        $queryRaw: async () => [],
        user: {
          count: async () => 1,
          create: async () => {
            created = true;
          },
        },
      });
    },
  };

  await assert.rejects(
    bootstrapAdmin(
      { name: "Admin", email: "admin@example.com", passwordHash: "hash" },
      client as never
    ),
    BootstrapClosedError
  );
  assert.equal(created, false);
});
