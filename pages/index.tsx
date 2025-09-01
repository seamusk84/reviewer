import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

// Parse our simple CSV (county,town,estate)
function parseSimpleCSV(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return {};
  const cols = header.split(",").map(h => h.trim().toLowerCase());
  const iCounty = cols.indexOf("county");
  const iTown = cols.indexOf("town");
  const iEstate = cols.indexOf("estate");
  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(",");
    const county = parts[iCounty]?.trim();
    const town = parts[iTown]?.trim();
    const estate = parts[iEstate]?.trim() || "All Areas";
    if (!county || !town) continue;
    data[county] = data[county] || {};
    data[county][town] = data[county][town] || [];
    if (!data[county][town].includes(estate)) data[county][town].push(estate);
  }
  return data;
}

// Parse CSO BUA CSV (tolerant to header naming)
function parseCsoBUA(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return {};
  const headers = header.split(",").map(h => h.trim());
  const find = (patterns: RegExp[]) =>
    headers.findIndex(h => patterns.some(p => p.test(h)));
  const idxName = find([/URBAN[_ ]?AREA[_ ]?NAME/i, /BUA[_ ]?NAME/i, /URBAN[_ ]?AREA/i, /NAME/i]);
  const idxCounty = find([/^COUNTY$/i, /COUNTY[_ ]?NAME/i]);
  if (idxName < 0 || idxCounty < 0) return {};

  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    if (!line) continue;
    // NOTE: CSO names rarely contain commas; if we ever hit quoted commas we can swap to PapaParse.
    const parts = line.split(",");
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
    for (const [town, estates] of Object.entries(towns || {})) {
      out[county][town] = out[county][town] || [];
      for (const e of estates as string[]) {
        if (!out[county][town].includes(e)) out[county][town].push(e);
      }
    }
  }
  return out;
}

export default function Home() {
  const router = useRouter();

  const fetchData = async () => {
    // 1) Try the CSO BUAs (Republic of Ireland, 867 towns/urban areas)
    let csoData: any = {};
    try {
      const csoRes = await fetch("/data/cso_bua_2022.csv");
      if (csoRes.ok) {
        const txt = await csoRes.text();
        csoData = parseCsoBUA(txt);
      }
    } catch {}

    // 2) Merge anything you keep in estates.csv (e.g., NI towns or custom estates)
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
