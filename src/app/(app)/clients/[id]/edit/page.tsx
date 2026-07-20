import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ClientDangerZone } from "@/components/ClientDangerZone";
import {
  ClientProfileEditor,
  type ClientDocumentView,
} from "@/components/ClientProfileEditor";
import {
  CLIENT_CONTACT_ROLES,
  CLIENT_PRIORITY_OPTIONS,
  INTERNAL_TEAM_ROLES,
  US_STATES,
  WORKFORCE_TYPES,
  type ClientOnboardingInput,
} from "@/lib/client-onboarding";
import { prisma } from "@/lib/prisma";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, client, users] = await Promise.all([
    auth(),
    prisma.client.findUnique({
      where: { id },
      include: {
        profile: true,
        teamAssignments: true,
        contacts: { orderBy: { sortOrder: "asc" } },
        locations: { orderBy: { sortOrder: "asc" } },
        entities: { orderBy: { sortOrder: "asc" } },
        priorities: { orderBy: { rank: "asc" } },
        planYears: { orderBy: { effectiveDate: "desc" }, select: { id: true, label: true } },
        documents: {
          orderBy: { uploadedAt: "desc" },
          include: {
            uploadedBy: { select: { name: true } },
            planYear: { select: { label: true } },
          },
        },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  if (!client || client.archivedAt) notFound();

  const profile = client.profile;
  const initial: ClientOnboardingInput = {
    displayName: client.name,
    primaryColor: client.primaryColor,
    secondaryColor: client.secondaryColor,
    profile: {
      legalName: profile?.legalName ?? client.name,
      website: profile?.website ?? null,
      primaryIndustry: profile?.primaryIndustry ?? null,
      secondaryIndustry: profile?.secondaryIndustry ?? null,
      industryCode: profile?.industryCode ?? null,
      ownershipType: profile?.ownershipType ?? null,
      parentCompany: profile?.parentCompany ?? null,
      privateEquitySponsor: profile?.privateEquitySponsor ?? null,
      fiscalYearEndMonth: profile?.fiscalYearEndMonth ?? null,
      fiscalYearEndDay: profile?.fiscalYearEndDay ?? null,
      primaryRenewalMonth: profile?.primaryRenewalMonth ?? null,
      primaryRenewalDay: profile?.primaryRenewalDay ?? null,
      usEmployeeCount: profile?.usEmployeeCount ?? null,
      globalEmployeeCount: profile?.globalEmployeeCount ?? null,
      benefitsEligibleCount: profile?.benefitsEligibleCount ?? null,
      enrolledEmployeeCount: profile?.enrolledEmployeeCount ?? null,
      entityStructure: profile?.entityStructure ?? null,
      numberOfEins: profile?.numberOfEins ?? null,
      benefitsConsistentAcrossEntities: profile?.benefitsConsistentAcrossEntities ?? null,
      benefitsConsistencyNotes: profile?.benefitsConsistencyNotes ?? null,
      hasUnionPopulation: profile?.hasUnionPopulation ?? null,
      hasCollectivelyBargainedPlans: profile?.hasCollectivelyBargainedPlans ?? null,
      hasAcquiredCompanies: profile?.hasAcquiredCompanies ?? null,
      hasInternationalEmployees: profile?.hasInternationalEmployees ?? null,
      workforceTypes: stringArray(profile?.workforceTypes, WORKFORCE_TYPES),
      coveredThroughPeo: profile?.coveredThroughPeo ?? null,
      statesWithEmployees: stringArray(
        profile?.statesWithEmployees,
        US_STATES.map(([code]) => code)
      ),
      remoteEmployeePercentage: profile?.remoteEmployeePercentage?.toNumber() ?? null,
      benefitChallenges: profile?.benefitChallenges ?? null,
      renewalSuccessOutcomes: profile?.renewalSuccessOutcomes ?? null,
      budgetTarget: profile?.budgetTarget?.toNumber() ?? null,
      maximumAcceptableIncrease: profile?.maximumAcceptableIncrease?.toNumber() ?? null,
      disruptionTolerance: profile?.disruptionTolerance ?? null,
      excludedCarriers: stringArray(profile?.excludedCarriers),
      acquisitionsExpected: profile?.acquisitionsExpected ?? null,
      headcountChangesExpected: profile?.headcountChangesExpected ?? null,
      harmonizationUnderway: profile?.harmonizationUnderway ?? null,
      preparingForTransaction: profile?.preparingForTransaction ?? null,
    },
    teamAssignments: client.teamAssignments
      .filter((assignment) => INTERNAL_TEAM_ROLES.includes(assignment.role as never))
      .map((assignment) => ({
        role: assignment.role as ClientOnboardingInput["teamAssignments"][number]["role"],
        userId: assignment.userId,
      })),
    contacts: client.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      roles: stringArray(contact.roles, CLIENT_CONTACT_ROLES),
      notes: contact.notes,
      sortOrder: contact.sortOrder,
    })),
    locations: client.locations.map((location) => ({
      id: location.id,
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
      id: entity.id,
      legalName: entity.legalName,
      taxIdLastFour: entity.taxIdLastFour,
      notes: entity.notes,
      sortOrder: entity.sortOrder,
    })),
    priorities: client.priorities
      .filter((priority) => CLIENT_PRIORITY_OPTIONS.includes(priority.objective as never))
      .map((priority) => ({
        objective: priority.objective as ClientOnboardingInput["priorities"][number]["objective"],
        rank: priority.rank,
        currentState: priority.currentState,
        desiredOutcome: priority.desiredOutcome,
        measurementKpi: priority.measurementKpi,
        notes: priority.notes,
      })),
  };
  const documents: ClientDocumentView[] = client.documents.map((document) => ({
    id: document.id,
    category: document.category,
    originalFilename: document.originalFilename,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.uploadedAt.toISOString(),
    uploadedByName: document.uploadedBy?.name ?? null,
    planYearLabel: document.planYear?.label ?? null,
  }));

  return (
    <div className="max-w-[1180px]">
      <Link href={`/clients/${client.id}`} className="text-[13px] text-text-600 hover:text-text-900">
        &larr; {client.name}
      </Link>
      <div className="mt-3 mb-7">
        <h1 className="text-[26px] font-extrabold text-text-900">Client profile &amp; onboarding</h1>
        <p className="mt-1 max-w-[760px] text-sm text-text-600">
          Complete the intake progressively. Recommended fields and documents can be added as discovery continues.
        </p>
      </div>

      <ClientProfileEditor
        clientId={client.id}
        initial={initial}
        initialLogoPath={client.logoPath}
        users={users}
        planYears={client.planYears}
        initialDocuments={documents}
      />

      {session?.user?.isAdmin && (
        <div className="mt-10 max-w-[760px] rounded-[14px] border border-border-light bg-white p-5 sm:p-7">
          <ClientDangerZone clientId={client.id} clientName={client.name} isArchived={false} />
        </div>
      )}
    </div>
  );
}

function stringArray<T extends string>(value: unknown, allowed?: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is T =>
      typeof item === "string" && (!allowed || allowed.includes(item as T))
  );
}
