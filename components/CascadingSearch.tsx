import React, { useMemo, useState, useEffect, useRef } from "react";

type DataShape = Record<string, Record<string, string[]>>;

const DEFAULT_DATA: DataShape = {
  Kildare: {
    Celbridge: [
      "The Grove",
      "Castletown",
      "Simmonstown Manor",
      "Chelmsford",
      "Beatty Park",
      "Wolfe Tone Park",
      "Primrose Gate",
      "Oldtown Mill",
      "Thornhill Meadows",
      "Aghards",
    ],
    Naas: ["Oldtown Demesne", "Monread", "Osberstown"],
  },
  Dublin: {
    "Dublin 8": ["Portobello", "Rialto", "The Coombe"],
    Swords: ["Ridgewood", "Applewood", "Boroimhe"],
  },
  Cork: {
    Ballincollig: ["Old Quarter", "Greenfields"],
    Douglas: ["Grange", "Donnybrook"],
  },
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function rankedAlphabeticalFilter(list: string[], query: string, fuzzy = true): string[] {
  if (!query) return [...list].sort((a, b) => a.localeCompare(b));
  const q = norm(query);
  const base = list.map((item) => {
    const n = norm(item);
    const i = n.indexOf(q);
    const prefix = i === 0;
    const contains = i > 0;
    let lev = Infinity;
    if (fuzzy) {
      const qShort = q.slice(0, 32);
      const nShort = n.slice(0, 64);
      lev = levenshtein(qShort, nShort);
    }
    const rank = prefix ? 0 : contains ? 1 : 2;
    const score = prefix ? i : contains ? i : lev;
    return { item, rank, score, lev };
  });
  const filtered = base.filter((x) => x.rank < 2 || x.lev <= Math.ceil(q.length * 0.5));
  return filtered
    .sort((a, b) => a.rank - b.rank || a.score - b.score || a.item.localeCompare(b.item))
    .map((x) => x.item);
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 12,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
    }}>{children}</div>
  );
}

