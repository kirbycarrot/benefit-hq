import { prisma } from "@/lib/prisma";
import { ClientsListView, type ClientSummary } from "@/components/ClientsListView";
import { formatRecurringDate } from "@/lib/client-onboarding";
import { policyProgramsFromRecords, policyReadinessIssues } from "@/lib/policy-details";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      profile: {
        select: { primaryIndustry: true, primaryRenewalMonth: true, primaryRenewalDay: true },
      },
      _count: { select: { planYears: true } },
      planYears: {
        orderBy: { effectiveDate: "desc" },
        take: 1,
        include: {
          _count: { select: { employees: true } },
          benefitPrograms: {
            include: {
              plans: { include: { rates: true, aliases: true } },
            },
          },
        },
      },
    },
  });

  const summaries: ClientSummary[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    logoPath: client.logoPath,
    primaryColor: client.primaryColor,
    secondaryColor: client.secondaryColor,
    industry: client.profile?.primaryIndustry ?? null,
    renewalLabel: formatRecurringDate(
      client.profile?.primaryRenewalMonth ?? null,
      client.profile?.primaryRenewalDay ?? null
    ),
    planYearCount: client._count.planYears,
    status: clientStatus(client.planYears[0]),
  }));

  return <ClientsListView clients={summaries} />;
}

function clientStatus(
  latestPlanYear:
    | {
        _count: { employees: number };
        benefitPrograms: Parameters<typeof policyProgramsFromRecords>[0];
      }
    | undefined
): ClientSummary["status"] {
  if (!latestPlanYear) return { label: "No plan year", tone: "neutral" };
  if (latestPlanYear._count.employees === 0) {
    return { label: "Needs census", tone: "neutral" };
  }
  const issues = policyReadinessIssues(policyProgramsFromRecords(latestPlanYear.benefitPrograms));
  if (issues.length > 0) {
    return { label: `${issues.length} item(s) need attention`, tone: "warning" };
  }
  return { label: "On track", tone: "success" };
}
