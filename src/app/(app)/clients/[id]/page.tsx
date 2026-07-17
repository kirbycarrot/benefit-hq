import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ClientForm } from "@/components/ClientForm";
import { ClientDangerZone } from "@/components/ClientDangerZone";
import { NewPlanYearForm } from "@/components/NewPlanYearForm";
import { formatDate } from "@/lib/date";

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
      include: { planYears: { orderBy: { effectiveDate: "desc" } } },
    }),
  ]);
  if (!client) notFound();
  const isAdmin = session?.user?.isAdmin ?? false;
  if (client.archivedAt && !isAdmin) notFound();

  return (
    <div>
      <Link href="/clients" className="text-[13px] text-text-600 hover:text-text-900">
        &larr; Clients
      </Link>

      <div className="mt-3.5 mb-7 flex items-center gap-4">
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
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-extrabold text-text-900">{client.name}</h1>
            {client.archivedAt && (
              <span className="rounded-full bg-amber/10 px-2.5 py-1 text-[11px] font-bold text-amber">
                Archived
              </span>
            )}
          </div>
        </div>
      </div>

      {client.archivedAt ? (
        <div className="mb-8 max-w-[520px] rounded-[14px] border border-border-light bg-white p-7 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
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
      ) : (
        <details className="group mb-8 max-w-[480px]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Edit client details</span>
            <span className="hidden group-open:inline">Hide client details</span>
          </summary>
          <div className="mt-3 rounded-[14px] border border-border-light bg-white p-7 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
            <ClientForm
              mode="edit"
              clientId={client.id}
              initial={{
                name: client.name,
                primaryColor: client.primaryColor,
                secondaryColor: client.secondaryColor,
                logoPath: client.logoPath,
              }}
            />
            {isAdmin && (
              <ClientDangerZone
                clientId={client.id}
                clientName={client.name}
                isArchived={false}
              />
            )}
          </div>
        </details>
      )}

      {!client.archivedAt && (
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-text-900">Plan years</h2>
            <NewPlanYearForm clientId={client.id} />
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
                    className="flex items-center justify-between px-5 py-4 hover:bg-panel-tint"
                  >
                    <span className="text-sm font-semibold text-text-900">
                      {planYear.label}
                    </span>
                    <span className="text-[13px] text-text-600">
                      {formatDate(planYear.effectiveDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
