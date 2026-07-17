import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error(
    "Usage: node scripts/build-geography-data.mjs <tab20_zcta520_county20_natl.txt>"
  );
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(sourcePath), "utf8").replace(/^\uFEFF/, "");
const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
const headers = headerLine.split("|");
const zipIndex = headers.indexOf("GEOID_ZCTA5_20");
const countyIndex = headers.indexOf("GEOID_COUNTY_20");
const landAreaIndex = headers.indexOf("AREALAND_PART");

if ([zipIndex, countyIndex, landAreaIndex].some((index) => index < 0)) {
  throw new Error("The input does not look like the Census 2020 ZCTA-to-county file.");
}

// A ZCTA can overlap more than one county. Choose the county containing the
// largest land-area share so every ZIP-sized geography has one deterministic
// county for aggregate visualization.
const dominantCountyByZip = new Map();
for (const line of lines) {
  const values = line.split("|");
  const zip = values[zipIndex];
  const countyFips = values[countyIndex];
  if (!zip || !countyFips) continue;

  const landArea = Number(values[landAreaIndex]) || 0;
  const current = dominantCountyByZip.get(zip);
  if (!current || landArea > current.landArea) {
    dominantCountyByZip.set(zip, { countyFips, landArea });
  }
}

const lookup = Object.fromEntries(
  [...dominantCountyByZip.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zip, value]) => [zip, value.countyFips])
);

const outputPath = path.resolve("src/lib/geography/data/zip-to-county.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(lookup)}\n`);
console.log(`Wrote ${Object.keys(lookup).length} ZIP-to-county mappings to ${outputPath}`);
