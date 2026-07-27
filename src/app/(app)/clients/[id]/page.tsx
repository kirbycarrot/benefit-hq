import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ClientDangerZone } from "@/components/ClientDangerZone";
import { NewPlanYearForm } from "@/components/NewPlanYearForm";
import { formatDate } from "@/lib/date";
import {
  computeOnboardingSummary,
  formatRecurringDate,
} from "@/lib/client-onboarding";
import {
  BENEFIT_TYPES,
  policyProgramsFromRecords,
  policyReadinessIssues,
} from "@/lib/policy-details";
import { PILL_TONE_CLASS, type PillTone } from "@/lib/status-pill";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, client] = await Promise.all([
    auth(),
    prisma.client.findUnique({
      where: { id },
      include: {
        profile: true,
        planYears: {
          orderBy: { effectiveDate: "desc" },
          include: {
            _count: { select: { employees: true, decks: true } },
            benefitPrograms: {
              include: { plans: { include: { rates: true, aliases: true } } },
            },
          },
        },
        locations: { where: { isHeadquarters: true }, take: 1 },
        _count: {
          select: {
            teamAssignments: true,
            contacts: true,
            documents: true,
            priorities: true,
          },
        },
      },
    }),
  ]);
  if (!client) notFound();
  const isAdmin = session?.user?.isAdmin ?? false;
  if (client.archivedAt && !isAdmin) notFound();
  const profile = client.profile;
  const headquarters = client.locations[0];
  const progress = computeOnboardingSummary({
    displayName: client.name,
    legalName: profile?.legalName ?? null,
    primaryIndustry: profile?.primaryIndustry ?? null,
    primaryRenewalMonth: profile?.primaryRenewalMonth ?? null,
    primaryRenewalDay: profile?.primaryRenewalDay ?? null,
    headquartersComplete: Boolean(
      headquarters?.line1 && headquarters.city && headquarters.state && headquarters.postalCode
    ),
    usEmployeeCount: profile?.usEmployeeCount ?? null,
    benefitsEligibleCount: profile?.benefitsEligibleCount ?? null,
    enrolledEmployeeCount: profile?.enrolledEmployeeCount ?? null,
    teamAssignmentCount: client._count.teamAssignments,
    contactCount: client._count.contacts,
    entityStructure: profile?.entityStructure ?? null,
    benefitsConsistentAcrossEntities: profile?.benefitsConsistentAcrossEntities ?? null,
    hasUnionPopulation: profile?.hasUnionPopulation ?? null,
    workforceTypes: jsonStringArray(profile?.workforceTypes),
    coveredThroughPeo: profile?.coveredThroughPeo ?? null,
    statesWithEmployees: jsonStringArray(profile?.statesWithEmployees),
    benefitChallenges: profile?.benefitChallenges ?? null,
    renewalSuccessOutcomes: profile?.renewalSuccessOutcomes ?? null,
    disruptionTolerance: profile?.disruptionTolerance ?? null,
    priorityCount: client._count.priorities,
    documentCount: client._count.documents,
  });
  const renewalDate = formatRecurringDate(
    profile?.primaryRenewalMonth ?? null,
    profile?.primaryRenewalDay ?? null
  );

  return (
    <div>
      <Link href="/clients" className="text-[13px] text-text-600 hover:text-text-900">
        &larr; Clients
      </Link>

      <div className="mt-3.5 mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 sm:items-center">
        {client.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logoPath}
            alt={`${client.name} logo`}
            className="h-[60px] w-[60px] rounded-[14px] border border-border-light object-contain p-1"
          />
        ) : (
          <div
            className="flex h-[60px] w-[60px] items-center justify-center rounded-[14px] text-[22px] font-bold text-white"
            style={{ backgroundColor: client.primaryColor }}
          >
            {client.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 pt-1 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="break-words text-[24px] leading-tight font-extrabold text-text-900 sm:text-[26px]">
              {client.name}
            </h1>
            {client.archivedAt && (
              <span className="rounded-full bg-amber/10 px-2.5 py-1 text-[11px] font-bold text-amber">
                Archived
              </span>
            )}
          </div>
          {profile?.primaryIndustry && (
            <p className="mt-1 text-sm text-text-600">{profile.primaryIndustry}{renewalDate ? ` · ${renewalDate} renewal` : ""}</p>
          )}
        </div>
        </div>
        {!client.archivedAt && (
          <Link
            href={`/clients/${client.id}/edit`}
            className="shrink-0 rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300"
          >
            Edit client profile
          </Link>
        )}
      </div>

      {client.archivedAt ? (
        <div className="mb-8 max-w-[520px] rounded-[14px] border border-border-light bg-white p-5 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-7">
          <h2 className="text-[15px] font-bold text-text-900">Archived client</h2>
          <p className="mt-1 text-sm leading-6 text-text-600">
            This client is hidden from the active list. Restore it before managing its
            details or plan years.
          </p>
          <ClientDangerZone
            clientId={client.id}
            clientName={client.name}
            isArchived
          />
        </div>
      ) : null}

      {!client.archivedAt && (
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:items-start">
          <section>
            <div className="mb-3.5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[17px] font-bold text-text-900">Plan years</h2>
              <NewPlanYearForm
                clientId={client.id}
                currentYear={new Date().getFullYear()}
              />
            </div>

            {client.planYears.length === 0 ? (
              <p className="mt-4 text-sm text-text-600">
                No plan years yet. Create one to enter policy details and upload a census.
              </p>
            ) : (
              <ul className="space-y-3">
                {client.planYears.map((planYear) => {
                  const pills = planYearPills(planYear);
                  return (
                    <li key={planYear.id}>
                      <Link
                        href={`/clients/${client.id}/plan-years/${planYear.id}`}
                        className="block rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] hover:border-text-300 sm:p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-bold text-text-900">{planYear.label}</span>
                          <span className="shrink-0 text-right text-[13px] text-text-600">
                            Effective {formatDate(planYear.effectiveDate)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pills.map((pill) => (
                            <span
                              key={pill.label}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL_TONE_CLASS[pill.tone]}`}
                            >
                              {pill.label}
                            </span>
                          ))}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[14px] border border-border-light bg-white p-5 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-bold text-text-900">Onboarding</h2>
              <span className="text-sm font-extrabold text-text-900">{progress.percentage}%</span>
            </div>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-border-lighter">
              <div className="h-full rounded-full bg-teal-deep" style={{ width: `${progress.percentage}%` }} />
            </div>
            <nav className="mt-4 space-y-1" aria-label="Onboarding sections">
              {Object.entries(progress.sections).map(([key, section]) => (
                <Link
                  key={key}
                  href={`/clients/${client.id}/edit?section=${key}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-xs hover:bg-panel-tint"
                >
                  <span className="font-semibold text-text-900">{sectionLabel(key)}</span>
                  <span className="text-text-400">
                    {key === "documents"
                      ? `${progress.documentCount} ${progress.documentCount === 1 ? "doc" : "docs"}`
                      : `${section.completed}/${section.total}`}
                  </span>
                </Link>
              ))}
            </nav>
          </section>
        </div>
      )}
    </div>
  );
}

function planYearPills(planYear: {
  _count: { employees: number; decks: number };
  benefitPrograms: Parameters<typeof policyProgramsFromRecords>[0];
}): Array<{ label: string; tone: PillTone }> {
  const programs = policyProgramsFromRecords(planYear.benefitPrograms);
  const offeredCount = programs.filter((program) => program.offered).length;
  const issues = policyReadinessIssues(programs);

  const census: { label: string; tone: PillTone } =
    planYear._count.employees > 0
      ? { label: `Census ${planYear._count.employees} employees`, tone: "success" }
      : { label: "Census needed", tone: "neutral" };

  const policy: { label: string; tone: PillTone } =
    offeredCount === 0
      ? { label: "Policy not started", tone: "neutral" }
      : issues.length > 0
        ? { label: `Policy ${issues.length} issue${issues.length === 1 ? "" : "s"}`, tone: "warning" }
        : { label: `Policy ${offeredCount}/${BENEFIT_TYPES.length}`, tone: "success" };

  const deck: { label: string; tone: PillTone } =
    planYear._count.decks > 0
      ? { label: `${planYear._count.decks} deck(s)`, tone: "success" }
      : { label: "No deck yet", tone: "neutral" };

  return [census, policy, deck];
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sectionLabel(key: string): string {
  return {
    profile: "Company profile",
    team: "Team & contacts",
    organization: "Organization",
    goals: "Goals & constraints",
    documents: "Documents",
  }[key] ?? key;
}
