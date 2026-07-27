"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_OPTIONS } from "@/lib/client-onboarding";
import { readApiError } from "@/lib/api-response";

const inputClass =
  "h-11 w-full rounded-[10px] border border-input-border bg-white px-3 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1)))
);

export function NewClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [primaryIndustry, setPrimaryIndustry] = useState("");
  const [renewalMonth, setRenewalMonth] = useState("1");
  const [renewalDay, setRenewalDay] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          primaryIndustry,
          primaryRenewalMonth: Number(renewalMonth),
          primaryRenewalDay: Number(renewalDay),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response, "Unable to create client"));
        return;
      }
      const data = (await response.json()) as { id: string };
      router.push(`/clients/${data.id}`);
      router.refresh();
    } catch {
      setError("Unable to create client. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,22,19,0.5)] px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-client-modal-title"
        className="w-full max-w-[440px] rounded-2xl bg-white p-7 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="new-client-modal-title" className="text-[19px] font-extrabold text-text-900">
          New client
        </h2>
        <p className="mt-1 text-sm text-text-600">
          Start with the essentials — branding, address, and the rest of the intake can be
          filled in from the client profile afterward.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={labelClass}>Client name</label>
            <input
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Primary industry</label>
            <select
              required
              value={primaryIndustry}
              onChange={(event) => setPrimaryIndustry(event.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select industry...
              </option>
              {INDUSTRY_OPTIONS.map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Renewal date</label>
            <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
              <select
                value={renewalMonth}
                onChange={(event) => setRenewalMonth(event.target.value)}
                className={inputClass}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={renewalDay}
                onChange={(event) => setRenewalDay(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-ink-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
