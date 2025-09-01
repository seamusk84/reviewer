import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

// ---------- CSV helpers (supports quoted commas) ----------
function splitCSVLine(line: string): string[] {
  const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  return cells.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');
    return s;
  });
}

function parseSimpleCSV(text: string) {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift(); if (!header) return {};
  const cols = splitCSVLine(header).map((h) => h.trim().toLowerCase());
  const iCounty = cols.indexOf("county");
  const iTown = cols.indexOf("town");
  const iEstate = cols.indexOf("estate");
  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = splitCSVLine(line);
    const county = parts[iCounty]?.trim();
    const town = parts[iTown]?.trim();
    const estate = (parts[iEstate]?.trim() || "All Areas");
    if (!county || !town) continue;
    (data[county] ||= {});
    (data[county][town] ||= []);
    if (!data[county][town].includes(estate)) data[county][town].push(estate);
  }
  return data;
}

// Try to find reasonable columns in CSO file no matter the header wording
function parseCsoBUA(text: string) {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift(); if (!header) return {};
  const headers = splitCSVLine(header).map((h) => h.trim());

  // Robust header matching
  const findCol = (patterns: RegExp[]) =>
    headers.findIndex((h) => patterns.some((p) => p.test(h)));

  // Name column: handle URBAN_AREA_NAME, BUA_NAME, TOWN, SETTLEMENT, NAME, etc.
  const idxName = findCol([
    /URBAN[_ ]?AREA[_ ]?NAME/i,
    /^BUA[_ ]?NAME$/i,
    /^TOWN[_ ]?NAME$/i,
    /^SETTLEMENT[_ ]?NAME$/i,
    /URBAN[_ ]?AREA/i,
    /^NAME$/i
  ]);

  // County column: COUNTY, COUNTY_NAME, COUNTY OR CITY, LOCAL AUTHORITY
  const idxCounty = findCol([
    /^COUNTY$/i,
    /^COUNTY[_ ]?NAME$/i,
    /^COUNTY[_ ]?OR[_ ]?CITY$/i,
    /^LOCAL[_ ]?AUTHORITY$/i,
    /^LA[_ ]?NAME$/i
  ]);

  if (idxName < 0 || idxCounty < 0) {
    console.warn("[IER] CSO parse failed: headers=", headers);
    return {};
  }

  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = splitCSVLine(line);
    const town = (parts[idxName] || "").trim();
    const county = (parts[idxCounty] || "").trim();
    if (!town || !county) continue;
    (data[county] ||= {});
    (data[county][town] ||= []);
    if (!data[county][town].includes("All Areas")) data[county][town].push("All Areas");
  }
  return data;
}

function mergeData(a: any, b: any) {
  const out: Record<string, Record<string, string[]>> = JSON.parse(JSON.stringify(a || {}));
  for (const [county, towns] of Object.entries(b || {})) {
    out[county] ||= {};
    for (const [town, estates] of Object.entries(towns as Record<string, string[]>)) {
      out[county][town] ||= [];
      for (const e of estates) if (!out[county][town].includes(e)) out[county][town].push(e);
    }
  }
  return out;
}

async function tryFetch(paths: string[]) {
  for (const p of paths) {
    try {
      const r = await fetch(p);
      if (r.ok) return await r.text();
    } catch {}
  }
  return null;
}

export default function Home() {
  const router = useRouter();

  const fetchData = async () => {
    // 1) CSO towns/urban areas (Republic) — try common filenames
    let csoData: any = {};
    const csoTxt = await tryFetch([
      "/data/cso_bua_2022.csv",
      "/data/cso_bua_2022.csv.csv",
      "/data/SAPS_2022_BUA_270923.csv",
      "/data/SAPS_2022_BUA_270923.csv.csv"
    ]);
    if (csoTxt) {
      csoData = parseCsoBUA(csoTxt);
      const csoTownCount = Object.values(csoData).reduce((a, t: any) => a + Object.keys(t).length, 0);
      console.log("[IER] CSO towns loaded:", csoTownCount);
    } else {
      console.warn("[IER] Could not fetch CSO file (check filename under public/data/)");
    }

    // 2) Your custom CSV (NI + any estates)
    let customData: any = {};
    const customTxt = await tryFetch(["/data/estates.csv"]);
    if (customTxt) customData = parseSimpleCSV(customTxt);

    const merged = mergeData(csoData, customData);

    const countyCount = Object.keys(merged).length;
    const townCount = Object.values(merged).reduce((acc, t: any) => acc + Object.keys(t).length, 0);
    console.log("[IER] Loaded", countyCount, "counties,", townCount, "towns");

    return merged;
  };

  return <CascadingSearch fetchData={fetchData} onNavigate={(p) => router.push(p)} />;
}
