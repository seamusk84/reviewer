// pages/index.tsx
import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

// --- CSV helpers (handles quotes / commas safely)
function splitCSVLine(line: string): string[] {
  const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  return cells.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');
    return s;
  });
}

// Parse simple CSV header: county,town,estate
function parseSimpleCSV(text: string) {
  text = text.replace(/^\uFEFF/, "");
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

// Parse CSO BUA CSV (tolerant to header naming)
function parseCsoBUA(text: string) {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return {};
  const headers = splitCSVLine(header).map((h) => h.trim());
  const find = (patterns: RegExp[]) => headers.findIndex((h) => patterns.some((p) => p.test(h)));
  const idxName = find([/URBAN[_ ]?AREA[_ ]?NAME/i, /BUA[_ ]?NAME/i, /URBAN[_ ]?AREA/i, /^NAME$/i]);
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
    // 1) Preferred: single combined file
    try {
      const r = await fetch("/data/places.csv", { cache: "no-cache" });
      if (r.ok) {
        const txt = await r.text();
        const d = parseSimpleCSV(txt);
        const c = Object.keys(d).length;
        const t = Object.values(d).reduce((acc, v) => acc + Object.keys(v).length, 0);
        console.log("[IER] Loaded", c, "counties,", t, "towns (places.csv)");
        return d;
      }
    } catch {}

    // 2) Fallback: CSO towns + custom estates.csv
    let cso: any = {};
    try {
      const rr = await fetch("/data/cso_bua_2022.csv", { cache: "no-cache" });
      if (rr.ok) cso = parseCsoBUA(await rr.text());
    } catch {}
    let custom: any = {};
    try {
      const rr = await fetch("/data/estates.csv", { cache: "no-cache" });
      if (rr.ok) custom = parseSimpleCSV(await rr.text());
    } catch {}

    const merged = mergeData(cso, custom);
    const c = Object.keys(merged).length;
    const t = Object.values(merged).reduce((acc, v) => acc + Object.keys(v).length, 0);
    console.log("[IER] Loaded", c, "counties,", t, "towns (fallback)");
    return merged;
  };

  return (
    <>
      <h1 className="page-title">Discover estates across Ireland</h1>
      <p className="page-sub">
        Read and share honest reviews — choose a <strong>County</strong>, then <strong>Town/Region</strong>, then <strong>Estate/Area</strong>.
      </p>

      <CascadingSearch
        fetchData={fetchData}
        onNavigate={(path) => router.push(path)}
      />
    </>
  );
}
