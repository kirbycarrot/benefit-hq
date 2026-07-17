"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COVERAGE_TYPES, TIERS } from "@/lib/validation";

type PolicyLine = {
  id: string;
  coverageType: string;
  planName: string;
  tier: string;
  employeeCost: string;
  employerCost: string;
  totalPremium: string;
};

const inputClass =
  "w-full rounded-[10px] border border-input-border bg-white px-3 py-2.5 text-sm focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";

export function PolicyLinesEditor({
  planYearId,
  initialPolicyLines,
}: {
  planYearId: string;
  initialPolicyLines: PolicyLine[];
}) {
  const router = useRouter();
  const [coverageType, setCoverageType] = useState<string>(COVERAGE_TYPES[0]);
  const [planName, setPlanName] = useState("");
  const [tier, setTier] = useState<string>(TIERS[0]);
  const [employeeCost, setEmployeeCost] = useState("");
  const [employerCost, setEmployerCost] = useState("");
  const [totalPremium, setTotalPremium] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/plan-years/${planYearId}/policy-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coverageType,
        planName,
        tier,
        employeeCost,
        employerCost,
        totalPremium,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    setPlanName("");
    setEmployeeCost("");
    setEmployerCost("");
    setTotalPremium("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/policy-lines/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {initialPolicyLines.length > 0 && (
        <div className="mb-5 space-y-2.5">
          {initialPolicyLines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded-xl border border-border-light px-[18px] py-4"
            >
              <div>
                <div className="text-sm font-bold text-text-900">
                  {line.planName}
                  <span className="ml-2 rounded-full bg-panel-tint px-2 py-0.5 text-[11px] font-semibold text-text-600">
                    {line.tier}
                  </span>
                </div>
                <div className="mt-0.5 text-[13px] text-text-600">
                  {line.coverageType} &middot; Employee ${line.employeeCost} / Employer $
                  {line.employerCost} / Total ${line.totalPremium}
                </div>
              </div>
              <button
                onClick={() => handleDelete(line.id)}
                className="text-xs font-semibold text-destructive hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="rounded-xl bg-panel-tint p-5"
      >
        <div className="mb-3.5 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Coverage</label>
            <select
              value={coverageType}
              onChange={(e) => setCoverageType(e.target.value)}
              className={inputClass}
            >
              {COVERAGE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plan name</label>
            <input
              type="text"
              required
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className={inputClass}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Employee cost</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={employeeCost}
              onChange={(e) => setEmployeeCost(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Employer cost</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={employerCost}
              onChange={(e) => setEmployerCost(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Total premium</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={totalPremium}
              onChange={(e) => setTotalPremium(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink-900 py-3.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add plan"}
        </button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
