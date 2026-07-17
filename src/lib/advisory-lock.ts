import type { Prisma } from "@/generated/prisma/client";

/**
 * Serialize work for a logical resource until the surrounding transaction ends.
 *
 * PostgreSQL's pg_advisory_xact_lock function returns the unsupported `void`
 * type. Projecting a supported integer from a subquery lets Prisma consume the
 * result while PostgreSQL still evaluates the volatile lock function.
 */
export async function acquireAdvisoryTransactionLock(
  tx: Prisma.TransactionClient,
  resourceKey: string
) {
  await tx.$queryRaw<Array<{ acquired: number }>>`
    SELECT 1 AS acquired
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${resourceKey}, 0))
    ) AS locked
  `;
}
