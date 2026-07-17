import { timingSafeEqual } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import { prisma } from "@/lib/prisma";

type TransactionRunner = Pick<typeof prisma, "$transaction">;

export class BootstrapClosedError extends Error {
  constructor() {
    super("Registration is closed");
  }
}

export function bootstrapTokenMatches(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function createFirstAdmin(
  tx: Prisma.TransactionClient,
  input: { name: string; email: string; passwordHash: string }
) {
  await acquireAdvisoryTransactionLock(tx, "benefit-hq-bootstrap-admin");
  const userCount = await tx.user.count();
  if (userCount > 0) throw new BootstrapClosedError();

  return tx.user.create({
    data: { ...input, isAdmin: true },
  });
}

export async function bootstrapAdmin(
  input: { name: string; email: string; passwordHash: string },
  client: TransactionRunner = prisma
) {
  return client.$transaction((tx) => createFirstAdmin(tx, input), {
    maxWait: 10_000,
    timeout: 20_000,
  });
}
