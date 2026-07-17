"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/api-response";

type UploadSummary = {
  employeeCount: number;
  dependentCount: number;
  electionCount: number;
  matchedAncillaryCount: number;
  unmatchedAncillaryCount: number;
};

type UploadResponse = {
  error?: string;
  warnings?: string[];
  summary?: UploadSummary;
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

    try {
      const res = await fetch(`/api/plan-years/${planYearId}/census`, {
        method: "POST",
        body: formData,
      });
      const data = await readJsonResponse<UploadResponse>(res);

      if (!res.ok) {
        setError(data?.error ?? "Unable to upload the census");
        if (data?.warnings) setWarnings(data.warnings);
        return;
      }

      if (!data?.summary) {
        setError("The census was processed, but the server returned an unexpected response");
        return;
      }

      setSummary(data.summary);
      setWarnings(data.warnings ?? []);
      router.refresh();
    } catch {
      setError("Unable to upload the census. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[26px]"
    >
      <div className="mb-[22px] flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-auto">
          <label className="mb-1.5 block text-xs font-semibold text-text-900">
            Census workbook (.xlsx)
          </label>
          <label className="flex min-h-11 w-full cursor-pointer items-center rounded-[10px] border border-dashed border-text-300 px-4 py-2.5 text-[13px] text-text-400 sm:w-auto">
            <span className="min-w-0 break-all">
              {file ? file.name : "Choose file — no file chosen"}
            </span>
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
          className="w-full rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-black disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Processing..." : "Upload census"}
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
