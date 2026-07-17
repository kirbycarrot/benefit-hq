"use client";

import { useState } from "react";

export function DeckGenerator({ planYearId }: { planYearId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setDeckId(null);

    const res = await fetch(`/api/plan-years/${planYearId}/decks`, { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setDeckId(data.id);
  }

  return (
    <div className="rounded-[14px] border border-border-light bg-white p-[26px] shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
      <h2 className="mb-1 text-[17px] font-bold text-text-900">Generate deck</h2>
      <p className="mb-[18px] text-[13px] text-text-600">
        Builds a branded PowerPoint from the selections above.
      </p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-full bg-ink-900 px-[22px] py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate deck"}
      </button>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {deckId && (
        <p className="mt-4 text-[13px] text-success">
          Deck ready.{" "}
          <a
            href={`/api/decks/${deckId}/download`}
            className="font-semibold text-success underline hover:no-underline"
          >
            Download PowerPoint
          </a>
        </p>
      )}
    </div>
  );
}
