// pages/index.tsx
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

/** ──────────────────────────────────────────────────────────────────────────
 *  CONFIG: CSV location (served from /public)
 *  If your file is named differently, update CSV_PATH accordingly.
 *  Examples:
 *   "/data/SAPS_2022_BUA_270923.csv"  or  "/data/cso_bua_2022.csv"
 *  ────────────────────────────────────────────────────────────────────────── */
const CSV_PATH = "/data/cso_bua_2022.csv"; // change if your working file has a different name

/** A tiny CSV parser (no external deps). Handles basic CSV with quoted values. */
function parseCSV(text: string): Record<string, string>[] {
  // Normalize newlines
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 1 && cols[0] === "") continue;
    const row: Record<string, string> = {};
    header.forEach((key, idx) => (row[key] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

/** Split a CSV line respecting quotes. */
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote ("")
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Pick the first non-empty column value from a row given a list of possible header names. */
function pick(row: Record<string, string>, headers: string[]): string | undefined {
  for (const h of headers) {
    const k = Object.keys(row).find((x) => x.trim().toLowerCase() === h.trim().toLowerCase());
    if (k && row[k] && row[k].trim()) return row[k].trim();
  }
  return undefined;
}

// Column name variants commonly seen in CSO files:
const COUNTY_COLS = ["County", "County Name", "CountyName", "COUNTY"];
const TOWN_COLS = ["Settlement", "Settlement Name", "Town", "Town Name", "SETTLEMENT"];
const ESTATE_COLS = [
  "Estate",
  "Small Area",
  "Small Area Name",
  "SA Name",
  "Townland",
  "Locality",
  "SMALL_AREA",
  "TOWNLAND",
];

type Row = { county: string; town: string; estate?: string };

/** Reusable filterable select (value ≠ query; caret opens full list). */
function FilterSelect(props: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: number;
}) {
  const { label, options, value, onChange, placeholder = "Start typing…", disabled, minWidth = 320 } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const openList = () => {
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth }}>
      <label style={{ display: "block", marginBottom: 6 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          disabled={disabled}
          placeholder={value || placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) openList();
          }}
          autoComplete="off"
          style={{ width: "100%", paddingRight: 36 }}
        />
        <button
          type="button"
          aria-label={open ? "Hide options" : "Show all options"}
          disabled={disabled}
          onClick={() => {
            if (open) setOpen(false);
            else openList(); // opening clears filter so full list shows
          }}
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            border: "none",
            background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 6,
          }}
        >
          ▾
        </button>
      </div>

      {open && !disabled && (
        <ul
          style={{
            position: "absolute",
            zIndex: 20,
            marginTop: 4,
            maxHeight: 240,
            overflowY: "auto",
            width: "100%",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            listStyle: "none",
            padding: 0,
          }}
        >
          {filtered.length ? (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setQuery("");
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {opt}
                </button>
              </li>
            ))
          ) : (
            <li style={{ padding: "8px 12px", color: "#666" }}>No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [estate, setEstate] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Try primary path. If it 404s, fall back to a common previous name.
        const candidates = [CSV_PATH, "/data/SAPS_2022_BUA_270923.csv"];
        let text = "";
        let ok = false;
        for (const url of candidates) {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            text = await res.text();
            ok = true;
            break;
          }
        }
        if (!ok) throw new Error(`CSV not found at ${candidates.join(" or ")}`);

        const raw = parseCSV(text);
        // Map to our normalized Row shape
        const mapped: Row[] = raw
          .map((r) => {
            const c = pick(r, COUNTY_COLS) || "";
            const t = pick(r, TOWN_COLS) || "";
            const e = pick(r, ESTATE_COLS);
            return { county: c, town: t, estate: e };
          })
          .filter((r) => r.county && r.town); // at least county + town

        // De-duplicate exact rows
        const seen = new Set<string>();
        const uniq = mapped.filter((r) => {
          const key = `${r.county}||${r.town}||${r.estate ?? ""}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (!cancelled) setRows(uniq);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counties = useMemo(
    () => Array.from(new Set(rows.map((r) => r.county))).sort(),
    [rows]
  );

  const towns = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((r) => !county || r.county === county)
            .map((r) => r.town)
        )
      ).sort(),
    [rows, county]
  );

  const estates = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter(
              (r) => (!county || r.county === county) && (!town || r.town === town)
            )
            .map((r) => r.estate)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [rows, county, town]
  );

  return (
    <>
      <Head>
        <title>StreetSage</title>
        <meta name="description" content="Local Views, True Reviews" />
      </Head>

      {/* Keep your global header/layout outside of this page.
          This page only renders the form content. */}
      <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
        <h1 style={{ marginBottom: 8 }}>Find your estate</h1>
        <p style={{ marginBottom: 24 }}>
          Drill down by <strong>County</strong> → <strong>Town/Region</strong> → <strong>Estate/Area</strong>.
        </p>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            border: "1px solid #e8e6ef",
            boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
            padding: 24,
          }}
        >
          {loading && <p>Loading data…</p>}
          {error && (
            <p style={{ color: "crimson" }}>
              {error}
              <br />
              <small>Check the CSV path in <code>CSV_PATH</code> and that the file contains real data.</small>
            </p>
          )}

          {!loading && !error && (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <FilterSelect
                label="County"
                options={counties}
                value={county}
                onChange={(val) => {
                  setCounty(val);
                  setTown("");
                  setEstate("");
                }}
                placeholder="Start typing a county…"
              />

              <FilterSelect
                label="Town / Region"
                options={towns}
                value={town}
                onChange={(val) => {
                  setTown(val);
                  setEstate("");
                }}
                placeholder="Start typing a town…"
                disabled={!county}
              />

              <FilterSelect
                label="Estate / Area"
                options={estates}
                value={estate}
                onChange={setEstate}
                placeholder="Select an estate/area…"
                disabled={!town}
              />
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #d7d4e5",
                background: "#f5f3ff",
                cursor: "pointer",
              }}
              onClick={() => {
                // Hook up to your navigation / search action as needed
                console.log({ county, town, estate });
                alert(
                  `Search:\nCounty: ${county || "(any)"}\nTown: ${town || "(any)"}\nEstate: ${estate || "(any)"}`
                );
              }}
              disabled={!county}
            >
              Search
            </button>
            <span style={{ marginLeft: 12, color: "#6b677a" }}>
              Tip: choose <em>All Areas</em> to review the whole town.
            </span>
          </div>
        </div>
      </main>
    </>
  );
}
