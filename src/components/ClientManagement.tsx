"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readApiError, readJsonResponse } from "@/lib/api-response";

type ManagedPlanYear = {
  id: string;
  label: string;
  effectiveDate: string;
  employeeCount: number;
  programCount: number;
  deckCount: number;
  documentCount: number;
};

type ManagedClient = {
  id: string;
  name: string;
  archived: boolean;
  planYears: ManagedPlanYear[];
};

type DeleteTarget =
  | { kind: "client"; id: string; label: string }
  | { kind: "planYear"; id: string; label: string; clientName: string };

type ImportResponse = {
  error?: string;
  id?: string;
  warnings?: string[];
};

export function ClientManagement({ clients }: { clients: ManagedClient[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleClients = normalizedQuery
    ? clients.filter(
        (client) =>
          client.name.toLowerCase().includes(normalizedQuery) ||
          client.planYears.some((planYear) => planYear.label.toLowerCase().includes(normalizedQuery))
      )
    : clients;

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setWarnings([]);
    setNotice(null);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/clients/import", { method: "POST", body: formData });
      const data = await readJsonResponse<ImportResponse>(response);

      if (!response.ok) {
        setImportError(data?.error ?? "Unable to import this client");
        return;
      }

      setNotice("Client imported successfully.");
      setWarnings(data?.warnings ?? []);
      router.refresh();
    } catch {
      setImportError("Unable to import this client. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function openDeleteDialog(nextTarget: DeleteTarget) {
    setTarget(nextTarget);
    setConfirmation("");
    setError(null);
    dialogRef.current?.showModal();
  }

  async function deleteTarget(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;

    setDeleting(true);
    setError(null);
    const isClient = target.kind === "client";
    const response = await fetch(
      isClient ? `/api/clients/${target.id}` : `/api/plan-years/${target.id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isClient ? { confirmationName: confirmation } : { confirmationLabel: confirmation }
        ),
      }
    );
    setDeleting(false);

    if (!response.ok) {
      setError(await readApiError(response, "Unable to delete this record"));
      return;
    }

    dialogRef.current?.close();
    setTarget(null);
    setNotice(
      isClient
        ? `${target.label} was permanently deleted.`
        : `${target.clientName} — ${target.label} was permanently deleted.`
    );
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[19px] font-extrabold text-text-900">Client management</h2>
          <p className="mt-1 max-w-[760px] text-sm leading-6 text-text-600">
            Review every client and plan year from one administrative workspace. Permanent deletion removes all related data and stored files.
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={importInputRef}
            type="file"
            accept=".benefithq"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import client"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="block w-full sm:max-w-[420px]">
          <span className="sr-only">Search clients and plan years</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients or plan years"
            className="h-11 w-full rounded-[10px] border border-input-border bg-white px-3.5 text-sm focus:border-teal-deep focus:outline-none"
          />
        </label>
        <p className="text-xs text-text-400">
          {clients.length} client{clients.length === 1 ? "" : "s"} · {clients.reduce((total, client) => total + client.planYears.length, 0)} plan years
        </p>
      </div>

      {importError && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
          <span>{importError}</span>
          <button type="button" onClick={() => setImportError(null)} className="shrink-0 text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-4 rounded-[12px] border border-border-light bg-panel-tint px-4 py-3 text-sm text-text-600">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs font-semibold text-link hover:text-link-hover">
            Dismiss
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-[12px] border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-text-600">
          <p className="font-semibold text-amber">Imported with warnings</p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[13px]">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {visibleClients.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-input-border px-5 py-8 text-center text-sm text-text-600">
          No clients or plan years match that search.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visibleClients.map((client) => (
            <article key={client.id} className="overflow-hidden rounded-[14px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
              <div className="flex flex-col gap-4 border-b border-border-lighter px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold text-text-900">{client.name}</h3>
                    {client.archived && (
                      <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-bold text-amber">Archived</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-400">
                    {client.planYears.length} plan year{client.planYears.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/clients/${client.id}`} className="rounded-full border border-input-border px-3.5 py-2 text-xs font-semibold text-text-900 hover:border-text-300">
                    View client
                  </Link>
                  <a
                    href={`/api/clients/${client.id}/export`}
                    className="rounded-full border border-input-border px-3.5 py-2 text-xs font-semibold text-text-900 hover:border-text-300"
                  >
                    Export client
                  </a>
                  <button type="button" onClick={() => openDeleteDialog({ kind: "client", id: client.id, label: client.name })} className="rounded-full border border-red-200 px-3.5 py-2 text-xs font-semibold text-destructive hover:border-red-400">
                    Delete client
                  </button>
                </div>
              </div>

              {client.planYears.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-400">No plan years.</p>
              ) : (
                <ul className="divide-y divide-border-lighter">
                  {client.planYears.map((planYear) => (
                    <li key={planYear.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <Link href={`/clients/${client.id}/plan-years/${planYear.id}`} className="text-sm font-semibold text-link hover:text-link-hover">
                            {planYear.label}
                          </Link>
                          <span className="text-xs text-text-400">Effective {new Date(planYear.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-text-400">
                          {planYear.employeeCount} employees · {planYear.programCount} benefit programs · {planYear.documentCount} documents · {planYear.deckCount} decks
                        </p>
                      </div>
                      <button type="button" onClick={() => openDeleteDialog({ kind: "planYear", id: planYear.id, label: planYear.label, clientName: client.name })} className="self-start rounded-full border border-red-200 px-3.5 py-2 text-xs font-semibold text-destructive hover:border-red-400 sm:self-auto">
                        Delete plan year
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[540px] rounded-[16px] border border-border-light bg-white p-0 shadow-2xl backdrop:bg-black/40"
        onClose={() => {
          setTarget(null);
          setConfirmation("");
          setError(null);
        }}
      >
        {target && (
          <form onSubmit={deleteTarget} className="p-5 sm:p-7">
            <h2 className="text-xl font-extrabold text-text-900">
              Delete {target.kind === "client" ? target.label : `${target.clientName} — ${target.label}`}?
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-600">
              {target.kind === "client"
                ? "This permanently deletes the client, onboarding profile, documents, every plan year, census, policy details, chart settings, and generated decks."
                : "This permanently deletes this plan year, including its census, policy details, benchmark override, documents, chart settings, and generated decks. The client and its other plan years remain available."}
              {" "}This action cannot be undone.
            </p>
            <label className="mt-5 block text-xs font-semibold text-text-900">
              Type <span className="font-bold">{target.label}</span> to confirm
            </label>
            <input
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 h-11 w-full rounded-[10px] border border-input-border px-3 text-sm focus:border-destructive focus:outline-none"
            />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={deleting} onClick={() => dialogRef.current?.close()} className="w-full rounded-full border border-input-border px-4 py-2.5 text-[13px] font-semibold text-text-900 disabled:opacity-50 sm:w-auto">
                Cancel
              </button>
              <button type="submit" disabled={confirmation.trim() !== target.label.trim() || deleting} className="w-full rounded-full bg-destructive px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-40 sm:w-auto">
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
