import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/ClientForm";
import { NewPlanYearForm } from "@/components/NewPlanYearForm";
import { formatDate } from "@/lib/date";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { planYears: { orderBy: { effectiveDate: "desc" } } },
  });
  if (!client) notFound();

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
        <h1 className="text-[26px] font-extrabold text-text-900">{client.name}</h1>
      </div>

      <div className="mb-8 max-w-[480px] rounded-[14px] border border-border-light bg-white p-7 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
        <h2 className="mb-4 text-[13px] font-bold text-text-900">Client details</h2>
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
      </div>

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
    </div>
  );
}
