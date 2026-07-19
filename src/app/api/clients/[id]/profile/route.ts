import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { acquireAdvisoryTransactionLock } from "@/lib/advisory-lock";
import { clientOnboardingSchema } from "@/lib/client-onboarding";
import { prisma } from "@/lib/prisma";
import {
  deleteLogoForUrl,
  deleteStoredFile,
  saveLogo,
  storedLogoPathFromUrl,
} from "@/lib/storage";
import { detectLogoType } from "@/lib/uploads";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json(
      { error: "Restore this client before editing its profile" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string") {
    return NextResponse.json({ error: "Client profile payload is required" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: "Invalid client profile payload" }, { status: 400 });
  }

  const parsed = clientOnboardingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid client profile" },
      { status: 400 }
    );
  }

  let logoPath: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    const logoType = detectLogoType(buffer);
    if (!logoType) {
      return NextResponse.json(
        { error: "Logo must be a valid PNG, JPEG, or WebP image" },
        { status: 400 }
      );
    }
    logoPath = await saveLogo(logoType.extension, buffer);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, clientId);

      const userIds = Array.from(new Set(parsed.data.teamAssignments.map((item) => item.userId)));
      if (userIds.length > 0) {
        const userCount = await tx.user.count({ where: { id: { in: userIds } } });
        if (userCount !== userIds.length) throw new Error("INVALID_TEAM_USER");
      }

      await tx.client.update({
        where: { id: clientId },
        data: {
          name: parsed.data.displayName,
          primaryColor: parsed.data.primaryColor,
          secondaryColor: parsed.data.secondaryColor,
          ...(logoPath ? { logoPath } : {}),
        },
      });

      const profile = parsed.data.profile;
      const profileData = {
        legalName: profile.legalName,
        website: nullIfEmpty(profile.website),
        primaryIndustry: nullIfEmpty(profile.primaryIndustry),
        secondaryIndustry: nullIfEmpty(profile.secondaryIndustry),
        industryCode: nullIfEmpty(profile.industryCode),
        ownershipType: nullIfEmpty(profile.ownershipType),
        parentCompany: nullIfEmpty(profile.parentCompany),
        privateEquitySponsor: nullIfEmpty(profile.privateEquitySponsor),
        fiscalYearEndMonth: profile.fiscalYearEndMonth,
        fiscalYearEndDay: profile.fiscalYearEndDay,
        primaryRenewalMonth: profile.primaryRenewalMonth,
        primaryRenewalDay: profile.primaryRenewalDay,
        usEmployeeCount: profile.usEmployeeCount,
        globalEmployeeCount: profile.globalEmployeeCount,
        benefitsEligibleCount: profile.benefitsEligibleCount,
        enrolledEmployeeCount: profile.enrolledEmployeeCount,
        entityStructure: nullIfEmpty(profile.entityStructure),
        numberOfEins: profile.numberOfEins,
        benefitsConsistentAcrossEntities: profile.benefitsConsistentAcrossEntities,
        hasUnionPopulation: profile.hasUnionPopulation,
        hasCollectivelyBargainedPlans:
          profile.hasUnionPopulation === false ? false : profile.hasCollectivelyBargainedPlans,
        hasAcquiredCompanies: profile.hasAcquiredCompanies,
        hasInternationalEmployees: profile.hasInternationalEmployees,
        workforceTypes: profile.workforceTypes as Prisma.InputJsonValue,
        coveredThroughPeo: profile.coveredThroughPeo,
        statesWithEmployees: Array.from(new Set(profile.statesWithEmployees)) as Prisma.InputJsonValue,
        remoteEmployeePercentage: profile.remoteEmployeePercentage,
        benefitChallenges: nullIfEmpty(profile.benefitChallenges),
        renewalSuccessOutcomes: nullIfEmpty(profile.renewalSuccessOutcomes),
        budgetTarget: profile.budgetTarget,
        maximumAcceptableIncrease: profile.maximumAcceptableIncrease,
        disruptionTolerance: nullIfEmpty(profile.disruptionTolerance),
        excludedCarriers: Array.from(new Set(profile.excludedCarriers)) as Prisma.InputJsonValue,
        acquisitionsExpected: profile.acquisitionsExpected,
        headcountChangesExpected: profile.headcountChangesExpected,
        harmonizationUnderway: profile.harmonizationUnderway,
        preparingForTransaction: profile.preparingForTransaction,
      };
      await tx.clientProfile.upsert({
        where: { clientId },
        update: profileData,
        create: { clientId, ...profileData },
      });

      await tx.clientTeamAssignment.deleteMany({ where: { clientId } });
      if (parsed.data.teamAssignments.length > 0) {
        await tx.clientTeamAssignment.createMany({
          data: parsed.data.teamAssignments.map((assignment) => ({ clientId, ...assignment })),
        });
      }

      await tx.clientContact.deleteMany({ where: { clientId } });
      if (parsed.data.contacts.length > 0) {
        await tx.clientContact.createMany({
          data: parsed.data.contacts.map((contact) => ({
            clientId,
            name: contact.name,
            title: nullIfEmpty(contact.title),
            email: nullIfEmpty(contact.email),
            phone: nullIfEmpty(contact.phone),
            roles: contact.roles,
            notes: nullIfEmpty(contact.notes),
            sortOrder: contact.sortOrder,
          })),
        });
      }

      await tx.clientLocation.deleteMany({ where: { clientId } });
      if (parsed.data.locations.length > 0) {
        await tx.clientLocation.createMany({
          data: parsed.data.locations.map((location) => ({
            clientId,
            name: location.name,
            line1: location.line1,
            line2: nullIfEmpty(location.line2),
            city: location.city,
            state: location.state,
            postalCode: location.postalCode,
            country: location.country,
            isHeadquarters: location.isHeadquarters,
            employeeCount: location.employeeCount,
            sortOrder: location.sortOrder,
          })),
        });
      }

      await tx.clientEntity.deleteMany({ where: { clientId } });
      if (parsed.data.entities.length > 0) {
        await tx.clientEntity.createMany({
          data: parsed.data.entities.map((entity) => ({
            clientId,
            legalName: entity.legalName,
            taxIdLastFour: nullIfEmpty(entity.taxIdLastFour),
            notes: nullIfEmpty(entity.notes),
            sortOrder: entity.sortOrder,
          })),
        });
      }

      await tx.clientPriority.deleteMany({ where: { clientId } });
      if (parsed.data.priorities.length > 0) {
        await tx.clientPriority.createMany({
          data: parsed.data.priorities.map((priority) => ({
            clientId,
            objective: priority.objective,
            rank: priority.rank,
            currentState: nullIfEmpty(priority.currentState),
            desiredOutcome: nullIfEmpty(priority.desiredOutcome),
            measurementKpi: nullIfEmpty(priority.measurementKpi),
            notes: nullIfEmpty(priority.notes),
          })),
        });
      }
    });
  } catch (error) {
    const storedLogo = storedLogoPathFromUrl(logoPath);
    if (storedLogo) await deleteStoredFile(storedLogo);
    if (error instanceof Error && error.message === "INVALID_TEAM_USER") {
      return NextResponse.json({ error: "One of the assigned users no longer exists" }, { status: 409 });
    }
    throw error;
  }

  if (logoPath) {
    try {
      await deleteLogoForUrl(existing.logoPath);
    } catch {
      console.error("The prior client logo could not be removed after profile save");
    }
  }
  return NextResponse.json({ id: clientId, logoPath: logoPath ?? existing.logoPath });
}

function nullIfEmpty(value: string | null): string | null {
  return value?.trim() ? value.trim() : null;
}
