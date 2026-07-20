import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ClientManagement } from "@/components/ClientManagement";
import { prisma } from "@/lib/prisma";

export default async function ClientManagementPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      planYears: {
        orderBy: { effectiveDate: "desc" },
        select: {
          id: true,
          label: true,
          effectiveDate: true,
          _count: {
            select: {
              employees: true,
              benefitPrograms: true,
              decks: true,
              documents: true,
            },
          },
        },
      },
    },
  });

  return (
    <ClientManagement
      clients={clients.map((client) => ({
        id: client.id,
        name: client.name,
        archived: Boolean(client.archivedAt),
        planYears: client.planYears.map((planYear) => ({
          id: planYear.id,
          label: planYear.label,
          effectiveDate: planYear.effectiveDate.toISOString(),
          employeeCount: planYear._count.employees,
          programCount: planYear._count.benefitPrograms,
          deckCount: planYear._count.decks,
          documentCount: planYear._count.documents,
        })),
      }))}
    />
  );
}
