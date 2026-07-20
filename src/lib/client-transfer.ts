import { z } from "zod";
import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, readStoredFile, saveFile, saveLogo, storedLogoPathFromUrl } from "@/lib/storage";
import { detectLogoType } from "@/lib/uploads";
import { CLIENT_DOCUMENT_CATEGORIES } from "@/lib/client-onboarding";

export const CLIENT_EXPORT_FORMAT = "benefithq.client-export";
export const CLIENT_EXPORT_VERSION = 1;
export const CLIENT_EXPORT_EXTENSION = ".benefithq";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function decimalToString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toString();
}

const decimalString = z.union([z.string(), z.number()]).transform((value) => String(value));
const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const jsonValue = z.any() as z.ZodType<Prisma.InputJsonValue>;

// ---------------------------------------------------------------------------
// Export payload schema (also used to validate an uploaded import file)
// ---------------------------------------------------------------------------

const profileExportSchema = z.object({
  legalName: z.string().min(1),
  website: z.string().nullable(),
  primaryIndustry: z.string().nullable(),
  secondaryIndustry: z.string().nullable(),
  industryCode: z.string().nullable(),
  ownershipType: z.string().nullable(),
  parentCompany: z.string().nullable(),
  privateEquitySponsor: z.string().nullable(),
  fiscalYearEndMonth: z.number().int().nullable(),
  fiscalYearEndDay: z.number().int().nullable(),
  primaryRenewalMonth: z.number().int().nullable(),
  primaryRenewalDay: z.number().int().nullable(),
  usEmployeeCount: z.number().int().nullable(),
  globalEmployeeCount: z.number().int().nullable(),
  benefitsEligibleCount: z.number().int().nullable(),
  enrolledEmployeeCount: z.number().int().nullable(),
  entityStructure: z.string().nullable(),
  numberOfEins: z.number().int().nullable(),
  benefitsConsistentAcrossEntities: z.boolean().nullable(),
  hasUnionPopulation: z.boolean().nullable(),
  hasCollectivelyBargainedPlans: z.boolean().nullable(),
  hasAcquiredCompanies: z.boolean().nullable(),
  hasInternationalEmployees: z.boolean().nullable(),
  workforceTypes: z.array(z.string()),
  coveredThroughPeo: z.boolean().nullable(),
  statesWithEmployees: z.array(z.string()),
  remoteEmployeePercentage: decimalString.nullable(),
  benefitChallenges: z.string().nullable(),
  renewalSuccessOutcomes: z.string().nullable(),
  budgetTarget: decimalString.nullable(),
  maximumAcceptableIncrease: decimalString.nullable(),
  disruptionTolerance: z.string().nullable(),
  excludedCarriers: z.array(z.string()),
  acquisitionsExpected: z.boolean().nullable(),
  headcountChangesExpected: z.boolean().nullable(),
  harmonizationUnderway: z.boolean().nullable(),
  preparingForTransaction: z.boolean().nullable(),
});

const teamAssignmentExportSchema = z.object({
  role: z.string().min(1),
  userEmail: z.string().min(1),
});

const contactExportSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  roles: z.array(z.string()),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
});

const locationExportSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  isHeadquarters: z.boolean(),
  employeeCount: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

const entityExportSchema = z.object({
  legalName: z.string().min(1),
  taxIdLastFour: z.string().nullable(),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
});

const priorityExportSchema = z.object({
  objective: z.string().min(1),
  rank: z.number().int(),
  currentState: z.string().nullable(),
  desiredOutcome: z.string().nullable(),
  measurementKpi: z.string().nullable(),
  notes: z.string().nullable(),
});

const documentExportSchema = z.object({
  category: z.enum(CLIENT_DOCUMENT_CATEGORIES),
  originalFilename: z.string().min(1),
  mediaType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  uploadedAt: isoDateString,
  uploadedByEmail: z.string().nullable(),
  planYearLabel: z.string().nullable(),
  fileContentBase64: z.string().min(1),
});

