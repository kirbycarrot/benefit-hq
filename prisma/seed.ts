import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CHART_DEFINITIONS } from "../src/lib/charts/catalog";
import mercer2025 from "./data/mercer-2025.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.chartDefinition.deleteMany({
    where: {
      key: {
        in: [
          "mercer-medical-cost-benchmark",
          "mercer-medical-plan-design",
          "mercer-medical-plan-prevalence",
        ],
      },
    },
  });

  for (const chart of CHART_DEFINITIONS) {
    await prisma.chartDefinition.upsert({
      where: { key: chart.key },
      update: chart,
      create: chart,
    });
  }
  console.log(`Seeded ${CHART_DEFINITIONS.length} chart definitions.`);

  await seedMercerBenchmark();
}

async function seedMercerBenchmark() {
  const { dataset, cohorts, metrics, values, warnings } = mercer2025;

  await prisma.$transaction(
    async (tx) => {
      await tx.benchmarkDataset.updateMany({
        where: { provider: dataset.provider, status: "active", id: { not: dataset.id } },
        data: { status: "retired" },
      });

      await tx.benchmarkDataset.upsert({
        where: { id: dataset.id },
        update: {
          title: dataset.title,
          surveyYear: dataset.surveyYear,
          publicationYear: dataset.publicationYear,
          version: dataset.version,
          status: dataset.status,
          sourceFilename: dataset.sourceFilename,
          sourceChecksum: dataset.sourceChecksum,
          receivedAt: new Date(dataset.receivedAt),
          notes: dataset.notes,
        },
        create: {
          id: dataset.id,
          provider: dataset.provider,
          title: dataset.title,
          surveyYear: dataset.surveyYear,
          publicationYear: dataset.publicationYear,
          version: dataset.version,
          status: dataset.status,
          sourceFilename: dataset.sourceFilename,
          sourceChecksum: dataset.sourceChecksum,
          receivedAt: new Date(dataset.receivedAt),
          notes: dataset.notes,
        },
      });

      const metricIds = new Map<string, string>();
      for (const metric of metrics) {
        const saved = await tx.benchmarkMetric.upsert({
          where: { code: metric.code },
          update: {
            category: metric.category,
            label: metric.label,
            unit: metric.unit,
            statistic: metric.statistic,
            comparisonKind: metric.comparisonKind,
            benefitType: metric.benefitType,
            planSubtype: metric.planSubtype ?? null,
            tier: metric.tier ?? null,
            clientFieldKey: metric.clientFieldKey,
            direction: metric.direction,
            sortOrder: metric.sortOrder,
          },
          create: {
            code: metric.code,
            category: metric.category,
            label: metric.label,
            unit: metric.unit,
            statistic: metric.statistic,
            comparisonKind: metric.comparisonKind,
            benefitType: metric.benefitType,
            planSubtype: metric.planSubtype ?? null,
            tier: metric.tier ?? null,
            clientFieldKey: metric.clientFieldKey,
            direction: metric.direction,
            sortOrder: metric.sortOrder,
          },
          select: { id: true },
        });
        metricIds.set(metric.code, saved.id);
      }

      const cohortIds = new Map<string, string>();
      for (const cohort of cohorts) {
        const saved = await tx.benchmarkCohort.upsert({
          where: { datasetId_code: { datasetId: dataset.id, code: cohort.code } },
          update: {
            type: cohort.type,
            label: cohort.label,
            shortLabel: cohort.shortLabel,
            sourceColumn: cohort.sourceColumn,
            participantCount: cohort.participantCount,
            sortOrder: cohort.sortOrder,
          },
          create: {
            datasetId: dataset.id,
            code: cohort.code,
            type: cohort.type,
            label: cohort.label,
            shortLabel: cohort.shortLabel,
            sourceColumn: cohort.sourceColumn,
            participantCount: cohort.participantCount,
            sortOrder: cohort.sortOrder,
          },
          select: { id: true },
        });
        cohortIds.set(cohort.code, saved.id);
      }

      await tx.benchmarkValue.deleteMany({ where: { datasetId: dataset.id } });
      await tx.benchmarkValue.createMany({
        data: values.map((value) => ({
          datasetId: dataset.id,
          cohortId: requiredMapValue(cohortIds, value.cohortCode),
          metricId: requiredMapValue(metricIds, value.metricCode),
          numericValue: value.numericValue,
          availability: value.availability,
          sourceCell: value.sourceCell,
          rawValue: value.rawValue,
        })),
      });

      await tx.benchmarkImportRun.create({
        data: {
          datasetId: dataset.id,
          status: "succeeded",
          sourceChecksum: dataset.sourceChecksum,
          metricCount: metrics.length,
          cohortCount: cohorts.length,
          valueCount: values.length,
          warningCount: warnings.length,
          warnings,
          completedAt: new Date(),
        },
      });
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  console.log(
    `Seeded ${dataset.provider} ${dataset.surveyYear}: ${metrics.length} metrics, ${cohorts.length} cohorts, ${values.length} values.`
  );
}

function requiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing seeded benchmark key: ${key}`);
  return value;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
