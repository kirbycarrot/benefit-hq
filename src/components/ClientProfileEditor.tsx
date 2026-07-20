"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readApiError, readJsonResponse } from "@/lib/api-response";
import {
  CLIENT_CONTACT_ROLES,
  CLIENT_DOCUMENT_CATEGORIES,
  CLIENT_DOCUMENT_CATEGORY_LABELS,
  CLIENT_PRIORITY_OPTIONS,
  DISRUPTION_TOLERANCE_OPTIONS,
  ENTITY_STRUCTURES,
  INDUSTRY_OPTIONS,
  INTERNAL_TEAM_ROLES,
  OWNERSHIP_TYPES,
  US_STATES,
  WORKFORCE_TYPES,
  computeOnboardingProgress,
  type ClientDocumentCategory,
  type ClientOnboardingInput,
  type OnboardingSectionKey,
} from "@/lib/client-onboarding";

type EditorContact = ClientOnboardingInput["contacts"][number] & { clientKey: string };
type EditorLocation = ClientOnboardingInput["locations"][number] & { clientKey: string };
type EditorEntity = ClientOnboardingInput["entities"][number] & { clientKey: string };
type EditorPriority = ClientOnboardingInput["priorities"][number] & { clientKey: string };
type EditorData = Omit<ClientOnboardingInput, "contacts" | "locations" | "entities" | "priorities"> & {
  contacts: EditorContact[];
  locations: EditorLocation[];
  entities: EditorEntity[];
  priorities: EditorPriority[];
};