const policyLineExportSchema = z.object({
  coverageType: z.string().min(1),
  planName: z.string().min(1),
  tier: z.string().min(1),
  employeeCost: decimalString,
  employerCost: decimalString,
  totalPremium: decimalString,
  ratePeriod: z.string().min(1),
  sortOrder: z.number().int(),
});

const planRateExportSchema = z.object({
  tier: z.string().min(1),
  grossPremium: decimalString,
  employeeContribution: decimalString,
  employerContribution: decimalString,
  ratePeriod: z.string().min(1),
  enrollmentOverride: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

const planAliasExportSchema = z.object({
  alias: z.string().min(1),
  normalizedAlias: z.string().min(1),
});

const benefitPlanExportSchema = z.object({
  exportId: z.string().min(1),
  name: z.string().min(1),
  subtype: z.string().min(1),
  offered: z.boolean(),
  details: jsonValue,
  detailSchemaVersion: z.number().int(),
  renewedFromExportId: z.string().nullable(),
  sortOrder: z.number().int(),
  rates: z.array(planRateExportSchema),
  aliases: z.array(planAliasExportSchema),
});

const benefitProgramExportSchema = z.object({
  benefitType: z.string().min(1),
  offered: z.boolean(),
  sortOrder: z.number().int(),
  plans: z.array(benefitPlanExportSchema),
});

const censusUploadExportSchema = z.object({
  filenames: jsonValue,
  status: z.string().min(1),
  warnings: jsonValue,
  summary: jsonValue.nullable(),
  uploadedAt: isoDateString,
});

const dependentExportSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: isoDateString.nullable(),
  gender: z.string().nullable(),
  relationshipType: z.string().nullable(),
});

const benefitElectionExportSchema = z.object({
  benefitType: z.string().min(1),
  planName: z.string().nullable(),
  optionName: z.string().nullable(),
  volume: decimalString.nullable(),
});

const employeeExportSchema = z.object({
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: isoDateString.nullable(),
  gender: z.string().nullable(),
  hireDate: isoDateString.nullable(),
  employmentStatus: z.string().nullable(),
  baseSalary: decimalString.nullable(),
  postalCode: z.string().nullable(),
  dependents: z.array(dependentExportSchema),
  elections: z.array(benefitElectionExportSchema),
});

const deckConfigExportSchema = z.object({
  selections: jsonValue,
});

const benchmarkProfileExportSchema = z.object({
  datasetProvider: z.string().min(1),
  datasetSurveyYear: z.number().int(),
  datasetVersion: z.string().min(1),
  cohortCode: z.string().min(1),
  trendRate: decimalString.nullable(),
});

const planYearExportSchema = z.object({
  label: z.string().min(1),
  effectiveDate: isoDateString,
  policyLines: z.array(policyLineExportSchema),
  benefitPrograms: z.array(benefitProgramExportSchema),
  censusUploads: z.array(censusUploadExportSchema),
  employees: z.array(employeeExportSchema),
  deckConfig: deckConfigExportSchema.nullable(),
  benchmarkProfile: benchmarkProfileExportSchema.nullable(),
});

const clientExportPayloadSchema = z.object({
  format: z.literal(CLIENT_EXPORT_FORMAT),
  version: z.literal(CLIENT_EXPORT_VERSION),
  exportedAt: isoDateString,
  client: z.object({
    name: z.string().min(1),
    primaryColor: z.string().min(1),
    secondaryColor: z.string().min(1),
    logo: z
      .object({
        extension: z.enum(["png", "jpg", "webp"]),
        fileContentBase64: z.string().min(1),
      })
      .nullable(),
    profile: profileExportSchema.nullable(),
    teamAssignments: z.array(teamAssignmentExportSchema),
    contacts: z.array(contactExportSchema),
    locations: z.array(locationExportSchema),
    entities: z.array(entityExportSchema),
    priorities: z.array(priorityExportSchema),
    documents: z.array(documentExportSchema),
    planYears: z.array(planYearExportSchema),
  }),
});

