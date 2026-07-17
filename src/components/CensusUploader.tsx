"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadSummary = {
  employeeCount: number;
  dependentCount: number;
  electionCount: number;
  matchedAncillaryCount: number;
  unmatchedAncillaryCount: number;
};

export function CensusUploader({ planYearId }: { planYearId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setWarnings([]);
    setSummary(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/plan-years/${planYearId}/census`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      if (data.warnings) setWarnings(data.warnings);
      return;
    }

    setSummary(data.summary);
    setWarnings(data.warnings ?? []);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Census workbook (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 text-sm text-gray-600"
          />
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Upload & normalize"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Employees" value={summary.employeeCount} />
          <Stat label="Dependents" value={summary.dependentCount} />
          <Stat label="Elections" value={summary.electionCount} />
          <Stat label="Ancillary matched" value={summary.matchedAncillaryCount} />
          <Stat label="Ancillary unmatched" value={summary.unmatchedAncillaryCount} />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-700">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