export type ClientDocumentView = {
  id: string;
  category: string;
  originalFilename: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByName: string | null;
  planYearLabel: string | null;
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-input-border bg-white px-3 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";
const cardClass = "rounded-[14px] border border-border-light bg-white p-4 sm:p-5";

const SECTION_META: Array<{ key: OnboardingSectionKey; label: string; description: string }> = [
  { key: "profile", label: "Company profile", description: "Identity, classification, renewal, workforce, and branding" },
  { key: "team", label: "Team & contacts", description: "Internal ownership and client-side decision makers" },
  { key: "organization", label: "Organization & locations", description: "Entities, workforce structure, states, and worksites" },
  { key: "goals", label: "Goals & constraints", description: "Success criteria, guardrails, and ranked priorities" },
  { key: "documents", label: "Documents", description: "Secure intake checklist and source files" },
];

export function ClientProfileEditor({
  clientId,
  initial,
  initialLogoPath,
  users,
  planYears,
  initialDocuments,
}: {
  clientId: string;
  initial: ClientOnboardingInput;
  initialLogoPath: string | null;
  users: Array<{ id: string; name: string; email: string }>;
  planYears: Array<{ id: string; label: string }>;
  initialDocuments: ClientDocumentView[];
}) {
  const router = useRouter();
  const [data, setData] = useState<EditorData>(() => initializeEditor(initial));
  const [activeSection, setActiveSection] = useState<OnboardingSectionKey>("profile");
  const [documents, setDocuments] = useState(initialDocuments);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoPath);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useMemo(
    () => computeOnboardingProgress(stripEditor(data), documents.length),
    [data, documents.length]
  );

  function update(updater: (current: EditorData) => EditorData) {
    setData(updater);
    setDirty(true);
    setMessage(null);
    setError(null);
  }

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const formData = new FormData();
    formData.set("payload", JSON.stringify(stripEditor(data)));
    if (logoFile) formData.set("logo", logoFile);
    try {
      const response = await fetch(`/api/clients/${clientId}/profile`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) {
        setError(await readApiError(response, "Unable to save client profile"));
        return;
      }
      const result = (await response.json()) as { logoPath: string | null };
      if (result.logoPath) setLogoPreview(result.logoPath);
      setLogoFile(null);
      setDirty(false);
      setMessage("Client profile saved.");
      router.refresh();
    } catch {
      setError("Unable to save client profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[16px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-900">Onboarding progress</span>
            <span className="text-sm font-extrabold text-text-900">{progress.percentage}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-lighter">
            <div className="h-full rounded-full bg-teal-deep transition-all" style={{ width: `${progress.percentage}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-text-400">{progress.completed} of {progress.total} intake checkpoints complete</p>
          <nav className="mt-5 space-y-1" aria-label="Client profile sections">
            {SECTION_META.map((section) => {
              const status = progress.sections[section.key];
              const active = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full rounded-[10px] px-3 py-2.5 text-left ${active ? "bg-ink-900 text-white" : "text-text-600 hover:bg-panel-tint hover:text-text-900"}`}
                >
                  <span className="flex items-center justify-between gap-3 text-xs font-semibold">
                    {section.label}
                    <span className={active ? "text-white/70" : "text-text-400"}>
                      {section.key === "documents"
                        ? `${progress.documentCount} ${progress.documentCount === 1 ? "document" : "documents"}`
                        : `${status.percentage}%`}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-text-900">{SECTION_META.find((section) => section.key === activeSection)?.label}</h2>
          <p className="mt-1 text-sm text-text-600">{SECTION_META.find((section) => section.key === activeSection)?.description}</p>
        </div>

        {activeSection === "profile" && (
          <CompanyProfileSection
            data={data}
            logoPreview={logoPreview}
            onLogo={(file, preview) => { setLogoFile(file); setLogoPreview(preview); setDirty(true); }}
            update={update}
          />
        )}
        {activeSection === "team" && <TeamSection data={data} users={users} update={update} />}
        {activeSection === "organization" && <OrganizationSection data={data} update={update} />}
        {activeSection === "goals" && <GoalsSection data={data} update={update} />}
        {activeSection === "documents" && (
          <ClientDocumentsPanel
            clientId={clientId}
            documents={documents}
            setDocuments={setDocuments}
            planYears={planYears}
          />
        )}

        {activeSection !== "documents" && (
          <div className="sticky bottom-3 mt-6 flex flex-col gap-3 rounded-[14px] border border-border-light bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-success">{message}</p>}
              {!error && !message && dirty && <p className="text-xs text-amber">You have unsaved profile changes.</p>}
            </div>
            <button type="button" disabled={saving || !dirty} onClick={() => void saveProfile()} className="h-11 rounded-full bg-ink-900 px-6 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-45">
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyProfileSection({
  data,
  logoPreview,
  onLogo,
  update,
}: {
  data: EditorData;
  logoPreview: string | null;
  onLogo: (file: File, preview: string) => void;
  update: (updater: (current: EditorData) => EditorData) => void;
}) {
  const profile = data.profile;
  const setProfile = <K extends keyof ClientOnboardingInput["profile"]>(key: K, value: ClientOnboardingInput["profile"][K]) =>
    update((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <SectionHeading title="Company information" note="Required fields establish the record used in navigation, benchmarking, and reports." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Legal company name" value={profile.legalName} required onChange={(value) => setProfile("legalName", value)} />
          <TextField label="Display name" value={data.displayName} required onChange={(value) => update((current) => ({ ...current, displayName: value }))} />
          <TextField label="Company website" value={profile.website ?? ""} type="url" onChange={(value) => setProfile("website", nullable(value))} />
          <SelectField label="Primary industry" value={profile.primaryIndustry ?? ""} options={INDUSTRY_OPTIONS} required onChange={(value) => setProfile("primaryIndustry", nullable(value))} />
          <TextField label="Secondary industry / sub-industry" value={profile.secondaryIndustry ?? ""} onChange={(value) => setProfile("secondaryIndustry", nullable(value))} />
          <TextField label="NAICS or SIC code" value={profile.industryCode ?? ""} onChange={(value) => setProfile("industryCode", nullable(value))} />
          <SelectField label="Ownership type" value={profile.ownershipType ?? ""} options={OWNERSHIP_TYPES} onChange={(value) => setProfile("ownershipType", nullable(value))} />
          <TextField label="Parent company" value={profile.parentCompany ?? ""} onChange={(value) => setProfile("parentCompany", nullable(value))} />
          {profile.ownershipType === "Private Equity-Backed" && (
            <TextField label="Private equity sponsor" value={profile.privateEquitySponsor ?? ""} onChange={(value) => setProfile("privateEquitySponsor", nullable(value))} />
          )}
        </div>
      </section>

      <section className={cardClass}>
        <SectionHeading title="Dates and workforce snapshot" note="Counts represent the current intake snapshot and can later be compared with census data." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MonthDayFields label="Fiscal year-end" month={profile.fiscalYearEndMonth} day={profile.fiscalYearEndDay} onMonth={(value) => setProfile("fiscalYearEndMonth", value)} onDay={(value) => setProfile("fiscalYearEndDay", value)} />
          <MonthDayFields label="Primary renewal date" month={profile.primaryRenewalMonth} day={profile.primaryRenewalDay} onMonth={(value) => setProfile("primaryRenewalMonth", value)} onDay={(value) => setProfile("primaryRenewalDay", value)} />
          <NumberField label="U.S. employees" value={profile.usEmployeeCount} onChange={(value) => setProfile("usEmployeeCount", value)} />
          <NumberField label="Global employees" value={profile.globalEmployeeCount} onChange={(value) => setProfile("globalEmployeeCount", value)} />
          <NumberField label="Benefits-eligible employees" value={profile.benefitsEligibleCount} onChange={(value) => setProfile("benefitsEligibleCount", value)} />
          <NumberField label="Enrolled employees" value={profile.enrolledEmployeeCount} onChange={(value) => setProfile("enrolledEmployeeCount", value)} />
        </div>
      </section>

      <section className={cardClass}>
        <SectionHeading title="Branding" note="Used in client navigation and generated presentations." />
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Client logo" className="h-20 w-20 rounded-[12px] border border-border-light object-contain p-1" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-[12px] text-xl font-bold text-white" style={{ backgroundColor: data.primaryColor }}>{data.displayName.slice(0, 1).toUpperCase()}</div>
          )}
          <div className="space-y-3">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onLogo(file, URL.createObjectURL(file));
            }} className="block text-xs text-text-600 file:mr-3 file:rounded-full file:border file:border-input-border file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-text-900" />
            <div className="flex gap-6">
              <ColorField label="Primary" value={data.primaryColor} onChange={(value) => update((current) => ({ ...current, primaryColor: value }))} />
              <ColorField label="Secondary" value={data.secondaryColor} onChange={(value) => update((current) => ({ ...current, secondaryColor: value }))} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TeamSection({ data, users, update }: { data: EditorData; users: Array<{ id: string; name: string; email: string }>; update: (updater: (current: EditorData) => EditorData) => void }) {
  function assignedUser(role: string) {
    return data.teamAssignments.find((assignment) => assignment.role === role)?.userId ?? "";
  }
  function setAssignment(role: (typeof INTERNAL_TEAM_ROLES)[number], userId: string) {
    update((current) => ({
      ...current,
      teamAssignments: [
        ...current.teamAssignments.filter((assignment) => assignment.role !== role),
        ...(userId ? [{ role, userId }] : []),
      ],
    }));
  }
  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <SectionHeading title="Internal account team" note="Assign existing Benefit HQ users so ownership is consistent across workflows." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {INTERNAL_TEAM_ROLES.map((role) => (
            <div key={role}>
              <label className={labelClass}>{role}</label>
              <select value={assignedUser(role)} onChange={(event) => setAssignment(role, event.target.value)} className={inputClass}>
                <option value="">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-start justify-between gap-4">
          <SectionHeading title="Client contacts" note="Add each person once and select every role they perform." />
          <button type="button" onClick={() => update((current) => ({ ...current, contacts: [...current.contacts, blankContact(current.contacts.length)] }))} className="shrink-0 rounded-full bg-ink-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-black">Add contact</button>
        </div>
        {data.contacts.length === 0 ? <EmptyState text="No client contacts added yet." /> : (
          <div className="mt-4 space-y-4">
            {data.contacts.map((contact) => (
              <ContactCard key={contact.clientKey} contact={contact} onChange={(next) => update((current) => ({ ...current, contacts: current.contacts.map((item) => item.clientKey === contact.clientKey ? next : item) }))} onRemove={() => update((current) => ({ ...current, contacts: resequence(current.contacts.filter((item) => item.clientKey !== contact.clientKey)) }))} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContactCard({ contact, onChange, onRemove }: { contact: EditorContact; onChange: (contact: EditorContact) => void; onRemove: () => void }) {
  return (
    <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <TextField label="Name" value={contact.name} required onChange={(value) => onChange({ ...contact, name: value })} />
          <TextField label="Title" value={contact.title ?? ""} onChange={(value) => onChange({ ...contact, title: nullable(value) })} />
          <TextField label="Email" value={contact.email ?? ""} type="email" onChange={(value) => onChange({ ...contact, email: nullable(value) })} />
          <TextField label="Phone" value={contact.phone ?? ""} type="tel" onChange={(value) => onChange({ ...contact, phone: nullable(value) })} />
        </div>
        <button type="button" onClick={onRemove} className="text-xs font-semibold text-destructive">Remove</button>
      </div>
      <fieldset className="mt-3">
        <legend className={labelClass}>Roles</legend>
        <div className="flex flex-wrap gap-2">
          {CLIENT_CONTACT_ROLES.map((role) => <ToggleChip key={role} label={role} selected={contact.roles.includes(role)} onClick={() => onChange({ ...contact, roles: toggleValue(contact.roles, role) })} />)}
        </div>
      </fieldset>
      <div className="mt-3"><TextField label="Notes" value={contact.notes ?? ""} onChange={(value) => onChange({ ...contact, notes: nullable(value) })} /></div>
    </div>
  );
}

function OrganizationSection({ data, update }: { data: EditorData; update: (updater: (current: EditorData) => EditorData) => void }) {
  const profile = data.profile;
  const setProfile = <K extends keyof ClientOnboardingInput["profile"]>(key: K, value: ClientOnboardingInput["profile"][K]) => update((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <SectionHeading title="Structure and workforce" note="Conditional questions appear only when they apply." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField label="Entity structure" value={profile.entityStructure ?? ""} options={ENTITY_STRUCTURES} onChange={(value) => setProfile("entityStructure", nullable(value))} />
          {profile.entityStructure && profile.entityStructure !== "Single Entity" && <NumberField label="Number of EINs" value={profile.numberOfEins} min={1} onChange={(value) => setProfile("numberOfEins", value)} />}
          <BooleanField label="Benefits consistent across all entities?" value={profile.benefitsConsistentAcrossEntities} onChange={(value) => setProfile("benefitsConsistentAcrossEntities", value)} />
          {profile.benefitsConsistentAcrossEntities === false && <div className="sm:col-span-2"><TextField label="Why aren't benefits consistent across entities?" value={profile.benefitsConsistencyNotes ?? ""} onChange={(value) => setProfile("benefitsConsistencyNotes", nullable(value))} /></div>}
          <BooleanField label="Union populations?" value={profile.hasUnionPopulation} onChange={(value) => setProfile("hasUnionPopulation", value)} />
          {profile.hasUnionPopulation && <BooleanField label="Any plans collectively bargained?" value={profile.hasCollectivelyBargainedPlans} onChange={(value) => setProfile("hasCollectivelyBargainedPlans", value)} />}
          <BooleanField label="Acquired companies with separate programs?" value={profile.hasAcquiredCompanies} onChange={(value) => setProfile("hasAcquiredCompanies", value)} />
          <BooleanField label="International employees?" value={profile.hasInternationalEmployees} onChange={(value) => setProfile("hasInternationalEmployees", value)} />
          <BooleanField label="Currently covered through a PEO?" value={profile.coveredThroughPeo} onChange={(value) => setProfile("coveredThroughPeo", value)} />
        </div>
        <fieldset className="mt-5"><legend className={labelClass}>Seasonal, temporary, part-time, or variable-hour employees</legend><div className="flex flex-wrap gap-2">{WORKFORCE_TYPES.map((type) => <ToggleChip key={type} label={type} selected={profile.workforceTypes.includes(type)} onClick={() => setProfile("workforceTypes", toggleWorkforceType(profile.workforceTypes, type))} />)}</div></fieldset>
        <div className="mt-5"><StatePicker selected={profile.statesWithEmployees} onChange={(states) => setProfile("statesWithEmployees", states)} /></div>
      </section>

      <section className={cardClass}>
        <div className="flex items-start justify-between gap-4"><SectionHeading title="Worksites" note="Keep headquarters and other locations structured for geographic and network analysis." /><button type="button" onClick={() => update((current) => ({ ...current, locations: [...current.locations, blankLocation(current.locations.length)] }))} className="shrink-0 rounded-full bg-ink-900 px-4 py-2.5 text-xs font-semibold text-white">Add location</button></div>
        {data.locations.length === 0 ? <EmptyState text="Add the headquarters or another worksite." /> : <div className="mt-4 space-y-4">{data.locations.map((location) => <LocationCard key={location.clientKey} location={location} onChange={(next) => update((current) => ({ ...current, locations: current.locations.map((item) => item.clientKey === location.clientKey ? next : item).map((item) => next.isHeadquarters && item.clientKey !== next.clientKey ? { ...item, isHeadquarters: false } : item) }))} onRemove={() => update((current) => ({ ...current, locations: resequence(current.locations.filter((item) => item.clientKey !== location.clientKey)) }))} />)}</div>}
      </section>

      <section className={cardClass}>
        <div className="flex items-start justify-between gap-4"><SectionHeading title="Legal entities" note="Store only the final four EIN digits; full tax identifiers are intentionally excluded." /><button type="button" onClick={() => update((current) => ({ ...current, entities: [...current.entities, blankEntity(current.entities.length)] }))} className="shrink-0 rounded-full border border-input-border bg-white px-4 py-2.5 text-xs font-semibold text-text-900">Add entity</button></div>
        {data.entities.length === 0 ? <EmptyState text="No legal entities added." /> : <div className="mt-4 space-y-3">{data.entities.map((entity) => <EntityCard key={entity.clientKey} entity={entity} onChange={(next) => update((current) => ({ ...current, entities: current.entities.map((item) => item.clientKey === entity.clientKey ? next : item) }))} onRemove={() => update((current) => ({ ...current, entities: resequence(current.entities.filter((item) => item.clientKey !== entity.clientKey)) }))} />)}</div>}
      </section>
    </div>
  );
}

function LocationCard({ location, onChange, onRemove }: { location: EditorLocation; onChange: (location: EditorLocation) => void; onRemove: () => void }) {
  return <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-4"><div className="flex items-start justify-between gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-2"><TextField label="Location name" value={location.name} onChange={(value) => onChange({ ...location, name: value })} /><label className="flex h-11 items-center gap-2 self-end text-xs font-semibold text-text-600"><input type="checkbox" checked={location.isHeadquarters} onChange={(event) => onChange({ ...location, isHeadquarters: event.target.checked })} className="h-4 w-4 accent-teal-deep" />Headquarters</label><div className="sm:col-span-2"><AddressAutocompleteField location={location} onChange={onChange} /></div><div className="sm:col-span-2"><TextField label="Suite or unit" value={location.line2 ?? ""} onChange={(value) => onChange({ ...location, line2: nullable(value) })} /></div><TextField label="City" value={location.city} onChange={(value) => onChange({ ...location, city: value })} /><SelectField label="State" value={location.state} options={US_STATES.map(([code]) => code)} onChange={(value) => onChange({ ...location, state: value })} /><TextField label="ZIP code" value={location.postalCode} onChange={(value) => onChange({ ...location, postalCode: value })} /><NumberField label="Approximate employees" value={location.employeeCount} onChange={(value) => onChange({ ...location, employeeCount: value })} /></div><button type="button" onClick={onRemove} className="text-xs font-semibold text-destructive">Remove</button></div></div>;
}

type AddressSuggestion = { id: string; label: string; line1: string; city: string; state: string; postalCode: string };

function AddressAutocompleteField({ location, onChange }: { location: EditorLocation; onChange: (location: EditorLocation) => void }) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(value: string) {
    onChange({ ...location, line1: value });
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
        const data = await readJsonResponse<{ suggestions: AddressSuggestion[] }>(res);
        setSuggestions(data?.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    onChange({
      ...location,
      line1: suggestion.line1,
      city: suggestion.city,
      state: suggestion.state,
      postalCode: suggestion.postalCode,
    });
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className={labelClass}>Street address</label>
      <input
        value={location.line1}
        onChange={(event) => handleInput(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        className={inputClass}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-input-border bg-white text-[13px] shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectSuggestion(suggestion);
                }}
                className="block w-full px-3 py-2 text-left text-text-900 hover:bg-panel-tint"
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntityCard({ entity, onChange, onRemove }: { entity: EditorEntity; onChange: (entity: EditorEntity) => void; onRemove: () => void }) {
  return <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-4"><div className="flex items-start gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-2"><TextField label="Legal entity name" value={entity.legalName} onChange={(value) => onChange({ ...entity, legalName: value })} /><TextField label="EIN final four" value={entity.taxIdLastFour ?? ""} inputMode="numeric" maxLength={4} onChange={(value) => onChange({ ...entity, taxIdLastFour: nullable(value.replace(/\D/g, "").slice(0, 4)) })} /><div className="sm:col-span-2"><TextField label="Notes" value={entity.notes ?? ""} onChange={(value) => onChange({ ...entity, notes: nullable(value) })} /></div></div><button type="button" onClick={onRemove} className="text-xs font-semibold text-destructive">Remove</button></div></div>;
}

function GoalsSection({ data, update }: { data: EditorData; update: (updater: (current: EditorData) => EditorData) => void }) {
  const profile = data.profile;
  const setProfile = <K extends keyof ClientOnboardingInput["profile"]>(key: K, value: ClientOnboardingInput["profile"][K]) => update((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  const addablePriorities = CLIENT_PRIORITY_OPTIONS.filter((objective) => !data.priorities.some((priority) => priority.objective === objective));
  return <div className="space-y-5"><section className={cardClass}><SectionHeading title="Discovery and renewal guardrails" note="These values describe the current onboarding context and can seed plan-year renewal objectives." /><div className="mt-4 space-y-4"><LongTextField label="Three most significant benefit challenges" value={profile.benefitChallenges ?? ""} onChange={(value) => setProfile("benefitChallenges", nullable(value))} /><LongTextField label="Outcomes that would make the next renewal successful" value={profile.renewalSuccessOutcomes ?? ""} onChange={(value) => setProfile("renewalSuccessOutcomes", nullable(value))} /><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Defined budget target" value={profile.budgetTarget} step="0.01" prefix="$" onChange={(value) => setProfile("budgetTarget", value)} /><NumberField label="Maximum acceptable increase" value={profile.maximumAcceptableIncrease} max={100} step="0.1" suffix="%" onChange={(value) => setProfile("maximumAcceptableIncrease", value)} /><SelectField label="Carrier or provider disruption tolerance" value={profile.disruptionTolerance ?? ""} options={DISRUPTION_TOLERANCE_OPTIONS} onChange={(value) => setProfile("disruptionTolerance", nullable(value))} /><TextField label="Carriers the client will not consider" value={profile.excludedCarriers.join(", ")} placeholder="Carrier A, Carrier B" onChange={(value) => setProfile("excludedCarriers", commaList(value))} /></div><div className="grid gap-4 sm:grid-cols-2"><BooleanField label="Acquisitions or divestitures expected?" value={profile.acquisitionsExpected} onChange={(value) => setProfile("acquisitionsExpected", value)} /><BooleanField label="Significant headcount changes expected?" value={profile.headcountChangesExpected} onChange={(value) => setProfile("headcountChangesExpected", value)} /><BooleanField label="Benefits harmonization underway?" value={profile.harmonizationUnderway} onChange={(value) => setProfile("harmonizationUnderway", value)} /><BooleanField label="Preparing for a transaction?" value={profile.preparingForTransaction} onChange={(value) => setProfile("preparingForTransaction", value)} /></div></div></section><section className={cardClass}><div className="flex items-start justify-between gap-4"><SectionHeading title="Ranked strategic priorities" note="Rank selected objectives and define the outcome or KPI that will demonstrate progress." />{addablePriorities.length > 0 && <select value="" onChange={(event) => { const objective = event.target.value as (typeof CLIENT_PRIORITY_OPTIONS)[number]; if (objective) update((current) => ({ ...current, priorities: [...current.priorities, blankPriority(objective, current.priorities.length + 1)] })); }} className="h-10 shrink-0 rounded-full bg-ink-900 px-4 text-xs font-semibold text-white"><option value="">Add priority...</option>{addablePriorities.map((objective) => <option key={objective}>{objective}</option>)}</select>}</div>{data.priorities.length === 0 ? <EmptyState text="No strategic priorities selected." /> : <div className="mt-4 space-y-4">{[...data.priorities].sort((left, right) => left.rank - right.rank).map((priority) => <PriorityCard key={priority.clientKey} priority={priority} availableObjectives={CLIENT_PRIORITY_OPTIONS.filter((objective) => objective === priority.objective || !data.priorities.some((item) => item.objective === objective))} onChange={(next) => update((current) => ({ ...current, priorities: current.priorities.map((item) => item.clientKey === priority.clientKey ? next : item) }))} onRemove={() => update((current) => ({ ...current, priorities: current.priorities.filter((item) => item.clientKey !== priority.clientKey).sort((a, b) => a.rank - b.rank).map((item, index) => ({ ...item, rank: index + 1 })) }))} />)}</div>}</section></div>;
}

function PriorityCard({ priority, availableObjectives, onChange, onRemove }: { priority: EditorPriority; availableObjectives: readonly string[]; onChange: (priority: EditorPriority) => void; onRemove: () => void }) {
  return <div className="rounded-[12px] border border-border-lighter bg-panel-tint p-4"><div className="flex items-start gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-[90px_minmax(0,1fr)]"><NumberField label="Rank" value={priority.rank} min={1} max={CLIENT_PRIORITY_OPTIONS.length} onChange={(value) => onChange({ ...priority, rank: value ?? priority.rank })} /><SelectField label="Priority / objective" value={priority.objective} options={availableObjectives} onChange={(value) => onChange({ ...priority, objective: value as EditorPriority["objective"] })} /><div className="sm:col-span-2 grid gap-3 sm:grid-cols-2"><LongTextField label="Current state / challenge" value={priority.currentState ?? ""} rows={2} onChange={(value) => onChange({ ...priority, currentState: nullable(value) })} /><LongTextField label="Desired outcome" value={priority.desiredOutcome ?? ""} rows={2} onChange={(value) => onChange({ ...priority, desiredOutcome: nullable(value) })} /><TextField label="Measurement / KPI" value={priority.measurementKpi ?? ""} onChange={(value) => onChange({ ...priority, measurementKpi: nullable(value) })} /><TextField label="Notes" value={priority.notes ?? ""} onChange={(value) => onChange({ ...priority, notes: nullable(value) })} /></div></div><button type="button" onClick={onRemove} className="text-xs font-semibold text-destructive">Remove</button></div></div>;
}

function ClientDocumentsPanel({ clientId, documents, setDocuments, planYears }: { clientId: string; documents: ClientDocumentView[]; setDocuments: React.Dispatch<React.SetStateAction<ClientDocumentView[]>>; planYears: Array<{ id: string; label: string }> }) {
  const [category, setCategory] = useState<ClientDocumentCategory>("benefit-summary");
  const [planYearId, setPlanYearId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload() {
    if (!file) { setError("Choose a document to upload."); return; }
    setUploading(true); setError(null);
    const formData = new FormData(); formData.set("category", category); formData.set("file", file); if (planYearId) formData.set("planYearId", planYearId);
    try {
      const response = await fetch(`/api/clients/${clientId}/documents`, { method: "POST", body: formData });
      if (!response.ok) { setError(await readApiError(response, "Unable to upload document")); return; }
      const document = await response.json() as ClientDocumentView;
      setDocuments((current) => [document, ...current]); setFile(null); setInputKey((current) => current + 1);
    } catch { setError("Unable to upload document. Please try again."); } finally { setUploading(false); }
  }
  async function remove(document: ClientDocumentView) {
    if (!globalThis.confirm(`Delete ${document.originalFilename}?`)) return;
    const response = await fetch(`/api/client-documents/${document.id}`, { method: "DELETE" });
    if (!response.ok) { setError(await readApiError(response, "Unable to delete document")); return; }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
  }
  return <div className="space-y-5"><section className={cardClass}><SectionHeading title="Upload intake document" note="PDF, Excel, Word, PowerPoint, CSV, and text files up to 25MB. Files remain private." /><div className="mt-4 grid gap-4 sm:grid-cols-2"><SelectField label="Document category" value={category} options={CLIENT_DOCUMENT_CATEGORIES.map((value) => ({ value, label: CLIENT_DOCUMENT_CATEGORY_LABELS[value] }))} onChange={(value) => setCategory(value as ClientDocumentCategory)} /><SelectField label="Plan year (optional)" value={planYearId} options={planYears.map((planYear) => ({ value: planYear.id, label: planYear.label }))} emptyLabel="Client-level document" onChange={setPlanYearId} /><div className="sm:col-span-2"><label className={labelClass}>File</label><input key={inputKey} type="file" accept=".pdf,.xlsx,.xls,.docx,.pptx,.csv,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-[10px] border border-input-border bg-white px-3 py-2 text-xs text-text-600 file:mr-3 file:rounded-full file:border-0 file:bg-panel-tint file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-900" /></div></div>{error && <p className="mt-3 text-sm text-destructive">{error}</p>}<button type="button" disabled={uploading || !file} onClick={() => void upload()} className="mt-4 rounded-full bg-ink-900 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-45">{uploading ? "Uploading..." : "Upload document"}</button></section><section className={cardClass}><SectionHeading title="Document checklist" note={`${documents.length} document${documents.length === 1 ? "" : "s"} collected`} /><div className="mt-4 space-y-3">{CLIENT_DOCUMENT_CATEGORIES.map((categoryKey) => { const categoryDocuments = documents.filter((document) => document.category === categoryKey); return <div key={categoryKey} className="rounded-[12px] border border-border-lighter px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-text-900">{CLIENT_DOCUMENT_CATEGORY_LABELS[categoryKey]}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryDocuments.length ? "bg-green-50 text-success" : "bg-panel-tint text-text-400"}`}>{categoryDocuments.length ? `${categoryDocuments.length} uploaded` : "Missing"}</span></div>{categoryDocuments.length > 0 && <ul className="mt-2 divide-y divide-border-lighter">{categoryDocuments.map((document) => <li key={document.id} className="flex flex-col gap-1 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><a href={`/api/client-documents/${document.id}`} className="block truncate font-semibold text-link hover:text-link-hover">{document.originalFilename}</a><span className="text-text-400">{formatFileSize(document.sizeBytes)} · {new Date(document.uploadedAt).toLocaleDateString()}{document.planYearLabel ? ` · ${document.planYearLabel}` : ""}</span></div><button type="button" onClick={() => void remove(document)} className="self-start font-semibold text-destructive sm:self-auto">Delete</button></li>)}</ul>}</div>; })}</div></section></div>;
}

function SectionHeading({ title, note }: { title: string; note: string }) { return <div><h3 className="text-[15px] font-bold text-text-900">{title}</h3><p className="mt-1 text-xs leading-5 text-text-600">{note}</p></div>; }
function EmptyState({ text }: { text: string }) { return <div className="mt-4 rounded-[12px] border border-dashed border-input-border px-4 py-7 text-center text-xs text-text-600">{text}</div>; }

function TextField({ label, value, onChange, required = false, type = "text", placeholder, inputMode, maxLength }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number }) { return <div><label className={labelClass}>{label}{required && <span className="ml-1 text-destructive">*</span>}</label><input type={type} value={value} required={required} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={inputClass} /></div>; }
function LongTextField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <div><label className={labelClass}>{label}</label><textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[10px] border border-input-border bg-white px-3 py-2.5 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none" /></div>; }

type SelectOption = string | { value: string; label: string };
function SelectField({ label, value, options, onChange, required = false, emptyLabel = "Select..." }: { label: string; value: string; options: readonly SelectOption[]; onChange: (value: string) => void; required?: boolean; emptyLabel?: string }) { return <div><label className={labelClass}>{label}{required && <span className="ml-1 text-destructive">*</span>}</label><select value={value} required={required} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">{emptyLabel}</option>{options.map((option) => { const value = typeof option === "string" ? option : option.value; const text = typeof option === "string" ? option : option.label; return <option key={value} value={value}>{text}</option>; })}</select></div>; }

function NumberField({ label, value, onChange, min = 0, max, step = "1", prefix, suffix }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max?: number; step?: string; prefix?: string; suffix?: string }) { return <div><label className={labelClass}>{label}</label><div className="relative">{prefix && <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-text-400">{prefix}</span>}<input type="number" value={value ?? ""} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`} />{suffix && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-400">{suffix}</span>}</div></div>; }

function BooleanField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) { return <SelectField label={label} value={value === null ? "" : value ? "yes" : "no"} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} emptyLabel="Not answered" onChange={(next) => onChange(next === "" ? null : next === "yes")} />; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className={labelClass}>{label}</label><div className="flex items-center gap-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 rounded-[8px] border border-input-border" /><span className="font-mono text-xs text-text-600">{value}</span></div></div>; }

function MonthDayFields({ label, month, day, onMonth, onDay }: { label: string; month: number | null; day: number | null; onMonth: (value: number | null) => void; onDay: (value: number | null) => void }) { return <fieldset className="lg:col-span-2"><legend className={labelClass}>{label}</legend><div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2"><select value={month ?? ""} onChange={(event) => onMonth(event.target.value ? Number(event.target.value) : null)} className={inputClass}><option value="">Month</option>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select><input type="number" min="1" max="31" value={day ?? ""} placeholder="Day" onChange={(event) => onDay(event.target.value ? Number(event.target.value) : null)} className={inputClass} /></div></fieldset>; }
function ToggleChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selected ? "border-teal-deep bg-teal-50 text-teal-deep" : "border-input-border bg-white text-text-600 hover:border-text-300"}`}>{label}</button>; }

function StatePicker({ selected, onChange }: { selected: string[]; onChange: (states: string[]) => void }) { const addable = US_STATES.filter(([code]) => !selected.includes(code)); return <div><label className={labelClass}>States with employees</label><div className="flex flex-wrap gap-2">{selected.map((code) => <button type="button" key={code} onClick={() => onChange(selected.filter((item) => item !== code))} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-deep">{code} ×</button>)}<select value="" onChange={(event) => { if (event.target.value) onChange([...selected, event.target.value]); }} className="h-9 rounded-full border border-input-border bg-white px-3 text-xs font-semibold text-text-600"><option value="">Add state...</option>{addable.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div></div>; }

function initializeEditor(initial: ClientOnboardingInput): EditorData { return { ...initial, contacts: initial.contacts.map((item) => ({ ...item, clientKey: item.id ?? makeKey() })), locations: initial.locations.map((item) => ({ ...item, clientKey: item.id ?? makeKey() })), entities: initial.entities.map((item) => ({ ...item, clientKey: item.id ?? makeKey() })), priorities: initial.priorities.map((item) => ({ ...item, clientKey: makeKey() })) }; }
function stripEditor(data: EditorData): ClientOnboardingInput { return { ...data, contacts: data.contacts.map(({ clientKey, ...item }) => { void clientKey; return item; }), locations: data.locations.map(({ clientKey, ...item }) => { void clientKey; return item; }), entities: data.entities.map(({ clientKey, ...item }) => { void clientKey; return item; }), priorities: data.priorities.map(({ clientKey, ...item }) => { void clientKey; return item; }) }; }
function blankContact(sortOrder: number): EditorContact { return { clientKey: makeKey(), name: "", title: null, email: null, phone: null, roles: [], notes: null, sortOrder }; }
function blankLocation(sortOrder: number): EditorLocation { return { clientKey: makeKey(), name: `Location ${sortOrder + 1}`, line1: "", line2: null, city: "", state: "", postalCode: "", country: "United States", isHeadquarters: false, employeeCount: null, sortOrder }; }
function blankEntity(sortOrder: number): EditorEntity { return { clientKey: makeKey(), legalName: "", taxIdLastFour: null, notes: null, sortOrder }; }
function blankPriority(objective: (typeof CLIENT_PRIORITY_OPTIONS)[number], rank: number): EditorPriority { return { clientKey: makeKey(), objective, rank, currentState: null, desiredOutcome: null, measurementKpi: null, notes: null }; }
function makeKey() { return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`; }
function nullable(value: string): string | null { return value.trim() ? value : null; }
function commaList(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function toggleValue<T>(items: readonly T[], value: T): T[] { return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]; }
function toggleWorkforceType(items: ClientOnboardingInput["profile"]["workforceTypes"], value: (typeof WORKFORCE_TYPES)[number]) { if (value === "None of These") return items.includes(value) ? [] : [value]; const withoutNone = items.filter((item) => item !== "None of These"); return toggleValue(withoutNone, value); }
function resequence<T extends { sortOrder: number }>(items: T[]): T[] { return items.map((item, index) => ({ ...item, sortOrder: index })); }
function formatFileSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 1))));
