/**
 * Build public/data/places.csv from CSO Built-Up Areas CSV.
 * Input:  public/data/cso_bua_2022.csv
 * Output: public/data/places.csv  (header: Town,County)
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(process.cwd(), "public", "data", "cso_bua_2022.csv");
const OUT = path.join(process.cwd(), "public", "data", "places.csv");

function title(s) { return String(s || "").toLowerCase().replace(/\b\w/g, m => m.toUpperCase()); }

function normalizeCountyLabel(raw) {
  const x = String(raw || "").trim().toLowerCase();
  const map = {
    "londonderry": "Derry",
    "derry/londonderry": "Derry",
    "co derry": "Derry",
    "queen's county": "Laois",
    "co laois": "Laois",
    "co meath": "Meath",
    "co kerry": "Kerry",
    "tipp": "Tipperary"
  };
  return map[x] || title(raw);
}

function splitCSVLine(line) { return line.split(",").map(s => s.trim()); }

function findColumnIndexes(header) {
  const H = header.map(h => h.toLowerCase());
  let town = -1, county = -1;
  H.forEach((h, i) => {
    if (town === -1 && (h.includes("sett") || h.includes("name") || h.includes("bua"))) town = i;
    if (county === -1 && h.includes("county")) county = i;
  });
  return { town, county };
}

(function main() {
  if (!fs.existsSync(SRC)) {
    console.log(`[build-places] Missing ${SRC} — skipping (ok in dev).`);
    return;
  }
  const raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/,"");
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return;

  const header = splitCSVLine(lines[0]);
  const { town: tIdx, county: cIdx } = findColumnIndexes(header);
  if (tIdx === -1 || cIdx === -1) throw new Error("Could not locate town/settlement/county columns");

  const set = new Set();
  const valid = new Set([
    "Antrim","Armagh","Carlow","Cavan","Clare","Cork","Derry","Donegal","Down","Dublin",
    "Fermanagh","Galway","Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford",
    "Louth","Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary","Tyrone",
    "Waterford","Westmeath","Wexford","Wicklow"
  ]);

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const town = (cols[tIdx] || "").trim();
    const county = normalizeCountyLabel(cols[cIdx] || "");
    if (!town || !county || !valid.has(county)) continue;
    set.add(`${town},${county}`);
  }

  const rows = Array.from(set)
    .map(s => s.split(","))
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

  const out = ["Town,County", ...rows.map(([t,c]) => `${t},${c}`)].join("\n") + "\n";
  fs.writeFileSync(OUT, out, "utf8");
  console.log(`[build-places] Wrote ${rows.length} towns to ${OUT}`);
})();
