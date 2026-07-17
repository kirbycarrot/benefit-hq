"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPlanYearForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/clients/${clientId}/plan-years`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, effectiveDate }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();
    router.push(`/clients/${clientId}/plan-years/${data.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-ink-900 px-[18px] py-2.5 text-[13px] font-semibold text-white hover:bg-black"
      >
        New plan year
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
      <div className="w-full sm:w-auto">
        <label className="mb-1.5 block text-xs font-semibold text-text-600">Label</label>
        <input
          type="text"
          required
          placeholder="2026 Plan Year"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-[10px] border border-input-border px-3 py-2.5 text-[13px] focus:border-teal-deep focus:outline-none sm:w-auto"
        />
      </div>
      <div className="w-full sm:w-auto">
        <label className="mb-1.5 block text-xs font-semibold text-text-600">
          Effective date
        </label>
        <input
          type="date"
          required
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          className="w-full rounded-[10px] border border-input-border px-3 py-2.5 text-[13px] focus:border-teal-deep focus:outline-none sm:w-auto"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-ink-900 px-[18px] py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50 sm:w-auto"
      >
        {loading ? "Creating..." : "Create"}
      </button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
