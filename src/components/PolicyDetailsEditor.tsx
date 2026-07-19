"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readApiError } from "@/lib/api-response";
import {
  BENEFIT_META,
  BENEFIT_TYPES,
  PLAN_SUBTYPES,
  POLICY_TIER_LABELS,
  TIER_TEMPLATE_LABELS,
  TIER_TEMPLATES,
  type BenefitType,
  type CensusPlanSuggestion,
  type PolicyDetailField,
  type PolicyDetailValue,
  type PolicyPlanInput,
  type PolicyProgramInput,
  type PolicyRateInput,
  type PolicyTierCode,
  type RateBenefitType,
  type TierTemplate,
  isRateBenefitType,
  normalizePolicyName,
  policyReadinessIssues,
  visibleDetailGroups,
} from "@/lib/policy-details";
import { RATE_PERIOD_LABELS, RATE_PERIODS } from "@/lib/validation";

type EditorPlan = PolicyPlanInput & { clientKey: string };
type EditorProgram = Omit<PolicyProgramInput, "plans"> & { plans: EditorPlan[] };

const inputClass =
  "h-11 w-full rounded-[10px] border border-input-border bg-white px-3 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";

export function PolicyDetailsEditor({
  planYearId,
  initialPrograms,
  censusSuggestions,
  canCopyPrior,
}: {
  planYearId: string;
  initialPrograms: PolicyProgramInput[];
  censusSuggestions: CensusPlanSuggestion[];
  canCopyPrior: boolean;
}) {
  const router = useRouter();
  const [programs, setPrograms] = useState<EditorProgram[]>(() =>
    initializePrograms(initialPrograms)
  );
  const [activeBenefit, setActiveBenefit] = useState<BenefitType>(
    initialPrograms.find((program) => program.offered)?.benefitType ?? "Medical"
  );
  const [dirtyBenefits, setDirtyBenefits] = useState<Set<BenefitType>>(new Set());
  const [savingBenefit, setSavingBenefit] = useState<BenefitType | null>(null);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeProgram = programs.find(
    (program) => program.benefitType === activeBenefit
  )!;
  const issues = useMemo(
    () => policyReadinessIssues(programs.map(stripEditorProgram)),
    [programs]
  );
  const activeSuggestions = censusSuggestions.filter(
    (suggestion) => suggestion.benefitType === activeBenefit
  );
  const addableSuggestions = activeSuggestions.filter(
    (suggestion) =>
      !activeProgram.plans.some(
        (plan) =>
          normalizePolicyName(plan.name) === normalizePolicyName(suggestion.planName) ||
          plan.aliases.some(
            (alias) => normalizePolicyName(alias) === normalizePolicyName(suggestion.planName)
          )
      )
  );

  function updateProgram(
    benefitType: BenefitType,
    updater: (program: EditorProgram) => EditorProgram
  ) {
    setPrograms((current) =>
      current.map((program) =>
        program.benefitType === benefitType ? updater(program) : program
      )
    );
    setDirtyBenefits((current) => new Set(current).add(benefitType));
    setMessage(null);
    setError(null);
  }

  function addPlan(benefitType: BenefitType, subtype?: string) {
    updateProgram(benefitType, (program) => {
      const selectedSubtype = subtype ?? PLAN_SUBTYPES[benefitType][0];
      const sameTypeCount = program.plans.filter(
        (plan) => plan.subtype === selectedSubtype
      ).length;
      const defaultName =
        benefitType === "VoluntaryLife"
          ? selectedSubtype
          : `${selectedSubtype} ${sameTypeCount + 1}`;
      const plan: EditorPlan = {
        clientKey: makeClientKey(),
        name: defaultName,
        subtype: selectedSubtype,
        offered: true,
        details: isRateBenefitType(benefitType)
          ? { tierStructure: "four-tier" }
          : {},
        detailSchemaVersion: 1,
        renewedFromPlanId: null,
        sortOrder: program.plans.length,
        aliases: [],
        rates: isRateBenefitType(benefitType)
          ? createBlankRates("four-tier")
          : [],
      };
      return { ...program, offered: true, plans: [...program.plans, plan] };
    });
  }

  function addCensusPlans(benefitType: RateBenefitType) {
    const suggestions = censusSuggestions.filter(
      (suggestion) => suggestion.benefitType === benefitType
    );
    updateProgram(benefitType, (program) => {
      const existingNames = new Set(
        program.plans.flatMap((plan) => [plan.name, ...plan.aliases]).map(normalizePolicyName)
      );
      const newPlans = suggestions
        .filter((suggestion) => !existingNames.has(normalizePolicyName(suggestion.planName)))
        .map<EditorPlan>((suggestion, index) => ({
          clientKey: makeClientKey(),
          name: suggestion.planName,
          subtype: suggestion.subtype,
          offered: true,
          details: { tierStructure: "four-tier" },
          detailSchemaVersion: 1,
          renewedFromPlanId: null,
          sortOrder: program.plans.length + index,
          aliases: [suggestion.planName],
          rates: createBlankRates("four-tier", suggestion.tierEnrollments),
        }));
      return {
        ...program,
        offered: true,
        plans: [...program.plans, ...newPlans],
      };
    });
  }

  function updatePlan(clientKey: string, updater: (plan: EditorPlan) => EditorPlan) {
    updateProgram(activeBenefit, (program) => ({
      ...program,
      plans: program.plans.map((plan) =>
        plan.clientKey === clientKey ? updater(plan) : plan
      ),
    }));
  }

  function removePlan(clientKey: string) {
    updateProgram(activeBenefit, (program) => ({
      ...program,
      plans: program.plans
        .filter((plan) => plan.clientKey !== clientKey)
        .map((plan, index) => ({ ...plan, sortOrder: index })),
    }));
  }

  function duplicatePlan(plan: EditorPlan) {
    updateProgram(activeBenefit, (program) => ({
      ...program,
      offered: true,
      plans: [
        ...program.plans,
        {
          ...plan,
          id: undefined,
          clientKey: makeClientKey(),
          name: `${plan.name} copy`,
          renewedFromPlanId: null,
          sortOrder: program.plans.length,
          aliases: [],
          rates: plan.rates.map((rate, index) => ({
            ...rate,
            id: undefined,
            sortOrder: index,
          })),
        },
      ],
    }));
  }

  async function saveProgram(program: EditorProgram) {
    setSavingBenefit(program.benefitType);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/plan-years/${planYearId}/benefit-programs/${program.benefitType}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stripEditorProgram(program)),
        }
      );
      if (!response.ok) {
        setError(await readApiError(response, "Unable to save policy details"));
        return;
      }
      setDirtyBenefits((current) => {
        const next = new Set(current);
        next.delete(program.benefitType);
        return next;
      });
      setMessage(`${BENEFIT_META[program.benefitType].label} saved.`);
      router.refresh();
    } catch {
      setError("Unable to save policy details. Please try again.");
    } finally {
      setSavingBenefit(null);
    }
  }

  async function copyPriorYear() {
    setCopying(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/plan-years/${planYearId}/benefit-programs/copy-prior`,
        { method: "POST" }
      );
      if (!response.ok) {
        setError(await readApiError(response, "Unable to copy the prior plan year"));
        return;
      }
      setMessage("Prior policy details copied. Review the renewal rates before continuing.");
      router.refresh();
    } catch {
      setError("Unable to copy the prior plan year. Please try again.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-[14px] border border-border-light bg-white p-4 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h3 className="text-sm font-bold text-text-900">Start with what you already know</h3>
          <p className="mt-1 text-xs text-text-600">
            Copy the prior renewal or build health plans from the uploaded census, then fill in only the applicable details.
          </p>
        </div>
        <button
          type="button"
          disabled={!canCopyPrior || copying}
          onClick={() => void copyPriorYear()}
          className="h-10 shrink-0 rounded-full border border-input-border bg-white px-4 text-xs font-semibold text-text-900 hover:border-teal-deep disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copying ? "Copying..." : "Copy prior plan year"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {programs.map((program) => {
          const programIssues = issues.filter(
            (issue) => issue.benefitType === program.benefitType
          );
          const status = programStatus(program, programIssues);
          const active = activeBenefit === program.benefitType;
          return (
            <button
              key={program.benefitType}
              type="button"
              onClick={() => setActiveBenefit(program.benefitType)}
              className={`rounded-[14px] border p-4 text-left transition-colors ${
                active
                  ? "border-teal-deep bg-white shadow-[0_2px_8px_rgba(15,156,144,0.10)]"
                  : "border-border-light bg-panel-tint hover:border-input-border"
              }`}
            >
              <span className="block text-sm font-bold text-text-900">
                {BENEFIT_META[program.benefitType].label}
              </span>
              <span className="mt-1 block text-xs text-text-600">
                {program.plans.length} {program.plans.length === 1 ? "plan/class" : "plans/classes"}
              </span>
              <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                {dirtyBenefits.has(program.benefitType) ? "Unsaved changes" : status.label}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-[16px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
        <div className="border-b border-border-lighter p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-extrabold text-text-900">
                  {BENEFIT_META[activeBenefit].label}
                </h3>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-600">
                  <input
                    type="checkbox"
                    checked={activeProgram.offered}
                    onChange={(event) =>
                      updateProgram(activeBenefit, (program) => ({
                        ...program,
                        offered: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-teal-deep"
                  />
                  Offered
                </label>
              </div>
              <p className="mt-1 text-sm text-text-600">
                {BENEFIT_META[activeBenefit].description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isRateBenefitType(activeBenefit) && addableSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => addCensusPlans(activeBenefit)}
                  className="h-10 rounded-full border border-input-border bg-white px-4 text-xs font-semibold text-text-900 hover:border-teal-deep"
                >
                  Add {addableSuggestions.length} from census
                </button>
              )}
              <AddPlanButton benefitType={activeBenefit} onAdd={addPlan} />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {!activeProgram.offered && (
            <div className="rounded-[12px] border border-dashed border-input-border bg-panel-tint px-4 py-5 text-sm text-text-600">
              This benefit is currently marked not offered. Existing plan details are retained and can be re-enabled later.
            </div>
          )}

          {activeProgram.plans.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-input-border px-5 py-10 text-center">
              <p className="text-sm font-semibold text-text-900">No plans or classes yet</p>
              <p className="mt-1 text-xs text-text-600">
                Add only what the client offers; more plans can be added at any time.
              </p>
            </div>
          ) : (
            activeProgram.plans.map((plan) => (
              <PlanCard
                key={plan.clientKey}
                benefitType={activeBenefit}
                plan={plan}
                onChange={(updater) => updatePlan(plan.clientKey, updater)}
                onDuplicate={() => duplicatePlan(plan)}
                onRemove={() => removePlan(plan.clientKey)}
              />
            ))
          )}

          <div className="flex flex-col gap-3 border-t border-border-lighter pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-success">{message}</p>}
              {!error && !message && dirtyBenefits.has(activeBenefit) && (
                <p className="text-xs text-amber">This benefit has unsaved changes.</p>
              )}
            </div>
            <button
              type="button"
              disabled={savingBenefit !== null}
              onClick={() => void saveProgram(activeProgram)}
              className="h-11 rounded-full bg-ink-900 px-6 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {savingBenefit === activeBenefit ? "Saving..." : `Save ${BENEFIT_META[activeBenefit].label}`}
            </button>
          </div>
        </div>
      </section>

      <ReadinessPanel issues={issues} />
    </div>
  );
}

function AddPlanButton({
  benefitType,
  onAdd,
}: {
  benefitType: BenefitType;
  onAdd: (benefitType: BenefitType, subtype?: string) => void;
}) {
  const options = PLAN_SUBTYPES[benefitType];
  if (options.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onAdd(benefitType, options[0])}
        className="h-10 rounded-full bg-ink-900 px-4 text-xs font-semibold text-white hover:bg-black"
      >
        Add plan or class
      </button>
    );
  }
  return (
    <select
      aria-label={`Add ${BENEFIT_META[benefitType].label} plan`}
      value=""
      onChange={(event) => {
        if (event.target.value) onAdd(benefitType, event.target.value);
      }}
      className="h-10 rounded-full bg-ink-900 px-4 text-xs font-semibold text-white focus:outline-none"
    >
      <option value="">Add plan or class...</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function PlanCard({
  benefitType,
  plan,
  onChange,
  onDuplicate,
  onRemove,
}: {
  benefitType: BenefitType;
  plan: EditorPlan;
  onChange: (updater: (plan: EditorPlan) => EditorPlan) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const detailGroups = visibleDetailGroups(benefitType, plan);
  const tierTemplate = inferTierTemplate(plan);
  const ratePeriod = plan.rates[0]?.ratePeriod ?? "monthly";

  return (
    <article className="rounded-[14px] border border-border-light bg-panel-tint">
      <div className="flex flex-col gap-4 border-b border-border-lighter p-4 sm:flex-row sm:items-end sm:p-5">
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(180px,1fr)_150px_auto]">
          <div>
            <label className={labelClass}>Plan or class name</label>
            <input
              value={plan.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={plan.subtype}
              onChange={(event) =>
                onChange((current) => ({ ...current, subtype: event.target.value }))
              }
              className={inputClass}
            >
              {PLAN_SUBTYPES[benefitType].map((subtype) => (
                <option key={subtype} value={subtype}>
                  {subtype}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-11 items-center gap-2 text-xs font-semibold text-text-600 sm:mt-[22px]">
            <input
              type="checkbox"
              checked={plan.offered}
              onChange={(event) =>
                onChange((current) => ({ ...current, offered: event.target.checked }))
              }
              className="h-4 w-4 accent-teal-deep"
            />
            Active
          </label>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" onClick={onDuplicate} className="text-link hover:text-link-hover">
            Duplicate
          </button>
          <button type="button" onClick={onRemove} className="text-destructive hover:text-red-800">
            Remove
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {isRateBenefitType(benefitType) && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-[180px]">
                <label className={labelClass}>Tier structure</label>
                <select
                  value={tierTemplate}
                  onChange={(event) =>
                    onChange((current) =>
                      changeTierTemplate(current, event.target.value as TierTemplate)
                    )
                  }
                  className={inputClass}
                >
                  {(Object.keys(TIER_TEMPLATES) as TierTemplate[]).map((template) => (
                    <option key={template} value={template}>
                      {TIER_TEMPLATE_LABELS[template]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-[180px]">
                <label className={labelClass}>Rate period</label>
                <select
                  value={ratePeriod}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      rates: current.rates.map((rate) => ({
                        ...rate,
                        ratePeriod: event.target.value as PolicyRateInput["ratePeriod"],
                      })),
                    }))
                  }
                  className={inputClass}
                >
                  {RATE_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {RATE_PERIOD_LABELS[period]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <RateTable
              plan={plan}
              onRateChange={(rateIndex, updater) =>
                onChange((current) => ({
                  ...current,
                  rates: current.rates.map((rate, currentIndex) =>
                    currentIndex === rateIndex ? updater(rate) : rate
                  ),
                }))
              }
            />
          </>
        )}

        <details className="group rounded-[12px] border border-border-lighter bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-text-900 marker:hidden">
            <span className="flex items-center justify-between">
              Plan details
              <span className="text-text-400 transition-transform group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="space-y-5 border-t border-border-lighter p-4">
            {detailGroups.map((group) => (
              <div key={group.key}>
                <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-text-600">
                  {group.label}
                </h4>
                {group.description && (
                  <p className="mt-1 text-xs text-text-400">{group.description}</p>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.fields.map((field) => (
                    <DetailFieldInput
                      key={field.key}
                      field={field}
                      value={plan.details[field.key]}
                      onChange={(value) =>
                        onChange((current) => ({
                          ...current,
                          details: { ...current.details, [field.key]: value },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <label className={labelClass}>Notes or “Other” explanation</label>
              <textarea
                value={typeof plan.details.notes === "string" ? plan.details.notes : ""}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    details: { ...current.details, notes: event.target.value },
                  }))
                }
                rows={3}
                className="w-full rounded-[10px] border border-input-border bg-white px-3 py-2 text-[13px] text-text-900 focus:border-teal-deep focus:outline-none"
              />
            </div>
            <div>
              <label className={labelClass}>Census plan aliases</label>
              <input
                value={plan.aliases.join(", ")}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    aliases: event.target.value
                      .split(",")
                      .map((alias) => alias.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="Carrier PPO, PPO Option 1"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-text-400">
                Comma-separated names used by census files for this plan.
              </p>
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

function RateTable({
  plan,
  onRateChange,
}: {
  plan: EditorPlan;
  onRateChange: (
    index: number,
    updater: (rate: PolicyRateInput) => PolicyRateInput
  ) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-border-lighter bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-panel-tint">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-text-600">Tier</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-text-600">Enrollment</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-text-600">Gross premium</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-text-600">Employee contribution</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-text-600">Employer contribution</th>
          </tr>
        </thead>
        <tbody>
          {plan.rates.map((rate, index) => {
            const employer = Math.max(
              0,
              Math.round((rate.grossPremium - rate.employeeContribution) * 100) / 100
            );
            return (
              <tr key={rate.tier} className="border-t border-border-lighter">
                <td className="px-3 py-2 font-semibold text-text-900">
                  {POLICY_TIER_LABELS[rate.tier]}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label={`${POLICY_TIER_LABELS[rate.tier]} enrollment override`}
                    value={rate.enrollmentOverride ?? ""}
                    placeholder="Census"
                    onChange={(event) =>
                      onRateChange(index, (current) => ({
                        ...current,
                        enrollmentOverride:
                          event.target.value === "" ? undefined : Number(event.target.value),
                      }))
                    }
                    className="h-9 w-full min-w-[100px] rounded-lg border border-input-border px-2 text-right text-[13px] focus:border-teal-deep focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <CurrencyInput
                    label={`${POLICY_TIER_LABELS[rate.tier]} gross premium`}
                    value={rate.grossPremium}
                    onChange={(value) =>
                      onRateChange(index, (current) => ({ ...current, grossPremium: value }))
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <CurrencyInput
                    label={`${POLICY_TIER_LABELS[rate.tier]} employee contribution`}
                    value={rate.employeeContribution}
                    onChange={(value) =>
                      onRateChange(index, (current) => ({
                        ...current,
                        employeeContribution: value,
                      }))
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold text-text-600">
                  {formatCurrency(employer)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailFieldInput({
  field,
  value,
  onChange,
}: {
  field: PolicyDetailField;
  value: PolicyDetailValue | undefined;
  onChange: (value: PolicyDetailValue) => void;
}) {
  if (field.type === "select") {
    return (
      <div>
        <label className={labelClass}>{field.label}</label>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={inputClass}
        >
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {field.help && <p className="mt-1 text-[11px] text-text-400">{field.help}</p>}
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div>
        <label className={labelClass}>{field.label}</label>
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={inputClass}
        />
        {field.help && <p className="mt-1 text-[11px] text-text-400">{field.help}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className={labelClass}>{field.label}</label>
      <div className="relative">
        {field.type === "currency" && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-text-400">$</span>
        )}
        <input
          type="number"
          min="0"
          max={field.type === "percent" ? "100" : undefined}
          step={field.type === "currency" ? "0.01" : field.type === "percent" ? "0.1" : "1"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
          className={`${inputClass} ${field.type === "currency" ? "pl-7" : ""} ${field.type === "percent" || field.suffix ? "pr-14" : ""}`}
        />
        {(field.type === "percent" || field.suffix) && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-text-400">
            {field.type === "percent" ? "%" : field.suffix}
          </span>
        )}
      </div>
      {field.help && <p className="mt-1 text-[11px] text-text-400">{field.help}</p>}
    </div>
  );
}

function CurrencyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-text-400">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        aria-label={label}
        value={value || ""}
        onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        className="h-9 w-full min-w-[125px] rounded-lg border border-input-border pr-2 pl-6 text-right text-[13px] focus:border-teal-deep focus:outline-none"
      />
    </div>
  );
}

function ReadinessPanel({
  issues,
}: {
  issues: ReturnType<typeof policyReadinessIssues>;
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-[14px] border border-green-200 bg-green-50 px-5 py-4">
        <p className="text-sm font-bold text-success">Policy details are ready for reporting</p>
        <p className="mt-1 text-xs text-green-800">No plan-level blockers or warnings were found.</p>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] border border-border-light bg-white p-5">
      <h3 className="text-sm font-bold text-text-900">Review before charts and deck</h3>
      <ul className="mt-3 space-y-2">
        {issues.map((issue, index) => (
          <li key={`${issue.benefitType}-${issue.planName}-${index}`} className="flex gap-2 text-xs text-text-600">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                issue.severity === "error" ? "bg-destructive" : "bg-amber"
              }`}
            />
            <span>
              <strong className="text-text-900">
                {BENEFIT_META[issue.benefitType].label}
                {issue.planName ? ` — ${issue.planName}` : ""}:
              </strong>{" "}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function initializePrograms(initialPrograms: PolicyProgramInput[]): EditorProgram[] {
  return BENEFIT_TYPES.map((benefitType) => {
    const existing = initialPrograms.find((program) => program.benefitType === benefitType);
    return {
      benefitType,
      offered: existing?.offered ?? false,
      plans: (existing?.plans ?? []).map((plan) => ({
        ...plan,
        clientKey: plan.id ?? makeClientKey(),
      })),
    };
  });
}

function stripEditorProgram(program: EditorProgram): PolicyProgramInput {
  return {
    benefitType: program.benefitType,
    offered: program.offered,
    plans: program.plans.map((editorPlan) => {
      const { clientKey, ...plan } = editorPlan;
      void clientKey;
      return plan;
    }),
  };
}

function createBlankRates(
  template: TierTemplate,
  enrollments: Partial<Record<PolicyTierCode, number>> = {}
): PolicyRateInput[] {
  return TIER_TEMPLATES[template].map((tier, index) => ({
    tier,
    grossPremium: 0,
    employeeContribution: 0,
    ratePeriod: "monthly",
    enrollmentOverride: enrollments[tier],
    sortOrder: index,
  }));
}

function inferTierTemplate(plan: PolicyPlanInput): TierTemplate {
  const saved = plan.details.tierStructure;
  if (typeof saved === "string" && saved in TIER_TEMPLATES) return saved as TierTemplate;
  const tiers = new Set(plan.rates.map((rate) => rate.tier));
  if (tiers.has("EE+Family")) return "two-tier";
  if (tiers.has("EE+Dependent")) return "three-tier";
  return "four-tier";
}

function changeTierTemplate(plan: EditorPlan, template: TierTemplate): EditorPlan {
  const priorByTier = new Map(plan.rates.map((rate) => [rate.tier, rate]));
  const dependentEnrollment = ["EE+Spouse", "EE+Child"]
    .map((tier) => priorByTier.get(tier as PolicyTierCode)?.enrollmentOverride ?? 0)
    .reduce((sum, count) => sum + count, 0);
  const familyEnrollment = ["EE+Spouse", "EE+Child", "Family"]
    .map((tier) => priorByTier.get(tier as PolicyTierCode)?.enrollmentOverride ?? 0)
    .reduce((sum, count) => sum + count, 0);
  const defaultPeriod = plan.rates[0]?.ratePeriod ?? "monthly";

  return {
    ...plan,
    details: { ...plan.details, tierStructure: template },
    rates: TIER_TEMPLATES[template].map((tier, index) => {
      const prior = priorByTier.get(tier);
      return {
        tier,
        grossPremium: prior?.grossPremium ?? 0,
        employeeContribution: prior?.employeeContribution ?? 0,
        ratePeriod: prior?.ratePeriod ?? defaultPeriod,
        enrollmentOverride:
          prior?.enrollmentOverride ??
          (tier === "EE+Dependent"
            ? dependentEnrollment || undefined
            : tier === "EE+Family"
              ? familyEnrollment || undefined
              : undefined),
        sortOrder: index,
      };
    }),
  };
}

function programStatus(
  program: EditorProgram,
  issues: ReturnType<typeof policyReadinessIssues>
) {
  if (!program.offered) {
    return { label: "Not offered", className: "bg-border-lighter text-text-600" };
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { label: "Needs attention", className: "bg-red-50 text-destructive" };
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return { label: "Review", className: "bg-amber-50 text-amber" };
  }
  return { label: "Ready", className: "bg-green-50 text-success" };
}

function makeClientKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}-${Math.random()}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}
