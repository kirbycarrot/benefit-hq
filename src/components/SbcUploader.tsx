"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/api-response";
import { SBC_FIELD_LABELS, type SbcExtractedFields } from "@/lib/sbc/parse";

type UploadResponse = {
  error?: string;
  originalFilename?: string;
  extractedFields?: SbcExtractedFields;
};

export function SbcUploader({ planYearId }: { planYearId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; fields: SbcExtractedFields } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const res = await fetch(`/api/plan-years/${planYearId}/sbc`, {
        method: "POST",
        body: formData,
      });
      const data = await readJsonResponse<UploadResponse>(res);

      if (!res.ok || !data?.extractedFields) {
        setError(data?.error ?? "Unable to read this SBC");
        return;
      }

      setResult({ filename: data.originalFilename ?? file.name, fields: data.extractedFields });
      setFile(null);
      router.refresh();
    } catch {
      setError("Unable to upload the SBC. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const foundFields = result
    ? (Object.keys(SBC_FIELD_LABELS) as (keyof typeof SBC_FIELD_LABELS)[]).filter(
        (key) => result.fields[key] !== null
      )
    : [];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[26px]"
    >
      <div className="mb-[22px] flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-auto">
          <label className="mb-1.5 block text-xs font-semibold text-text-900">
            Summary of Benefits and Coverage (.pdf)
          </label>
          <label className="flex min-h-11 w-full cursor-pointer items-center rounded-[10px] border border-dashed border-text-300 px-4 py-2.5 text-[13px] text-text-400 sm:w-auto">
            <span className="min-w-0 break-all">
              {file ? file.name : "Choose file — no file chosen"}
            </span>
            <input
              type="file"
              accept=".pdf"
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
          {loading ? "Reading..." : "Upload SBC"}
        </button>
      </div>

      <p className="text-xs text-text-400">
        Fields are extracted with a text heuristic and may need correction — review before
        creating a plan from them below.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mt-4 rounded-[12px] border border-border-lighter bg-panel-tint p-4">
          <p className="text-sm font-bold text-text-900">
            Read {foundFields.length} field{foundFields.length === 1 ? "" : "s"} from {result.filename}
          </p>
          {foundFields.length > 0 ? (
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] text-text-600 sm:grid-cols-2">
              {foundFields.map((key) => (
                <li key={key}>
                  <span className="text-text-400">{SBC_FIELD_LABELS[key]}:</span>{" "}
                  <span className="font-semibold text-text-900">
                    {key === "memberCoinsurance" ? `${result.fields[key]}%` : `$${result.fields[key]}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-text-600">
              No standard fields were recognized in this PDF. It may use non-standard wording, or be a
              scanned image rather than text.
            </p>
          )}
          <p className="mt-3 text-[11px] text-text-400">
            Create a plan pre-filled from this SBC in the Medical, Dental, or Vision tab below.
          </p>
        </div>
      )}
    </form>
  );
}
