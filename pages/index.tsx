import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

// --- small CSV helper: splits commas outside quotes and unquotes cells
function splitCSVLine(line: string): string[] {
  const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  return cells.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
  });
}

// Parse our simple CSV (county,town,estate)
function parseSimpleCSV(text: string) {
  text = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return {};
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
    data[county] = data[county] || {};
    data[county][town] = data[county][town] || [];
    if (!data[county][town].includes(estate)) data[county][town].push(estate);
  }
  return data;
}

// Parse CSO BUA CSV (tolerant to header naming + quotes)
function parseCsoBUA(text: string) {
  text = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return {};
  const headers = splitCSVLine(header).map((h) => h.trim());
  const find = (patterns: RegExp[]) =>
    headers.findIndex((h) => patterns.some((p) => p.test(h)));

  // CSO variants seen: URBAN_AREA_NAME, BUA_NAME, URBAN AREA NAME, NAME
  const idxName = find([/URBAN[_ ]?AREA[_ ]?NAME/i, /BUA[_ ]?NAME/i, /URBAN[_ ]?AREA/i, /^NAME$/i]);
  // COUNTY or COUNTY_NAME
  const idxCounty = find([/^COUNTY$/i, /^COUNTY[_ ]?NAME$/i]);

  if (idxName < 0 || idxCounty < 0) return {};

  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = splitCSVLine(line);
    const town = (parts[idxName] || "").trim();
    const county = (parts[idxCounty] || "").trim();
    if (!town || !county) continue;
    data[county] = data[county] || {};
    data[county][town] = data[county][town] || [];
    if (!data[county][town].includes("All Areas")) data[county][town].push("All Areas");
  }
  return data;
}

// Merge two DataShapes (dedupe estates)
function mergeData(a: any, b: any) {
  const out: Record<string, Record<string, string[]>> = JSON.parse(JSON.stringify(a || {}));
  for (const [county, towns] of Object.entries(b || {})) {
    out[county] = out[county] || {};
    for (const [town, estates] of Object.entries(towns as Record<string, string[]>)) {
      out[county][town] = out[county][town] || [];
      for (const e of estates) {
        if (!out[county][town].includes(e)) out[county][town].push(e);
      }
    }
  }
  return out;
}

export default function Home() {
  const router = useRouter();

  const fetchData = async () => {
    // 1) CSO towns/urban areas (Republic)
    let csoData: any = {};
    try {
      const csoRes = await fetch("/data/cso_bua_2022.csv");
      if (csoRes.ok) {
        const txt = await csoRes.text();
        csoData = parseCsoBUA(txt);
      }
    } catch {}

    // 2) Your custom CSV (e.g., Northern Ireland + estates you add)
    let customData: any = {};
    try {
      const customRes = await fetch("/data/estates.csv");
      if (customRes.ok) {
        const txt = await customRes.text();
        customData = parseSimpleCSV(txt);
      }
    } catch {}

    return mergeData(csoData, customData);
  };

  return (
    <CascadingSearch
      fetchData={fetchData}
      onNavigate={(path) => router.push(path)}
    />
  );
}
