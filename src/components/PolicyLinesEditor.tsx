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
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  Coverage
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Plan</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Employee cost
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Employer cost
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  Total premium
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialPolicyLines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2 text-gray-900">{line.coverageType}</td>
                  <td className="px-4 py-2 text-gray-900">{line.planName}</td>
                  <td className="px-4 py-2 text-gray-900">{line.tier}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    ${line.employeeCost}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    ${line.employerCost}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    ${line.totalPremium}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(line.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
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
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-gray-300 p-4"
      >
        <div>
          <label className="block text-xs font-medium text-gray-700">Coverage</label>
          <select
            value={coverageType}
            onChange={(e) => setCoverageType(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            {COVERAGE_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Plan name</label>
          <input
            type="text"
            required
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Employee cost
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={employeeCost}
            onChange={(e) => setEmployeeCost(e.target.value)}
            className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Employer cost
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={employerCost}
            onChange={(e) => setEmployerCost(e.target.value)}
            className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Total premium
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={totalPremium}
            onChange={(e) => setTotalPremium(e.target.value)}
            className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add line"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
