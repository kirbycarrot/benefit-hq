"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COVERAGE_TYPES,
  RATE_PERIOD_LABELS,
  RATE_PERIODS,
  TIER_LABELS,
  TIERS,
  addCurrencyAmounts,
} from "@/lib/validation";

type PolicyLine = {
  id: string;
  coverageType: string;
  planName: string;
  tier: string;
  employeeCost: string;
  employerCost: string;
  totalPremium: string;
  ratePeriod: string;
};

const inputClass =
  "h-11 rounded-[10px] border border-input-border bg-white px-3 text-[13px] focus:border-teal-deep focus:outline-none";
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
  const [ratePeriod, setRatePeriod] = useState(
    initialPolicyLines[0]?.ratePeriod ?? RATE_PERIODS[0]
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingRatePeriod, setSavingRatePeriod] = useState(false);

  async function handleRatePeriodChange(nextRatePeriod: string) {
    const previousRatePeriod = ratePeriod;
    setRatePeriod(nextRatePeriod);
    setError(null);

    if (initialPolicyLines.length === 0) return;

    setSavingRatePeriod(true);
    const res = await fetch(`/api/plan-years/${planYearId}/policy-lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratePeriod: nextRatePeriod }),
    });
    setSavingRatePeriod(false);

    if (!res.ok) {
      const data = await res.json();
      setRatePeriod(previousRatePeriod);
      setError(data.error ?? "Unable to update the rate period");
      return;
    }

    router.refresh();
  }

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
        ratePeriod,
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
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/policy-lines/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {initialPolicyLines.length > 0 && (
        <div className="mb-3.5 overflow-x-auto rounded-[14px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-panel-tint">
                <th className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap text-text-600">
                  Coverage
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap text-text-600">
                  Plan
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap text-text-600">
                  Tier
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold whitespace-nowrap text-text-600">
                  Employee cost
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold whitespace-nowrap text-text-600">
                  Employer cost
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold whitespace-nowrap text-text-600">
                  Total premium
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold whitespace-nowrap text-text-600">
                  Rate period
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {initialPolicyLines.map((line) => (
                <tr key={line.id} className="border-t border-border-lighter">
                  <td className="px-5 py-3 text-text-900">{line.coverageType}</td>
                  <td className="px-5 py-3 text-text-900">{line.planName}</td>
                  <td className="px-5 py-3 text-text-900">
                    {TIER_LABELS[line.tier as keyof typeof TIER_LABELS] ?? line.tier}
                  </td>
                  <td className="px-5 py-3 text-right text-text-900">
                    ${line.employeeCost}
                  </td>
                  <td className="px-5 py-3 text-right text-text-900">
                    ${line.employerCost}
                  </td>
                  <td className="px-5 py-3 text-right text-text-900">
                    ${line.totalPremium}
                  </td>
                  <td className="px-5 py-3 text-text-900">
                    {RATE_PERIOD_LABELS[line.ratePeriod as keyof typeof RATE_PERIOD_LABELS] ??
                      line.ratePeriod}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(line.id)}
                      className="text-xs font-semibold text-destructive hover:text-red-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-[14px] rounded-[14px] border border-dashed border-input-border p-4 sm:p-5"
      >
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Coverage</label>
          <select
            value={coverageType}
            onChange={(e) => setCoverageType(e.target.value)}
            className={`${inputClass} w-full sm:w-[140px]`}
          >
            {COVERAGE_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Plan name</label>
          <input
            type="text"
            required
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className={`${inputClass} w-full sm:w-[180px]`}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className={`${inputClass} w-full sm:w-[170px]`}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Employee cost</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={employeeCost}
            onChange={(e) => setEmployeeCost(e.target.value)}
            className={`${inputClass} w-full sm:w-[130px]`}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Employer cost</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={employerCost}
            onChange={(e) => setEmployerCost(e.target.value)}
            className={`${inputClass} w-full sm:w-[130px]`}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>Total premium</label>
          <input
            type="text"
            readOnly
            aria-label="Calculated total premium"
            value={
              employeeCost !== "" && employerCost !== ""
                ? addCurrencyAmounts(Number(employeeCost), Number(employerCost)).toFixed(2)
                : ""
            }
            className={`${inputClass} w-full sm:w-[130px]`}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className={labelClass}>
            Rate period
            {savingRatePeriod && (
              <span className="ml-2 font-normal text-text-400">Saving...</span>
            )}
          </label>
          <select
            value={ratePeriod}
            onChange={(e) => void handleRatePeriodChange(e.target.value)}
            disabled={savingRatePeriod}
            className={`${inputClass} w-full sm:w-[150px]`}
          >
            {RATE_PERIODS.map((period) => (
              <option key={period} value={period}>
                {RATE_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || savingRatePeriod}
          className="h-11 w-full rounded-full bg-ink-900 px-5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-black disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Adding..." : "Add line"}
        </button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
