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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">Company name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Logo</label>
        <div className="mt-1 flex items-center gap-4">
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-16 w-16 rounded border border-gray-200 object-contain p-1"
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoChange}
            className="text-sm text-gray-600"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Primary color</label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="mt-1 h-10 w-16 rounded border border-gray-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Secondary color</label>
          <input
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="mt-1 h-10 w-16 rounded border border-gray-300"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
      </button>
    </form>
  );
}
