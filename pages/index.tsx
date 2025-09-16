// pages/index.tsx
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

/** CSV sources (served from /public). Put your preferred source first. */
const CSV_CANDIDATES = [
  "/data/places.csv",
  "/data/SAPS_2022_BUA_270923.csv",
  "/data/cso_bua_2022.csv",
  "/data/estates.csv",
];

/* -------------------- CSV parsing (no external deps) -------------------- */
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
function pick(row: Record<string, string>, names: string[]): string | undefined {
  const low: Record<string, string> = {};
  for (const k of Object.keys(row)) low[k.trim().toLowerCase()] = row[k];
  for (const n of names) {
    const v = low[n.trim().toLowerCase()];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/* -------------------- Column variants you use -------------------- */
const COUNTY_COLS = ["county", "county name", "countyname", "COUNTY"];
const TOWN_COLS = ["settlement", "settlement name", "town", "town name", "region", "place_name", "SETTLEMENT"];
const ESTATE_COLS = [
  "estate",
  "small area",
  "small area name",
  "sa name",
  "townland",
  "locality",
  "area",
  "estate/area",
  "place",
  "SMALL_AREA",
  "TOWNLAND",
];

type Row = { county: string; town: string; estate?: string };

/* -------------------- Pretty, filterable select -------------------- */
function FilterSelect(props: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { label, options, value, onChange, placeholder = "Start typing…", disabled } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [menuW, setMenuW] = useState<number | undefined>(undefined);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => setMenuW(wrapRef.current!.getBoundingClientRect().width));
    obs.observe(wrapRef.current);
    setMenuW(wrapRef.current.getBoundingClientRect().width);
    return () => obs.disconnect();
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

  const inputBase = {
    width: "100%",
    padding: "12px 42px 12px 14px",
    borderRadius: 12,
    border: "1px solid #e7e4f3",
    background: "#fbfaff",
    outline: "none",
    fontSize: 15,
    color: "#1f1b2d",
  } as const;

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <label style={{ display: "block", marginBottom: 8, color: "#3b3355", fontWeight: 700 }}>{label}</label>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <input
          type="text"
          disabled={disabled}
          placeholder={value || placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => !disabled && openList()}
          autoComplete="off"
          style={{
            ...inputBase,
            cursor: disabled ? "not-allowed" : "text",
            borderColor: open ? "#d6d0f0" : "#e7e4f3",
            boxShadow: open ? "0 0 0 6px rgba(136, 79, 255, 0.08)" : "none",
          }}
        />
        <button
          type="button"
          aria-label={open ? "Hide options" : "Show all options"}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            height: 30,
            width: 30,
            borderRadius: 10,
            border: "1px solid #e7e4f3",
            background: "#fff",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 14,
            color: "#544a78",
          }}
        >
          ▾
        </button>
      </div>

      {open && !disabled && (
        <ul
          style={{
            position: "absolute",
            zIndex: 30,
            marginTop: 8,
            maxHeight: 300,
            overflowY: "auto",
            width: menuW ?? "100%",
            background: "white",
            border: "1px solid #ece8f8",
            borderRadius: 14,
            boxShadow: "0 24px 48px rgba(27, 16, 73, 0.12)",
            listStyle: "none",
            padding: 8,
          }}
        >
          {filtered.length ? (
            filtered.map((opt) => (
              <li key={opt} style={{ margin: 2 }}>
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
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#231f36",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={(e) => ((e.currentTarget.style.backgroundColor = "#f6f3ff"))}
                  onMouseLeave={(e) => ((e.currentTarget.style.backgroundColor = "transparent"))}
                >
                  {opt}
                </button>
              </li>
            ))
          ) : (
            <li style={{ padding: "10px 12px", color: "#7c7692", fontSize: 14 }}>No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

/* -------------------- Minimal news strip -------------------- */
type NewsItem = { source: "RTE" | "Irish Times" | "Irish Independent"; title: string; link: string; pubDate?: string };

function NewsStrip() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const r = await fetch("/api/news", { cache: "no-store" });
        const j = (await r.json()) as { items?: NewsItem[] };
        if (!stop && Array.isArray(j.items)) setItems(j.items);
      } catch {
        // ignore
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;

  const current = items[idx];

  return (
    <section
      aria-label="Irish news"
      style={{
        marginTop: 28,
        background: "linear-gradient(180deg, #ffffff 0%, #faf8ff 100%)",
        border: "1px solid #eeeafc",
        borderRadius: 14,
        padding: "10px 14px",
        boxShadow: "0 10px 28px rgba(31,22,78,0.06)",
      }}
    >
      <div style={{ fontSize: 12, color: "#6e6890", marginBottom: 6 }}>Irish news • RTÉ · Irish Times · Irish Independent</div>
      <a
        href={current.link}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          fontWeight: 700,
          textDecoration: "none",
          color: "#2a2359",
        }}
      >
        {current.title}
      </a>
      <span style={{ marginLeft: 8, color: "#7d7696" }}>— {current.source}</span>
    </section>
  );
}

/* -------------------- Page -------------------- */
export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [county, setCounty] = useState("");
  const [region, setRegion] = useState(""); // renamed (was town)
  const [estate, setEstate] = useState("");

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
          if (quick.length > 0) {
            text = t;
            break;
          }
        }
        if (!text) throw new Error(`No usable CSV found at: ${CSV_CANDIDATES.join(", ")}`);

        const raw = parseCSV(text);
        const mapped: Row[] = raw
          .map((r) => {
            const c = pick(r, COUNTY_COLS) || "";
            const t = pick(r, TOWN_COLS) || ""; // still read town/settlement from CSV
            const e = pick(r, ESTATE_COLS);
            return { county: c, town: t, estate: e };
          })
          .filter((r) => r.county && r.town);

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

  // Derived option lists
  const counties = useMemo(
    () => Array.from(new Set(rows.map((r) => r.county))).sort(),
    [rows]
  );
  const regions = useMemo(
    () =>
      Array.from(
        new Set(rows.filter((r) => !county || r.county === county).map((r) => r.town))
      ).sort(),
    [rows, county]
  );
  const estates = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((r) => (!county || r.county === county) && (!region || r.town === region))
            .map((r) => r.estate)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [rows, county, region]
  );

  return (
    <>
      <Head>
        <title>StreetSage</title>
        <meta name="description" content="Local Views, True Reviews" />
      </Head>

      {/* Background layer */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(1200px 600px at 10% -10%, #efeaff 10%, transparent 60%), radial-gradient(800px 400px at 100% 0%, #f7f3ff 10%, transparent 60%), #f7f7fb",
          zIndex: -1,
        }}
      />

      <main style={{ maxWidth: 1120, margin: "2.4rem auto 3.2rem", padding: "0 1rem" }}>
        {/* Hero */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              aria-hidden
              style={{
                height: 36,
                width: 36,
                borderRadius: 12,
                background: "linear-gradient(140deg, #8b5cf6, #a78bfa)",
                display: "grid",
                placeItems: "center",
                color: "white",
                boxShadow: "0 6px 14px rgba(139, 92, 246, 0.35)",
                fontSize: 18,
              }}
            >
              🏠
            </div>
            <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: 0, letterSpacing: 0.2 }}>
              Rate and See Towns and Estates nationwide
            </h1>
          </div>
          <p style={{ color: "#4a4560", margin: 0 }}>
            Drill down by <strong>County</strong> → <strong>Region</strong> → <strong>Estate / Town</strong>.
          </p>
        </section>

        {/* Card */}
        <section
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fefcff 100%)",
            borderRadius: 18,
            border: "1px solid #eeeafc",
            boxShadow: "0 14px 36px rgba(31, 22, 78, 0.08)",
            padding: 22,
          }}
        >
          {loading && <p style={{ margin: 0 }}>Loading data…</p>}
          {error && (
            <p style={{ color: "crimson", margin: 0 }}>
              {error}
              <br />
              <small>Ensure a CSV with county/region (town/settlement) and optionally estate exists under <code>/public/data</code>.</small>
            </p>
          )}

          {!loading && !error && (
            <>
              {/* Responsive grid: 1 → 2 → 3 columns */}
              <style>{`
                @media (min-width: 740px) { .grid-areas { grid-template-columns: 1fr 1fr; } }
                @media (min-width: 980px) { .grid-areas { grid-template-columns: 1fr 1fr 1fr; } }
              `}</style>

              <div className="grid-areas" style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }}>
                <FilterSelect
                  label="County"
                  options={counties}
                  value={county}
                  onChange={(val) => {
                    setCounty(val);
                    setRegion("");
                    setEstate("");
                  }}
                  placeholder="Start typing a county…"
                />
                <FilterSelect
                  label="Region"
                  options={regions}
                  value={region}
                  onChange={(val) => {
                    setRegion(val);
                    setEstate("");
                  }}
                  placeholder="Start typing a region…"
                  disabled={!county}
                />
                <FilterSelect
                  label="Estate / Town"
                  options={estates}
                  value={estate}
                  onChange={setEstate}
                  placeholder="Select an estate or town…"
                  disabled={!region}
                />
              </div>

              {/* Action + helper */}
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1px solid #e2def2",
                    background: "linear-gradient(180deg, #f6f3ff, #efe9ff)",
                    cursor: county ? "pointer" : "not-allowed",
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    alert(
                      `Search:\nCounty: ${county || "(any)"}\nRegion: ${region || "(any)"}\nEstate/Town: ${estate || "(any)"}`
                    );
                  }}
                  disabled={!county}
                >
                  Search
                </button>
                <span style={{ color: "#6b677a" }}>
                  Tip: choose <em>All Areas</em> to review the whole region.
                </span>
              </div>
            </>
          )}
        </section>

        {/* News strip fills the lower whitespace */}
        <NewsStrip />

        {/* Footer */}
        <footer style={{ marginTop: 28, textAlign: "center", color: "#726c8a", fontSize: 13 }}>
          Local Views, <strong>True Reviews</strong> · StreetSage
        </footer>
      </main>
    </>
  );
}
