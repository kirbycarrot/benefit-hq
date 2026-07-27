"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NewClientModal } from "./NewClientModal";
import { PILL_TONE_CLASS, type PillTone } from "@/lib/status-pill";

export type ClientSummary = {
  id: string;
  name: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  industry: string | null;
  renewalLabel: string | null;
  planYearCount: number;
  status: { label: string; tone: PillTone };
};

export function ClientsListView({ clients }: { clients: ClientSummary[] }) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(needle) ||
        (client.industry?.toLowerCase().includes(needle) ?? false)
    );
  }, [clients, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-extrabold text-text-900">Clients</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-full bg-ink-900 px-5 py-3 text-[13px] font-semibold text-white hover:bg-black"
        >
          + New client
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search clients by name or industry..."
        className="mt-5 h-11 w-full max-w-[420px] rounded-[10px] border border-input-border bg-white px-3.5 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none"
      />

      {clients.length === 0 ? (
        <p className="mt-6 text-sm text-text-600">
          No active clients yet. Create one to get started.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-text-600">No clients match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="block rounded-[14px] border border-border-light bg-white p-[18px] shadow-[0_1px_2px_rgba(20,24,26,0.04)] hover:border-text-300"
              >
                <div className="flex items-center gap-3.5">
                  {client.logoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={client.logoPath}
                      alt={`${client.name} logo`}
                      className="h-11 w-11 shrink-0 rounded-[11px] object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] text-base font-bold text-white"
                      style={{ backgroundColor: client.primaryColor }}
                    >
                      {client.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text-900">{client.name}</p>
                    <p className="mt-0.5 truncate text-xs text-text-400">
                      {[client.industry, client.renewalLabel ? `${client.renewalLabel} renewal` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-lighter pt-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL_TONE_CLASS[client.status.tone]}`}
                  >
                    {client.status.label}
                  </span>
                  <span className="shrink-0 text-xs text-text-400">
                    {client.planYearCount} plan year{client.planYearCount === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <NewClientModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
