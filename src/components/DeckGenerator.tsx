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
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Generate deck</h2>
      <p className="mt-1 text-sm text-gray-500">
        Builds a branded PowerPoint from the selections above.
      </p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate deck"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {deckId && (
        <p className="mt-3 text-sm text-green-700">
          Deck ready.{" "}
          <a
            href={`/api/decks/${deckId}/download`}
            className="font-medium underline hover:no-underline"
          >
            Download PowerPoint
          </a>
        </p>
      )}
    </div>
  );
}
