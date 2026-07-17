ALTER TABLE "Client"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");
