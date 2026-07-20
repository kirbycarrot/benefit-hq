import { lookupPostalGeography } from "@/lib/geography/lookup";
import { US_STATES } from "@/lib/client-onboarding";

const STATE_CODE_BY_NAME = new Map<string, string>(
  US_STATES.map(([code, name]) => [name, code])
);

export function zipToState(postalCode: string | undefined | null): string | undefined {
  const geography = lookupPostalGeography(postalCode);
  if (!geography) return undefined;
  return STATE_CODE_BY_NAME.get(geography.stateName);
}