function Combobox({
  label, items, placeholder, value, onChange, onSelect, disabled, showCounts, countsMap,
}: {
  label: string;
  items: string[];
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
  disabled?: boolean;
  showCounts?: boolean;
  countsMap?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const filtered = useMemo(() => rankedAlphabeticalFilter(items, query, true), [items, query]);

  useEffect(() => setActiveIndex(0), [query, items.length]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const commit = (v: string) => { onSelect(v); setOpen(false); setQuery(""); };

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>{label}</label>
      <div style={{ position: "relative", opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
        <input
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 16, padding: "8px 36px 8px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setOpen(true); setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0))); e.preventDefault(); }
            if (e.key === "ArrowUp") { setOpen(true); setActiveIndex((i) => Math.max(i - 1, 0)); e.preventDefault(); }
            if (e.key === "Enter") { if (open && filtered[activeIndex]) commit(filtered[activeIndex]); }
            if (e.key === "Escape") { setOpen(false); }
          }}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`listbox-${label}`}
        />
        <button
          style={{ position: "absolute", right: 6, top: 6, borderRadius: 10, padding: "0 8px", fontSize: 12, border: "1px solid #e5e7eb" }}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle options"
          type="button"
        >▾</button>
        {open && (
          <div style={{ position: "absolute", zIndex: 20, marginTop: 8, width: "100%", border: "1px solid #e5e7eb", background: "white", borderRadius: 16, boxShadow: "0 10px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
              <input
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}
                placeholder={`Type to filter ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <ul id={`listbox-${label}`} ref={listRef} role="listbox" style={{ maxHeight: 224, overflow: "auto", padding: "4px 0", listStyle: "none", margin: 0 }}>
              {filtered.length === 0 && (
                <li style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280" }}>No matches</li>
              )}
              {filtered.map((opt, idx) => (
                <li
                  key={opt}
                  role="option"
                  aria-selected={value === opt}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                  style={{ padding: "8px 12px", cursor: "pointer", background: idx === activeIndex ? "#f3f4f6" : "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span>{opt}</span>
                    {showCounts && countsMap && (countsMap[opt] ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{countsMap[opt]} estates</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CascadingSearch({
  initialData, onNavigate, fetchData,
}: {
  initialData?: DataShape;
  onNavigate?: (path: string) => void;
  fetchData?: () => Promise<DataShape>;
}) {
  const [data, setData] = useState<DataShape>(initialData || DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const next: DataShape = {};
    for (const line of lines) {
      const [countyRaw, townRaw, estateRaw] = line.split(",");
      if (!countyRaw || !townRaw || !estateRaw) continue;
      const county = countyRaw.trim();
      const town = townRaw.trim();
      const estate = estateRaw.trim();
      next[county] = next[county] || {};
      next[county][town] = next[county][town] || [];
      if (!next[county][town].includes(estate)) next[county][town].push(estate);
    }
    setData(next);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!fetchData) return;
      try {
        setLoading(true); setLoadError(null);
        const res = await fetchData();
        if (mounted && res) setData(res);
      } catch (e: any) {
        if (mounted) setLoadError(e?.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchData]);

  const counties = useMemo(() => Object.keys(data).sort((a,b)=>a.localeCompare(b)), [data]);
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [estate, setEstate] = useState("");

  const towns = useMemo(() => {
    if (!county) return [] as string[];
    return Object.keys(data[county] || {}).sort((a,b)=>a.localeCompare(b));
  }, [county, data]);

  const townCounts = useMemo(() => {
    if (!county) return {} as Record<string, number>;
    const obj = data[county] || {};
    return Object.fromEntries(Object.entries(obj).map(([t, arr]) => [t, (arr || []).length]));
  }, [county, data]);

  const estates = useMemo(() => {
    if (!county || !town) return [] as string[];
    return [...(data[county]?.[town] || [])].sort((a,b)=>a.localeCompare(b));
  }, [county, town, data]);

  useEffect(() => { setTown(""); setEstate(""); }, [county]);
  useEffect(() => { setEstate(""); }, [town]);

  const selectionSummary = county && town && estate ? `${estate}, ${town}, ${county}` : "";

  const goToEstate = () => {
    if (!county || !town || !estate) return;
    const path = `/${slugify(county)}/${slugify(town)}/${slugify(estate)}`;
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.hash = path;
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f9fafb, white)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 960, display: "grid", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.2 }}>Find Your Estate</h1>
          <p style={{ fontSize: 13, color: "#4b5563" }}>Type to filter each dropdown. Results are ranked by closest alphabetical match (prefixes first), then fuzzy matches.</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => { setCounty(""); setTown(""); setEstate(""); }} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "8px 14px", background: "white" }}>Clear</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "8px 14px", background: "white" }}>Upload CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }} />
          {loading && <span style={{ fontSize: 13, color: "#6b7280" }}>Loading dataset…</span>}
          {loadError && <span style={{ fontSize: 13, color: "#dc2626" }}>{loadError}</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <Combobox
            label="County"
            items={counties}
            placeholder="Select a county"
            value={county}
            onChange={setCounty}
            onSelect={setCounty}
            showCounts
            countsMap={useMemo(() => Object.fromEntries(counties.map((c) => [c, Object.values(data[c]||{}).reduce((acc, arr) => acc + ((arr as string[]|undefined)?.length || 0), 0)])), [counties, data])}
          />

          <Combobox
            label="Town/Region"
            items={towns}
            placeholder={county ? "Select a town/region" : "Pick a county first"}
            value={town}
            onChange={setTown}
            onSelect={setTown}
            disabled={!county}
            showCounts
            countsMap={townCounts}
          />

          <Combobox
            label="Estate/Area"
            items={estates}
            placeholder={town ? "Select an estate/area" : "Pick a town first"}
            value={estate}
            onChange={setEstate}
            onSelect={setEstate}
            disabled={!town}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={goToEstate} disabled={!county || !town || !estate} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "8px 14px", background: "white", opacity: (!county || !town || !estate) ? 0.5 : 1 }}>Go to estate page</button>
          {selectionSummary && <div style={{ fontSize: 13, color: "#374151" }}>Selected: <b>{selectionSummary}</b></div>}
        </div>

        <Box>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Dataset options</h2>
          <ul style={{ marginLeft: 16, fontSize: 13, color: "#374151" }}>
            <li>Inline (default) sample data.</li>
            <li>Upload a CSV with columns: <code>county,town,estate</code>.</li>
          </ul>
        </Box>
      </div>
    </div>
  );
}
