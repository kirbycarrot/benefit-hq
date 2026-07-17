import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CHART_DEFINITIONS } from "../src/lib/charts/catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const chart of CHART_DEFINITIONS) {
    await prisma.chartDefinition.upsert({
      where: { key: chart.key },
      update: chart,
      create: chart,
    });
  }
  console.log(`Seeded ${CHART_DEFINITIONS.length} chart definitions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
