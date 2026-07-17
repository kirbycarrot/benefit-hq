import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New client
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No clients yet. Create one to get started.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300"
              >
                {client.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.logoPath}
                    alt={`${client.name} logo`}
                    className="h-12 w-12 rounded object-contain"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded text-sm font-semibold text-white"
                    style={{ backgroundColor: client.primaryColor }}
                  >
                    {client.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {client.name}
                  </p>
                  <div className="mt-1 flex gap-1">
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
      )}
    </div>
  );
}
