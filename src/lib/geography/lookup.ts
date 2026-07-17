import countyAtlasRaw from "us-atlas/counties-albers-10m.json";
import zipToCountyRaw from "./data/zip-to-county.json";

type AtlasGeometry = {
  id?: string | number;
  properties?: { name?: string };
};

type AtlasTopology = {
  objects: {
    states: { geometries: AtlasGeometry[] };
    counties: { geometries: AtlasGeometry[] };
  };
};

const atlas = countyAtlasRaw as unknown as AtlasTopology;
const zipToCounty = zipToCountyRaw as Record<string, string>;

function fips(value: string | number | undefined, length: number): string {
  return String(value ?? "").padStart(length, "0");
}

const stateNames = new Map(
  atlas.objects.states.geometries.map((state) => [
    fips(state.id, 2),
    state.properties?.name ?? "Unknown state",
  ])
);

const countyNames = new Map(
  atlas.objects.counties.geometries.map((county) => [
    fips(county.id, 5),
    county.properties?.name ?? "Unknown county",
  ])
);

export type PostalGeography = {
  zip: string;
  stateFips: string;
  stateName: string;
  countyFips: string;
  countyName: string;
};

export function normalizeUsZip(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

export function lookupPostalGeography(
  value: string | null | undefined
): PostalGeography | null {
  const zip = normalizeUsZip(value);
  if (!zip) return null;

  const countyFips = zipToCounty[zip];
  if (!countyFips) return null;

  const stateFips = countyFips.slice(0, 2);
  const stateName = stateNames.get(stateFips);
  const countyName = countyNames.get(countyFips);

  // The bundled map covers the 50 states and District of Columbia. ZIPs in
  // territories remain part of the reported unmapped count rather than being
  // assigned to an area the map cannot display.
  if (!stateName || !countyName) return null;

  return { zip, stateFips, stateName, countyFips, countyName };
}