export type ClientExportPayload = z.infer<typeof clientExportPayloadSchema>;

export function parseClientExportPayload(data: unknown): ClientExportPayload {
  return clientExportPayloadSchema.parse(data);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function buildClientExportPayload(clientId: string): Promise<ClientExportPayload> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      profile: true,
      teamAssignments: { include: { user: { select: { email: true } } } },
      contacts: { orderBy: { sortOrder: "asc" } },
      locations: { orderBy: { sortOrder: "asc" } },
      entities: { orderBy: { sortOrder: "asc" } },
      priorities: { orderBy: { rank: "asc" } },
      documents: {
        include: {
          uploadedBy: { select: { email: true } },
          planYear: { select: { label: true } },
        },
      },
      planYears: {
        orderBy: { effectiveDate: "asc" },
        include: {
          policyLines: { orderBy: { sortOrder: "asc" } },
          benefitPrograms: {
            orderBy: { sortOrder: "asc" },
            include: {
              plans: {
                orderBy: { sortOrder: "asc" },
                include: { rates: { orderBy: { sortOrder: "asc" } }, aliases: true },
              },
            },
          },
          censusUploads: { orderBy: { uploadedAt: "asc" } },
          employees: { include: { dependents: true, elections: true } },
          deckConfig: true,
          benchmarkProfile: {
            include: {
              dataset: { select: { provider: true, surveyYear: true, version: true } },
              primaryCohort: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!client) throw new Error("CLIENT_NOT_FOUND");

  // Every BenefitPlan across the whole client gets a stable export id so that
  // renewedFromPlan relationships (which can point at a plan in a different
  // plan year) can be reconstructed on import.
  const planExportIds = new Map<string, string>();
  for (const planYear of client.planYears) {
    for (const program of planYear.benefitPrograms) {
      for (const plan of program.plans) {
        planExportIds.set(plan.id, randomUUID());
      }
    }
  }

  let logo: ClientExportPayload["client"]["logo"] = null;
  if (client.logoPath) {
    const relativePath = storedLogoPathFromUrl(client.logoPath);
    if (relativePath) {
      const buffer = await readStoredFile(relativePath);
      const detected = detectLogoType(buffer);
      if (detected) {
        logo = { extension: detected.extension, fileContentBase64: buffer.toString("base64") };
      }
    }
  }

  const documents = await Promise.all(
    client.documents.map(async (document) => {
      const buffer = await readStoredFile(document.filePath);
      return {
        category: document.category as (typeof CLIENT_DOCUMENT_CATEGORIES)[number],
        originalFilename: document.originalFilename,
        mediaType: document.mediaType,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt.toISOString(),
        uploadedByEmail: document.uploadedBy?.email ?? null,
        planYearLabel: document.planYear?.label ?? null,
        fileContentBase64: buffer.toString("base64"),
      };
    })
  );

  return {
    format: CLIENT_EXPORT_FORMAT,
    version: CLIENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    client: {
      name: client.name,
      primaryColor: client.primaryColor,
      secondaryColor: client.secondaryColor,
      logo,
      profile: client.profile
        ? {
            legalName: client.profile.legalName,
            website: client.profile.website,
            primaryIndustry: client.profile.primaryIndustry,
            secondaryIndustry: client.profile.secondaryIndustry,
            industryCode: client.profile.industryCode,
            ownershipType: client.profile.ownershipType,
            parentCompany: client.profile.parentCompany,
            privateEquitySponsor: client.profile.privateEquitySponsor,
            fiscalYearEndMonth: client.profile.fiscalYearEndMonth,
            fiscalYearEndDay: client.profile.fiscalYearEndDay,
            primaryRenewalMonth: client.profile.primaryRenewalMonth,
            primaryRenewalDay: client.profile.primaryRenewalDay,
            usEmployeeCount: client.profile.usEmployeeCount,
            globalEmployeeCount: client.profile.globalEmployeeCount,
            benefitsEligibleCount: client.profile.benefitsEligibleCount,
            enrolledEmployeeCount: client.profile.enrolledEmployeeCount,
            entityStructure: client.profile.entityStructure,
            numberOfEins: client.profile.numberOfEins,
            benefitsConsistentAcrossEntities: client.profile.benefitsConsistentAcrossEntities,
            hasUnionPopulation: client.profile.hasUnionPopulation,
            hasCollectivelyBargainedPlans: client.profile.hasCollectivelyBargainedPlans,
            hasAcquiredCompanies: client.profile.hasAcquiredCompanies,
            hasInternationalEmployees: client.profile.hasInternationalEmployees,
            workforceTypes: client.profile.workforceTypes as string[],
            coveredThroughPeo: client.profile.coveredThroughPeo,
            statesWithEmployees: client.profile.statesWithEmployees as string[],
            remoteEmployeePercentage: decimalToString(client.profile.remoteEmployeePercentage),
            benefitChallenges: client.profile.benefitChallenges,
            renewalSuccessOutcomes: client.profile.renewalSuccessOutcomes,
            budgetTarget: decimalToString(client.profile.budgetTarget),
            maximumAcceptableIncrease: decimalToString(client.profile.maximumAcceptableIncrease),
            disruptionTolerance: client.profile.disruptionTolerance,
            excludedCarriers: client.profile.excludedCarriers as string[],
            acquisitionsExpected: client.profile.acquisitionsExpected,
            headcountChangesExpected: client.profile.headcountChangesExpected,
            harmonizationUnderway: client.profile.harmonizationUnderway,
            preparingForTransaction: client.profile.preparingForTransaction,
          }
        : null,
      teamAssignments: client.teamAssignments.map((assignment) => ({
        role: assignment.role,
        userEmail: assignment.user.email,
      })),
      contacts: client.contacts.map((contact) => ({
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        roles: contact.roles as string[],
        notes: contact.notes,
        sortOrder: contact.sortOrder,
      })),
      locations: client.locations.map((location) => ({
        name: location.name,
        line1: location.line1,
        line2: location.line2,
        city: location.city,
        state: location.state,
        postalCode: location.postalCode,
        country: location.country,
        isHeadquarters: location.isHeadquarters,
        employeeCount: location.employeeCount,
        sortOrder: location.sortOrder,
      })),
      entities: client.entities.map((entity) => ({
        legalName: entity.legalName,
        taxIdLastFour: entity.taxIdLastFour,
        notes: entity.notes,
        sortOrder: entity.sortOrder,
      })),
      priorities: client.priorities.map((priority) => ({
        objective: priority.objective,
        rank: priority.rank,
        currentState: priority.currentState,
        desiredOutcome: priority.desiredOutcome,
        measurementKpi: priority.measurementKpi,
        notes: priority.notes,
      })),
      documents,
      planYears: client.planYears.map((planYear) => ({
        label: planYear.label,
        effectiveDate: planYear.effectiveDate.toISOString(),
        policyLines: planYear.policyLines.map((line) => ({
          coverageType: line.coverageType,
          planName: line.planName,
          tier: line.tier,
          employeeCost: decimalToString(line.employeeCost) as string,
          employerCost: decimalToString(line.employerCost) as string,
          totalPremium: decimalToString(line.totalPremium) as string,
          ratePeriod: line.ratePeriod,
          sortOrder: line.sortOrder,
        })),
        benefitPrograms: planYear.benefitPrograms.map((program) => ({
          benefitType: program.benefitType,
          offered: program.offered,
          sortOrder: program.sortOrder,
          plans: program.plans.map((plan) => ({
            exportId: planExportIds.get(plan.id)!,
            name: plan.name,
            subtype: plan.subtype,
            offered: plan.offered,
            details: plan.details as Prisma.InputJsonValue,
            detailSchemaVersion: plan.detailSchemaVersion,
            renewedFromExportId: plan.renewedFromPlanId
              ? (planExportIds.get(plan.renewedFromPlanId) ?? null)
              : null,
            sortOrder: plan.sortOrder,
            rates: plan.rates.map((rate) => ({
              tier: rate.tier,
              grossPremium: decimalToString(rate.grossPremium) as string,
              employeeContribution: decimalToString(rate.employeeContribution) as string,
              employerContribution: decimalToString(rate.employerContribution) as string,
              ratePeriod: rate.ratePeriod,
              enrollmentOverride: rate.enrollmentOverride,
              sortOrder: rate.sortOrder,
            })),
            aliases: plan.aliases.map((alias) => ({
              alias: alias.alias,
              normalizedAlias: alias.normalizedAlias,
            })),
          })),
        })),
        censusUploads: planYear.censusUploads.map((upload) => ({
          filenames: upload.filenames as Prisma.InputJsonValue,
          status: upload.status,
          warnings: upload.warnings as Prisma.InputJsonValue,
          summary: (upload.summary as Prisma.InputJsonValue | null) ?? null,
          uploadedAt: upload.uploadedAt.toISOString(),
        })),
        employees: planYear.employees.map((employee) => ({
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          birthDate: employee.birthDate?.toISOString() ?? null,
          gender: employee.gender,
          hireDate: employee.hireDate?.toISOString() ?? null,
          employmentStatus: employee.employmentStatus,
          baseSalary: decimalToString(employee.baseSalary),
          postalCode: employee.postalCode,
          dependents: employee.dependents.map((dependent) => ({
            firstName: dependent.firstName,
            lastName: dependent.lastName,
            birthDate: dependent.birthDate?.toISOString() ?? null,
            gender: dependent.gender,
            relationshipType: dependent.relationshipType,
          })),
          elections: employee.elections.map((election) => ({
            benefitType: election.benefitType,
            planName: election.planName,
            optionName: election.optionName,
            volume: decimalToString(election.volume),
          })),
        })),
        deckConfig: planYear.deckConfig ? { selections: planYear.deckConfig.selections as Prisma.InputJsonValue } : null,
        benchmarkProfile: planYear.benchmarkProfile
          ? {
              datasetProvider: planYear.benchmarkProfile.dataset.provider,
              datasetSurveyYear: planYear.benchmarkProfile.dataset.surveyYear,
              datasetVersion: planYear.benchmarkProfile.dataset.version,
              cohortCode: planYear.benchmarkProfile.primaryCohort.code,
              trendRate: decimalToString(planYear.benchmarkProfile.trendRate),
            }
          : null,
      })),
    },
  };
}

export function clientExportFilename(clientName: string): string {
  const slug =
    clientName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client";
  return `${slug}${CLIENT_EXPORT_EXTENSION}`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ClientImportResult = {
  clientId: string;
  warnings: string[];
};

export async function importClientExportPayload(
  payload: ClientExportPayload,
  options: { createdById: string }
): Promise<ClientImportResult> {
  const warnings: string[] = [];
  const data = payload.client;

  // File writes happen outside the transaction (Prisma transactions only
  // guard the database, not the filesystem) so we can clean them up by hand
  // if the transaction later fails.
  let logoPath: string | undefined;
  if (data.logo) {
    const buffer = Buffer.from(data.logo.fileContentBase64, "base64");
    const detected = detectLogoType(buffer);
    if (detected) {
      logoPath = await saveLogo(detected.extension, buffer);
    } else {
      warnings.push("The client logo could not be restored (unrecognized image format).");
    }
  }

  const savedDocuments = await Promise.all(
    data.documents.map(async (document) => ({
      ...document,
      filePath: await saveFile("documents", document.originalFilename, Buffer.from(document.fileContentBase64, "base64")),
    }))
  );

  try {
    const clientId = await importClientRecords(data, savedDocuments, logoPath, options.createdById, warnings);
    return { clientId, warnings };
  } catch (error) {
    await Promise.allSettled([
      ...(logoPath && storedLogoPathFromUrl(logoPath) ? [deleteStoredFile(storedLogoPathFromUrl(logoPath)!)] : []),
      ...savedDocuments.map((document) => deleteStoredFile(document.filePath)),
    ]);
    throw error;
  }
}

async function importClientRecords(
  data: ClientExportPayload["client"],
  savedDocuments: (ClientExportPayload["client"]["documents"][number] & { filePath: string })[],
  logoPath: string | undefined,
  createdById: string,
  warnings: string[]
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: data.name,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        logoPath,
        createdById,
      },
    });

    if (data.profile) {
      await tx.clientProfile.create({
        data: {
          clientId: client.id,
          legalName: data.profile.legalName,
          website: data.profile.website,
          primaryIndustry: data.profile.primaryIndustry,
          secondaryIndustry: data.profile.secondaryIndustry,
          industryCode: data.profile.industryCode,
          ownershipType: data.profile.ownershipType,
          parentCompany: data.profile.parentCompany,
          privateEquitySponsor: data.profile.privateEquitySponsor,
          fiscalYearEndMonth: data.profile.fiscalYearEndMonth,
          fiscalYearEndDay: data.profile.fiscalYearEndDay,
          primaryRenewalMonth: data.profile.primaryRenewalMonth,
          primaryRenewalDay: data.profile.primaryRenewalDay,
          usEmployeeCount: data.profile.usEmployeeCount,
          globalEmployeeCount: data.profile.globalEmployeeCount,
          benefitsEligibleCount: data.profile.benefitsEligibleCount,
          enrolledEmployeeCount: data.profile.enrolledEmployeeCount,
          entityStructure: data.profile.entityStructure,
          numberOfEins: data.profile.numberOfEins,
          benefitsConsistentAcrossEntities: data.profile.benefitsConsistentAcrossEntities,
          hasUnionPopulation: data.profile.hasUnionPopulation,
          hasCollectivelyBargainedPlans: data.profile.hasCollectivelyBargainedPlans,
          hasAcquiredCompanies: data.profile.hasAcquiredCompanies,
          hasInternationalEmployees: data.profile.hasInternationalEmployees,
          workforceTypes: data.profile.workforceTypes as Prisma.InputJsonValue,
          coveredThroughPeo: data.profile.coveredThroughPeo,
          statesWithEmployees: data.profile.statesWithEmployees as Prisma.InputJsonValue,
          remoteEmployeePercentage: data.profile.remoteEmployeePercentage,
          benefitChallenges: data.profile.benefitChallenges,
          renewalSuccessOutcomes: data.profile.renewalSuccessOutcomes,
          budgetTarget: data.profile.budgetTarget,
          maximumAcceptableIncrease: data.profile.maximumAcceptableIncrease,
          disruptionTolerance: data.profile.disruptionTolerance,
          excludedCarriers: data.profile.excludedCarriers as Prisma.InputJsonValue,
          acquisitionsExpected: data.profile.acquisitionsExpected,
          headcountChangesExpected: data.profile.headcountChangesExpected,
          harmonizationUnderway: data.profile.harmonizationUnderway,
          preparingForTransaction: data.profile.preparingForTransaction,
        },
      });
    }

    if (data.teamAssignments.length > 0) {
      const emails = Array.from(new Set(data.teamAssignments.map((a) => a.userEmail)));
      const users = await tx.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
      const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));
      const toCreate = data.teamAssignments.flatMap((assignment) => {
        const userId = userIdByEmail.get(assignment.userEmail);
        if (!userId) {
          warnings.push(`Team role "${assignment.role}" was skipped: no user with email ${assignment.userEmail} exists here.`);
          return [];
        }
        return [{ clientId: client.id, role: assignment.role, userId }];
      });
      if (toCreate.length > 0) {
        await tx.clientTeamAssignment.createMany({ data: toCreate });
      }
    }

    if (data.contacts.length > 0) {
      await tx.clientContact.createMany({
        data: data.contacts.map((contact) => ({ clientId: client.id, ...contact, roles: contact.roles as Prisma.InputJsonValue })),
      });
    }

    if (data.locations.length > 0) {
      await tx.clientLocation.createMany({
        data: data.locations.map((location) => ({ clientId: client.id, ...location })),
      });
    }

    if (data.entities.length > 0) {
      await tx.clientEntity.createMany({
        data: data.entities.map((entity) => ({ clientId: client.id, ...entity })),
      });
    }

    if (data.priorities.length > 0) {
      await tx.clientPriority.createMany({
        data: data.priorities.map((priority) => ({ clientId: client.id, ...priority })),
      });
    }

    // Plan years must exist before documents (planYearId) and before the
    // benefit-plan renewal-chain fixups below.
    const planYearIdByLabel = new Map<string, string>();
    for (const planYear of data.planYears) {
      const created = await tx.planYear.create({
        data: {
          clientId: client.id,
          label: planYear.label,
          effectiveDate: new Date(planYear.effectiveDate),
        },
      });
      planYearIdByLabel.set(planYear.label, created.id);

      if (planYear.policyLines.length > 0) {
        await tx.policyLine.createMany({
          data: planYear.policyLines.map((line) => ({ planYearId: created.id, ...line })),
        });
      }

      const planExportIdToNewId = new Map<string, string>();
      const pendingRenewalLinks: { newPlanId: string; renewedFromExportId: string }[] = [];

      for (const program of planYear.benefitPrograms) {
        const createdProgram = await tx.benefitProgram.create({
          data: {
            planYearId: created.id,
            benefitType: program.benefitType,
            offered: program.offered,
            sortOrder: program.sortOrder,
          },
        });

        for (const plan of program.plans) {
          const createdPlan = await tx.benefitPlan.create({
            data: {
              benefitProgramId: createdProgram.id,
              name: plan.name,
              subtype: plan.subtype,
              offered: plan.offered,
              details: plan.details,
              detailSchemaVersion: plan.detailSchemaVersion,
              sortOrder: plan.sortOrder,
            },
          });
          planExportIdToNewId.set(plan.exportId, createdPlan.id);
          if (plan.renewedFromExportId) {
            pendingRenewalLinks.push({ newPlanId: createdPlan.id, renewedFromExportId: plan.renewedFromExportId });
          }

          if (plan.rates.length > 0) {
            await tx.planRate.createMany({
              data: plan.rates.map((rate) => ({ benefitPlanId: createdPlan.id, ...rate })),
            });
          }
          if (plan.aliases.length > 0) {
            await tx.planAlias.createMany({
              data: plan.aliases.map((alias) => ({ benefitPlanId: createdPlan.id, ...alias })),
            });
          }
        }
      }

      for (const link of pendingRenewalLinks) {
        const renewedFromPlanId = planExportIdToNewId.get(link.renewedFromExportId);
        if (renewedFromPlanId) {
          await tx.benefitPlan.update({
            where: { id: link.newPlanId },
            data: { renewedFromPlanId },
          });
        } else {
          warnings.push("A benefit plan's renewal history could not be fully reconstructed.");
        }
      }

      if (planYear.censusUploads.length > 0) {
        await tx.censusUpload.createMany({
          data: planYear.censusUploads.map((upload) => ({
            planYearId: created.id,
            filenames: upload.filenames,
            status: upload.status,
            warnings: upload.warnings,
            summary: upload.summary ?? undefined,
            uploadedAt: new Date(upload.uploadedAt),
          })),
        });
      }

      for (const employee of planYear.employees) {
        await tx.employee.create({
          data: {
            planYearId: created.id,
            employeeNumber: employee.employeeNumber,
            firstName: employee.firstName,
            lastName: employee.lastName,
            birthDate: employee.birthDate ? new Date(employee.birthDate) : null,
            gender: employee.gender,
            hireDate: employee.hireDate ? new Date(employee.hireDate) : null,
            employmentStatus: employee.employmentStatus,
            baseSalary: employee.baseSalary,
            postalCode: employee.postalCode,
            dependents: {
              create: employee.dependents.map((dependent) => ({
                firstName: dependent.firstName,
                lastName: dependent.lastName,
                birthDate: dependent.birthDate ? new Date(dependent.birthDate) : null,
                gender: dependent.gender,
                relationshipType: dependent.relationshipType,
              })),
            },
            elections: {
              create: employee.elections.map((election) => ({
                benefitType: election.benefitType,
                planName: election.planName,
                optionName: election.optionName,
                volume: election.volume,
              })),
            },
          },
        });
      }

      if (planYear.deckConfig) {
        await tx.deckConfig.create({
          data: { planYearId: created.id, selections: planYear.deckConfig.selections },
        });
      }

      if (planYear.benchmarkProfile) {
        const dataset = await tx.benchmarkDataset.findUnique({
          where: {
            provider_surveyYear_version: {
              provider: planYear.benchmarkProfile.datasetProvider,
              surveyYear: planYear.benchmarkProfile.datasetSurveyYear,
              version: planYear.benchmarkProfile.datasetVersion,
            },
          },
        });
        const cohort = dataset
          ? await tx.benchmarkCohort.findUnique({
              where: { datasetId_code: { datasetId: dataset.id, code: planYear.benchmarkProfile.cohortCode } },
            })
          : null;
        if (dataset && cohort) {
          await tx.planYearBenchmarkProfile.create({
            data: {
              planYearId: created.id,
              datasetId: dataset.id,
              primaryCohortId: cohort.id,
              trendRate: planYear.benchmarkProfile.trendRate,
            },
          });
        } else {
          warnings.push(
            `Benchmark selection for plan year "${planYear.label}" was skipped: the referenced benchmark dataset is not available here.`
          );
        }
      }
    }

    if (savedDocuments.length > 0) {
      const uploaderEmails = Array.from(
        new Set(savedDocuments.flatMap((document) => (document.uploadedByEmail ? [document.uploadedByEmail] : [])))
      );
      const uploaders = uploaderEmails.length
        ? await tx.user.findMany({ where: { email: { in: uploaderEmails } }, select: { id: true, email: true } })
        : [];
      const uploaderIdByEmail = new Map(uploaders.map((u) => [u.email, u.id]));
      const unresolvedUploaderEmails = new Set<string>();

      for (const document of savedDocuments) {
        const uploadedById = document.uploadedByEmail ? (uploaderIdByEmail.get(document.uploadedByEmail) ?? null) : null;
        if (document.uploadedByEmail && !uploadedById) {
          unresolvedUploaderEmails.add(document.uploadedByEmail);
        }

        await tx.clientDocument.create({
          data: {
            clientId: client.id,
            planYearId: document.planYearLabel ? (planYearIdByLabel.get(document.planYearLabel) ?? null) : null,
            category: document.category,
            originalFilename: document.originalFilename,
            filePath: document.filePath,
            mediaType: document.mediaType,
            sizeBytes: document.sizeBytes,
            uploadedById,
            uploadedAt: new Date(document.uploadedAt),
          },
        });
      }

      for (const email of unresolvedUploaderEmails) {
        warnings.push(`Document uploader information for ${email} was dropped: no user with that email exists here.`);
      }
    }

    return client.id;
  });
}
