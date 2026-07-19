"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRY_OPTIONS, US_STATES } from "@/lib/client-onboarding";
import { readApiError } from "@/lib/api-response";

const inputClass =
  "h-11 w-full rounded-[10px] border border-input-border bg-white px-3 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";

export function ClientForm() {
  const router = useRouter();
  const logoInputId = useId();
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#1F2937");
  const [secondaryColor, setSecondaryColor] = useState("#14B8A6");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function updateLegalName(value: string) {
    setLegalName(value);
    if (!displayNameEdited) setDisplayName(value);
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("legalName", legalName);
    formData.set("displayName", displayName);
    formData.set("primaryColor", primaryColor);
    formData.set("secondaryColor", secondaryColor);
    if (logoFile) formData.set("logo", logoFile);

    try {
      const response = await fetch("/api/clients", { method: "POST", body: formData });
      if (!response.ok) {
        setError(await readApiError(response, "Unable to create client"));
        return;
      }
      const data = (await response.json()) as { id: string };
      router.push(`/clients/${data.id}/edit?onboarding=1`);
      router.refresh();
    } catch {
      setError("Unable to create client. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <section>
        <h2 className="text-[15px] font-bold text-text-900">Company identity</h2>
        <p className="mt-1 text-xs leading-5 text-text-600">
          Start with the essentials. The rest of the intake can be completed after the client is created.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Legal company name</label>
            <input
              required
              value={legalName}
              onChange={(event) => updateLegalName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Display name</label>
            <input
              required
              value={displayName}
              onChange={(event) => {
                setDisplayNameEdited(true);
                setDisplayName(event.target.value);
              }}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-text-400">Used in navigation and client-facing reports.</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Primary industry</label>
            <select name="primaryIndustry" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select industry...</option>
              {INDUSTRY_OPTIONS.map((industry) => <option key={industry}>{industry}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="border-t border-border-lighter pt-6">
        <h2 className="text-[15px] font-bold text-text-900">Renewal and headquarters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Primary renewal month</label>
            <select name="primaryRenewalMonth" required defaultValue="1" className={inputClass}>
              {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Renewal day</label>
            <input name="primaryRenewalDay" type="number" min="1" max="31" defaultValue="1" required className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Street address</label>
            <input name="headquartersLine1" required className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Suite or unit</label>
            <input name="headquartersLine2" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input name="headquartersCity" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <select name="headquartersState" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select state...</option>
              {US_STATES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>ZIP code</label>
            <input name="headquartersPostalCode" required inputMode="numeric" className={inputClass} />
          </div>
        </div>
      </section>

      <details className="rounded-[12px] border border-border-lighter bg-panel-tint">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-text-900">
          Branding (optional)
        </summary>
        <div className="space-y-4 border-t border-border-lighter p-4">
          <div>
            <label className={labelClass}>Logo</label>
            <div className="flex flex-wrap items-center gap-3">
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-[10px] border border-border-light object-contain p-1" />
              )}
              <label htmlFor={logoInputId} className="cursor-pointer rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-900 hover:border-text-300">
                Choose logo
              </label>
              <span className="max-w-[250px] truncate text-xs text-text-600">{logoFile?.name ?? "No file selected"}</span>
              <input id={logoInputId} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="sr-only" />
            </div>
          </div>
          <div className="flex gap-8">
            <ColorInput label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
            <ColorInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} />
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={loading} className="rounded-full bg-ink-900 px-6 py-3 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50">
          {loading ? "Creating..." : "Create client and continue"}
        </button>
        <span className="text-xs text-text-400">You can save the remaining intake as a draft.</span>
      </div>
    </form>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 rounded-[8px] border border-input-border" />
        <span className="text-xs font-mono text-text-600">{value}</span>
      </div>
    </div>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1)))
);
