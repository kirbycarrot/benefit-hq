"use client";

import { useState } from "react";
import { readApiError } from "@/lib/api-response";

export function DeckGenerator({ planYearId }: { planYearId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setDeckId(null);

    try {
      const response = await fetch(`/api/plan-years/${planYearId}/decks`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(await readApiError(response, "Unable to generate the deck"));
        return;
      }

      const data = await response.json();
      setDeckId(data.id);
    } catch {
      setError("Unable to generate the deck. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-[26px]">
      <h2 className="mb-1 text-[17px] font-bold text-text-900">Generate deck</h2>
      <p className="mb-[18px] text-[13px] text-text-600">
        Builds a branded PowerPoint from the selections above.
      </p>
      <button
        onClick={() => void handleGenerate()}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-[22px] py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-wait disabled:opacity-50"
      >
        {loading && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-30"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        {loading ? "Generating..." : "Generate deck"}
      </button>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {deckId && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 flex flex-col gap-4 rounded-[12px] border border-success/20 bg-success/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="m6.5 12.5 3.5 3.5 7.5-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-900">Your deck is ready</p>
              <p className="mt-0.5 text-xs text-text-600">
                The PowerPoint was generated successfully.
              </p>
            </div>
          </div>
          <a
            href={`/api/decks/${deckId}/download`}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black sm:w-auto"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PowerPoint
          </a>
        </div>
      )}
    </div>
  );
}
