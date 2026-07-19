"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ClientDangerZone({
  clientId,
  clientName,
  isArchived,
}: {
  clientId: string;
  clientName: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [pendingAction, setPendingAction] = useState<"archive" | "restore" | "delete" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function setArchived(archived: boolean) {
    setError(null);
    setPendingAction(archived ? "archive" : "restore");
    const response = await fetch(`/api/clients/${clientId}/archive`, {
      method: archived ? "POST" : "DELETE",
    });
    setPendingAction(null);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    if (archived) router.push("/clients");
    else router.refresh();
  }

  async function deleteClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingAction("delete");
    const response = await fetch(`/api/clients/${clientId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationName }),
    });
    setPendingAction(null);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    dialogRef.current?.close();
    router.push("/clients");
    router.refresh();
  }

  function openDeleteDialog() {
    setConfirmationName("");
    setError(null);
    dialogRef.current?.showModal();
  }

  return (
    <div className="mt-8 border-t border-border-lighter pt-6">
      <h3 className="text-[13px] font-bold text-text-900">Danger zone</h3>
      <p className="mt-1 max-w-[420px] text-xs leading-5 text-text-600">
        {isArchived
          ? "Restore this client to manage it again, or permanently delete all of its data."
          : "Archive this client to remove it from the active list without deleting its history."}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {isArchived ? (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => setArchived(false)}
            className="rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300 disabled:opacity-50"
          >
            {pendingAction === "restore" ? "Restoring..." : "Restore client"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => setArchived(true)}
            className="rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300 disabled:opacity-50"
          >
            {pendingAction === "archive" ? "Archiving..." : "Archive client"}
          </button>
        )}
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={openDeleteDialog}
          className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-destructive hover:border-red-400 disabled:opacity-50"
        >
          Delete client permanently...
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <dialog
        ref={dialogRef}
        className="w-[calc(100%_-_2rem)] max-w-[520px] rounded-[16px] border border-border-light bg-white p-0 shadow-2xl backdrop:bg-black/40"
        onClose={() => {
          setConfirmationName("");
          setError(null);
        }}
      >
        <form onSubmit={deleteClient} className="p-5 sm:p-7">
          <h2 className="text-xl font-extrabold text-text-900">Delete {clientName}?</h2>
          <p className="mt-3 text-sm leading-6 text-text-600">
            This permanently deletes the client, onboarding profile, contacts,
            documents, all plan years, census data, policy details, chart settings,
            and generated decks. This action cannot be undone.
          </p>
          <label className="mt-5 block text-xs font-semibold text-text-900">
            Type <span className="font-bold">{clientName}</span> to confirm
          </label>
          <input
            type="text"
            autoComplete="off"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            className="mt-2 h-11 w-full rounded-[10px] border border-input-border px-3 text-sm focus:border-destructive focus:outline-none"
          />

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pendingAction === "delete"}
              onClick={() => dialogRef.current?.close()}
              className="w-full rounded-full border border-input-border px-4 py-2.5 text-[13px] font-semibold text-text-900 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmationName.trim() !== clientName.trim() || pendingAction === "delete"}
              className="w-full rounded-full bg-destructive px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-40 sm:w-auto"
            >
              {pendingAction === "delete" ? "Deleting..." : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
