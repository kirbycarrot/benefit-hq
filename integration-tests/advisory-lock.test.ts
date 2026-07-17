import "dotenv/config";
import test, { after } from "node:test";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import { prisma } from "@/lib/prisma";

after(async () => {
  await prisma.$disconnect();
});

test("Prisma can execute and deserialize the PostgreSQL advisory lock", async () => {
  await prisma.$transaction((tx) =>
    acquireAdvisoryTransactionLock(tx, "benefit-hq-integration-test")
  );
});
