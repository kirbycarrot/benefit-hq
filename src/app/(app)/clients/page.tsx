import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ClientSummary = {
  id: string;
  name: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export default async function ClientsPage() {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [clients, archivedClients] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? prisma.client.findMany({
          where: { archivedAt: { not: null } },
          orderBy: { archivedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-extrabold text-text-900">Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-full bg-ink-900 px-5 py-3 text-[13px] font-semibold text-white hover:bg-black"
        >
          New client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-text-600">
          No active clients yet. Create one to get started.
        </p>
      ) : (
        <ClientGrid clients={clients} />
      )}

      {archivedClients.length > 0 && (
        <details className="group mt-10 max-w-[960px]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-text-600 hover:text-text-900 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show archived clients</span>
            <span className="hidden group-open:inline">Hide archived clients</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-text-600">
              {archivedClients.length}
            </span>
          </summary>
          <div className="opacity-75">
            <ClientGrid clients={archivedClients} />
          </div>
        </details>
      )}
    </div>
  );
}

function ClientGrid({ clients }: { clients: ClientSummary[] }) {
  return (
    <ul className="mt-8 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => (
        <li key={client.id}>
          <Link
            href={`/clients/${client.id}`}
            className="flex items-center gap-3.5 rounded-[14px] border border-border-light bg-white p-5 shadow-[0_1px_2px_rgba(20,24,26,0.04)] hover:border-text-300"
          >
            {client.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logoPath}
                alt={`${client.name} logo`}
                className="h-12 w-12 shrink-0 rounded-[11px] object-contain"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] text-base font-bold text-white"
                style={{ backgroundColor: client.primaryColor }}
              >
                {client.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-900">{client.name}</p>
              <div className="mt-1.5 flex gap-1.5">
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: client.primaryColor }}
                />
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: client.secondaryColor }}
                />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
