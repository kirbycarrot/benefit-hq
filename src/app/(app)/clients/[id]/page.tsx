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
        planYears: { orderBy: { effectiveDate: "desc" } },
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
        <div className="space-y-9">
          <section>
            <div className="mb-3.5 flex items-center justify-between gap-4">
              <h2 className="text-[17px] font-bold text-text-900">Client onboarding</h2>
              <span className="text-sm font-extrabold text-text-900">{progress.percentage}% complete</span>
            </div>
            <div className="rounded-[14px] border border-border-light bg-white p-5 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
              <div className="h-2 overflow-hidden rounded-full bg-border-lighter">
                <div className="h-full rounded-full bg-teal-deep" style={{ width: `${progress.percentage}%` }} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(progress.sections).map(([key, section]) => (
                  <div key={key} className="rounded-[10px] bg-panel-tint px-3 py-3">
                    <p className="text-xs font-semibold capitalize text-text-900">{sectionLabel(key)}</p>
                    <p className="mt-1 text-[11px] text-text-400">
                      {key === "documents"
                        ? `${progress.documentCount} ${progress.documentCount === 1 ? "document" : "documents"}`
                        : `${section.completed} of ${section.total} complete`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

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
            <ul className="max-w-[640px] divide-y divide-border-lighter rounded-[14px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
              {client.planYears.map((planYear) => (
                <li key={planYear.id}>
                  <Link
                    href={`/clients/${client.id}/plan-years/${planYear.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-panel-tint sm:px-5"
                  >
                    <span className="text-sm font-semibold text-text-900">
                      {planYear.label}
                    </span>
                    <span className="shrink-0 text-right text-[13px] text-text-600">
                      {formatDate(planYear.effectiveDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </section>
        </div>
      )}
    </div>
  );
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
