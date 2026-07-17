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
      <div className="flex items-center gap-4">
        {client.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logoPath}
            alt={`${client.name} logo`}
            className="h-14 w-14 rounded border border-gray-200 object-contain p-1"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded text-lg font-semibold text-white"
            style={{ backgroundColor: client.primaryColor }}
          >
            {client.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-semibold text-gray-900">{client.name}</h1>
      </div>

      <div className="mt-6 max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-700">Client details</h2>
        <div className="mt-4">
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
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Plan years</h2>
          <NewPlanYearForm clientId={client.id} />
        </div>

        {client.planYears.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No plan years yet. Create one to enter policy details and upload a census.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
            {client.planYears.map((planYear) => (
              <li key={planYear.id}>
                <Link
                  href={`/clients/${client.id}/plan-years/${planYear.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {planYear.label}
                  </span>
                  <span className="text-sm text-gray-500">
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
