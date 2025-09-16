// pages/area.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

/** CSV sources (served from /public). Put your preferred source first. */
const CSV_CANDIDATES = [
  "/data/places.csv",
  "/data/SAPS_2022_BUA_270923.csv",
  "/data/cso_bua_2022.csv",
  "/data/estates.csv",
];

/* -------------------- CSV helpers -------------------- */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  if (header.length <= 1) return [];
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 1 && cols[0].trim() === "") continue;
    const row: Record<string, string> = {};
    header.forEach((key, idx) => (row[key] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function pick(row: Record<string, string>, names: string[]): string | undefined {
  const low: Record<string, string> = {};
  for (const k of Object.keys(row)) low[k.trim().toLowerCase()] = row[k];
  for (const n of names) {
    const v = low[n.trim().toLowerCase()];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

const COUNTY_COLS = ["county", "county name", "countyname", "COUNTY"];
const TOWN_COLS = ["settlement", "settlement name", "town", "town name", "region", "place_name", "SETTLEMENT"];
const ESTATE_COLS = [
  "estate", "small area", "small area name", "sa name", "townland", "locality",
  "area", "estate/area", "place", "SMALL_AREA", "TOWNLAND",
];

type Row = { county: string; town: string; estate?: string };

export default function AreaPage() {
  const { query, replace } = useRouter();
  const county = (query.county as string) || "";
  const region = (query.region as string) || "";
  const estate = (query.estate as string) || ""; // optional

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        let text = "";
        for (const url of CSV_CANDIDATES) {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const t = await res.text();
          const quick = parseCSV(t);
          if (quick.length > 0) { text = t; break; }
        }
        if (!text) throw new Error(`No usable CSV found at: ${CSV_CANDIDATES.join(", ")}`);

        const raw = parseCSV(text);
        const mapped: Row[] = raw
          .map((r) => {
            const c = pick(r, COUNTY_COLS) || "";
            const t = pick(r, TOWN_COLS) || "";
            const e = pick(r, ESTATE_COLS);
            return { county: c, town: t, estate: e };
          })
          .filter((r) => r.county && r.town);

        if (!cancelled) setRows(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const estatesInRegion = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((r) => (!county || r.county === county) && (!region || r.town === region))
            .map((r) => (r.estate ?? "").trim())
            .filter(Boolean)
        )
      ).sort(),
    [rows, county, region]
  );

  const validRegion = useMemo(
    () => rows.some((r) => (!county || r.county === county) && (!region || r.town === region)),
    [rows, county, region]
  );

  // ✅ Only validate/remove the estate AFTER loading (fixes your issue)
  useEffect(() => {
    if (loading) return; // wait until we have data
    if (!estate) return;
    if (!estatesInRegion.includes(estate)) {
      const q: Record<string, string> = {};
      if (county) q.county = county;
      if (region) q.region = region;
      replace({ pathname: "/area", query: q }, undefined, { shallow: true });
    }
  }, [loading, estate, estatesInRegion, county, region, replace]);

  const hasSpecificEstate = !!estate && estatesInRegion.includes(estate);

  return (
    <>
      <Head>
        <title>{hasSpecificEstate ? `${estate} – StreetSage` : `${region || county} – StreetSage`}</title>
      </Head>

      <main style={{ maxWidth: 1100, margin: "2rem auto", padding: "0 1rem" }}>
        <nav style={{ fontSize: 13, color: "#6c6788", marginBottom: 8 }}>
          <span>Home</span> · <span>{county || "All counties"}</span> · <span>{region || "All regions"}</span>
          {hasSpecificEstate ? <> · <strong>{estate}</strong></> : null}
        </nav>

        <h1 style={{ margin: "0 0 6px" }}>
          {hasSpecificEstate ? estate : region || county || "Browse areas"}
        </h1>
        <p style={{ marginTop: 0, color: "#4a4560" }}>
          {hasSpecificEstate
            ? <>County: <strong>{county}</strong> · Region: <strong>{region}</strong></>
            : "Choose an estate to read and write reviews."}
        </p>

        {loading && <p>Loading…</p>}
        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {!loading && !error && (
          <>
            {!hasSpecificEstate ? (
              estatesInRegion.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 16 }}>
                  {estatesInRegion.map((e) => {
                    const href = `/area?county=${encodeURIComponent(county)}&region=${encodeURIComponent(region)}&estate=${encodeURIComponent(e)}`;
                    return (
                      <a
                        key={e}
                        href={href}
                        style={{
                          display: "block",
                          padding: "12px 14px",
                          background: "#fff",
                          border: "1px solid #eeeafc",
                          borderRadius: 12,
                          boxShadow: "0 8px 18px rgba(31,22,78,0.06)",
                          textDecoration: "none",
                          color: "#2c254a",
                          fontWeight: 600,
                        }}
                      >
                        {e}
                        <div style={{ fontSize: 12, color: "#7a7396", marginTop: 4 }}>Open reviews</div>
                      </a>
                    );
                  })}
                </div>
              ) : validRegion ? (
                <p style={{ marginTop: 16 }}>No estates were found for this selection.</p>
              ) : (
                <p style={{ marginTop: 16 }}>That region wasn’t found. Try going back and choosing a different one.</p>
              )
            ) : (
              <section
                style={{
                  marginTop: 16,
                  background: "linear-gradient(180deg, #ffffff 0%, #fefcff 100%)",
                  border: "1px solid #eeeafc",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 12px 28px rgba(31,22,78,0.08)",
                }}
              >
                <h2 style={{ marginTop: 0 }}>Reviews</h2>

                {/* Placeholder until your review backend is connected */}
                <div
                  style={{
                    padding: 16,
                    background: "#faf8ff",
                    border: "1px dashed #ddd6f5",
                    borderRadius: 12,
                    color: "#4a4560",
                  }}
                >
                  <strong>No reviews yet.</strong> Be the first to add a review!
                </div>

                <div style={{ marginTop: 14 }}>
                  <a
                    href="#add-review"
                    onClick={(e) => { e.preventDefault(); alert("Review form coming soon."); }}
                    style={{
                      display: "inline-block",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #e2def2",
                      background: "linear-gradient(180deg, #f6f3ff, #efe9ff)",
                      fontWeight: 700,
                      textDecoration: "none",
                      color: "#2c254a",
                    }}
                  >
                    Add a review
                  </a>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
