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
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-border-light bg-white p-[26px] shadow-[0_1px_2px_rgba(20,24,26,0.04)]"
    >
      <div className="mb-[22px] flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text-900">
            Census workbook (.xlsx)
          </label>
          <label className="flex cursor-pointer items-center rounded-[10px] border border-dashed border-text-300 px-4 py-2.5 text-[13px] text-text-400">
            {file ? file.name : "Choose file — no file chosen"}
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-black disabled:opacity-50"
        >
          {loading ? "Processing..." : "Upload & normalize"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Employees" value={summary.employeeCount} />
          <Stat label="Dependents" value={summary.dependentCount} />
          <Stat label="Elections" value={summary.electionCount} />
          <Stat label="Ancillary matched" value={summary.matchedAncillaryCount} />
          <Stat
            label="Ancillary unmatched"
            value={summary.unmatchedAncillaryCount}
            warn
          />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-[18px] list-inside list-disc space-y-1 text-[13px] text-amber">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-[10px] bg-panel-tint p-3.5">
      <p className={`text-xl font-extrabold ${warn ? "text-amber" : "text-text-900"}`}>
        {value}
      </p>
      <p className="text-xs text-text-600">{label}</p>
    </div>
  );
}
