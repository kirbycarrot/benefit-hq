"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientFormProps = {
  mode: "create" | "edit";
  clientId?: string;
  initial?: {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    logoPath: string | null;
  };
};

export function ClientForm({ mode, clientId, initial }: ClientFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial?.primaryColor ?? "#1F2937");
  const [secondaryColor, setSecondaryColor] = useState(
    initial?.secondaryColor ?? "#14B8A6"
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logoPath ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("primaryColor", primaryColor);
    formData.set("secondaryColor", secondaryColor);
    if (logoFile) formData.set("logo", logoFile);

    const url = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, { method, body: formData });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();
    router.push(`/clients/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-600">
          Company name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[10px] border border-input-border px-3 py-2.5 text-[13px] focus:border-teal-deep focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-600">Logo</label>
        <div className="flex items-center gap-4">
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-16 w-16 rounded-[10px] border border-border-light object-contain p-1"
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            className="text-[13px] text-text-600"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text-600">
            Primary color
          </label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-8 w-11 rounded-[8px] border border-input-border"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-text-600">
            Secondary color
          </label>
          <input
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-8 w-11 rounded-[8px] border border-input-border"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-ink-900 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {loading ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
      </button>
    </form>
  );
}
