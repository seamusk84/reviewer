/**
 * Build public/data/places.csv from CSO Built-Up Areas CSV.
 * Input:  public/data/cso_bua_2022.csv   (already in repo)
 * Output: public/data/places.csv         with header: Town,County
 *
 * The script is resilient to header variations:
 *  - Town/Settlement name column: includes one of ["name","sett","bua"]
 *  - County column: includes "county"
 * It also normalises county names (Derry/Londonderry, etc.), trims, dedupes, sorts.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(process.cwd(), "public", "data", "cso_bua_2022.csv");
const OUT = path.join(process.cwd(), "public", "data", "places.csv");

// County normaliser to align with our UI slugs
function normalizeCountyLabel(raw) {
  if (!raw) return "";
  const x = String(raw).trim().toLowerCase();
  const map = {
    "londonderry": "Derry",
    "derry/londonderry": "Derry",
    "co derry": "Derry",
    "queen's county": "Laois",
    "co laois": "Laois",
    "co meath": "Meath",
    "co kerry": "Kerry",
    "tipp": "Tipperary",
  };
  if (map[x]) return map[x];
  // Title case the rest
  return x.replace(/\b\w/g, (m) => m.toUpperCase());
}

// ultra-simple CSV splitter (assumes no quoted commas in this file; CSO BUA doesn’t use them for names)
function splitCSVLine(line) {
  return line.split(",").map((s) => s.trim());
}

function findColumnIndexes(header) {
  const idx = { town: -1, county: -1 };
  const H = header.map((h) => h.toLowerCase());
  H.forEach((h, i) => {
    if (idx.town === -1 && (h.includes("sett") || h.includes("name") || h.includes("bua"))) idx.town = i;
    if (idx.county === -1 && h.includes("county")) idx.county = i;
  });
  return idx;
}

(function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[build-places] Missing ${SRC}. Add the CSO file first.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    console.error("[build-places] Source has no rows.");
    process.exit(1);
  }

  const header = splitCSVLine(lines[0]);
  const { town: townIdx, county: countyIdx } = findColumnIndexes(header);

  if (townIdx === -1 || countyIdx === -1) {
    console.error("[build-places] Could not locate town/settlement or county column in header:", header);
    process.exit(1);
  }

  const set = new Set(); // "Town,County"
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const town = (cols[townIdx] || "").trim();
    let county = (cols[countyIdx] || "").trim();
    if (!town || !county) continue;

    county = normalizeCountyLabel(county);
    // Drop non-32 counties if present (optional)
    const validCounties = new Set([
      "Antrim","Armagh","Carlow","Cavan","Clare","Cork","Derry","Donegal","Down","Dublin",
      "Fermanagh","Galway","Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford",
      "Louth","Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary","Tyrone",
      "Waterford","Westmeath","Wexford","Wicklow",
    ]);
    if (!validCounties.has(county)) continue;

    const key = `${town},${county}`;
    set.add(key);
  }

  const rows = Array.from(set)
    .map((s) => s.split(","))
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

  const out = ["Town,County", ...rows.map(([t, c]) => `${t},${c}`)].join("\n") + "\n";
  fs.writeFileSync(OUT, out, "utf8");

  console.log(`[build-places] Wrote ${rows.length} towns to ${OUT}`);
})();
