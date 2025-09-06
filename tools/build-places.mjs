// tools/build-places.mjs
// Build public/data/places.csv from CSO towns + OSM estates (Overpass).
// Usage (GitHub Actions uses env):
//   ONLY_COUNTIES="Dublin,Kildare" node tools/build-places.mjs
//   MAX_TOWNS=200 node tools/build-places.mjs   // limit for testing

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CSO_IN = path.join(ROOT, "public", "data", "cso_bua_2022.csv");
const CUSTOM_ESTATES = path.join(ROOT, "public", "data", "estates.csv");
const OUT = path.join(ROOT, "public", "data", "places.csv");

// politeness to Overpass
const SLEEP_MS = Number(process.env.SLEEP_MS || 1500);
const ONLY = (process.env.ONLY_COUNTIES || "").split(",").map(s => s.trim()).filter(Boolean);
const MAX_TOWNS = Number(process.env.MAX_TOWNS || 0);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function splitCSVLine(line) {
  const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  return cells.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');
    return s;
  });
}

async function readCSV(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    const lines = txt.trim().split(/\r?\n/);
    const header = splitCSVLine(lines.shift() || "");
    return lines.map(l => {
      const cols = splitCSVLine(l);
      const obj = {};
      header.forEach((h,i) => obj[h] = cols[i] ?? "");
      return obj;
    });
  } catch {
    return null;
  }
}

function normalizeTownRows(rows) {
  if (!rows) return [];
  // Find header indices by regex
  const keys = Object.keys(rows[0] || {});
  const find = (patterns) => keys.find(k => patterns.some(p => p.test(k))) || "";
  const nameKey   = find([/URBAN[_ ]?AREA[_ ]?NAME/i, /BUA[_ ]?NAME/i, /URBAN[_ ]?AREA/i, /^NAME$/i]);
  const countyKey = find([/^COUNTY$/i, /^COUNTY[_ ]?NAME$/i, /County/i]);
  if (!nameKey || !countyKey) return [];

  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const county = String(r[countyKey] || "").trim();
    const town   = String(r[nameKey] || "").trim();
    if (!county || !town) continue;
    const key = `${county}|${town}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ county, town });
  }
  return out.sort((a,b)=> a.county.localeCompare(b.county) || a.town.localeCompare(b.town));
}

async function fetchOverpass(query) {
  const body = new URLSearchParams({ data: query }).toString();
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type":"application/x-www-form-urlencoded" },
    body
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  return r.json();
}

// Use geocodeArea to find the town area, then pull estates within
function overpassQuery(town, county) {
  // We search inside the geocoded town area, restricted to the named county for precision.
  // Estates: suburb/neighbourhood/quarter + named residential landuse.
  return `
[out:json][timeout:60];
{{geocodeArea:${town}, ${county}, Ireland}}->.town;
(
  nwr["place"~"suburb|neighbourhood|quarter"](area.town);
  nwr["landuse"="residential"]["name"](area.town);
);
out center tags;
`.trim();
}

function mapOverpassToEstates(json, town, county) {
  const elems = Array.isArray(json?.elements) ? json.elements : [];
  const names = [];
  for (const e of elems) {
    const t = e.tags || {};
    const name = (t.name || "").trim();
    if (!name) continue;
    // Skip exact town name as an "estate"
    if (name.toLowerCase() === town.toLowerCase()) continue;
    // coords
    let lat = "", lng = "";
    if (typeof e.lat === "number" && typeof e.lon === "number") {
      lat = String(e.lat); lng = String(e.lon);
    } else if (e.center && typeof e.center.lat === "number") {
      lat = String(e.center.lat); lng = String(e.center.lon);
    }
    names.push({ county, town, estate: name.replace(/,/g," "), lat, lng, source: "OSM", notes: "" });
  }
  // dedupe by estate name
  const seen = new Set();
  const uniq = [];
  for (const n of names.sort((a,b)=> a.estate.localeCompare(b.estate))) {
    const key = n.estate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(n);
  }
  return uniq;
}

async function main() {
  // 1) Load CSO towns
  const csoRows = await readCSV(CSO_IN);
  if (!csoRows) {
    console.error(`Missing ${CSO_IN}. Please keep CSO file in public/data.`);
    process.exit(1);
  }
  let towns = normalizeTownRows(csoRows);
  if (ONLY.length) {
    const set = new Set(ONLY.map(s=>s.toLowerCase()));
    towns = towns.filter(t => set.has(t.county.toLowerCase()));
  }
  if (MAX_TOWNS > 0) towns = towns.slice(0, MAX_TOWNS);
  console.log(`Towns to process: ${towns.length} ${ONLY.length ? `(filtered by counties: ${ONLY.join(", ")})` : ""}`);

  // 2) Load custom estates (optional) to merge later
  const customRows = await readCSV(CUSTOM_ESTATES);
  const custom = [];
  if (customRows) {
    const keys = Object.keys(customRows[0] || {});
    const iCounty = keys.find(k => /^county$/i.test(k));
    const iTown   = keys.find(k => /^town$/i.test(k));
    const iEstate = keys.find(k => /^estate$/i.test(k));
    for (const r of customRows) {
      const county = String(r[iCounty] || "").trim();
      const town   = String(r[iTown] || "").trim();
      const estate = String(r[iEstate] || "").trim();
      if (!county || !town || !estate) continue;
      custom.push({ county, town, estate, lat: "", lng: "", source: "CUSTOM", notes: "" });
    }
  }

  // 3) Build dataset: CSO "All Areas" + OSM estates per town
  const rows = [];
  const seenKey = new Set();

  // CSO "All Areas" baseline
  for (const t of towns) {
    const key = `${t.county}|${t.town}|all areas`.toLowerCase();
    if (!seenKey.has(key)) {
      seenKey.add(key);
      rows.push({ county: t.county, town: t.town, estate: "All Areas", lat:"", lng:"", source:"CSO", notes:"" });
    }
  }

  // OSM estates
  let idx = 0;
  for (const t of towns) {
    idx++;
    const q = overpassQuery(t.town, t.county);
    try {
      const json = await fetchOverpass(q);
      const estates = mapOverpassToEstates(json, t.town, t.county);
      for (const e of estates) {
        const key = `${e.county}|${e.town}|${e.estate}`.toLowerCase();
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        rows.push(e);
      }
      console.log(`✓ ${t.town}, ${t.county}: +${estates.length} estates  (${idx}/${towns.length})`);
    } catch (err) {
      console.warn(`⚠ ${t.town}, ${t.county}: ${String(err)}`);
    }
    await sleep(SLEEP_MS); // be polite to Overpass
  }

  // Merge customs
  for (const e of custom) {
    const key = `${e.county}|${e.town}|${e.estate}`.toLowerCase();
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    rows.push(e);
  }

  // 4) Sort & write CSV
  rows.sort((a,b)=>
    a.county.localeCompare(b.county) ||
    a.town.localeCompare(b.town) ||
    a.estate.localeCompare(b.estate)
  );

  let out = "county,town,estate,lat,lng,source,notes\n";
  for (const r of rows) {
    out += `${r.county},${r.town},${r.estate},${r.lat},${r.lng},${r.source},${r.notes}\n`;
  }
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, out, "utf8");
  console.log(`Wrote ${OUT} with ${rows.length} rows.`);
}

main().catch(e => { console.error(e); process.exit(1); });
