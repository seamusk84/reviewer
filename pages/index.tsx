// pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import type { EstateRow } from "../types/estates";

// Tiny loader that reads from /public/data/estates.json
async function loadEstates(): Promise<EstateRow[]> {
  const res = await fetch("/data/estates.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load estates.json");
  return res.json();
}

export default function Home() {
  const [rows, setRows] = useState<EstateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");

  useEffect(() => {
    setLoading(true);
    loadEstates()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((e: unknown) => {
        console.error(e);
        setError("Could not load estates. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Unique, sorted lists for each dropdown
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
      rows
        .filter(
          (r) => (!county || r.county === county) && (!town || r.town === town)
        )
        .map((r) => r.estate)
        .filter(Boolean) as string[],
    [rows, county, town]
  );

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "1rem" }}>
      <h1 style={{ marginBottom: 12 }}>StreetSage</h1>
      <p style={{ marginBottom: 24 }}>
        Pick a county and town to see available estates.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label htmlFor="county">County</label>
        <select
          id="county"
          value={county}
          onChange={(e) => {
            setCounty(e.target.value);
            setTown(""); // reset town when county changes
          }}
        >
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label htmlFor="town" style={{ marginLeft: 8 }}>
          Town
        </label>
        <select
          id="town"
          value={town}
          onChange={(e) => setTown(e.target.value)}
          disabled={!counties.length}
        >
          <option value="">All towns</option>
          {towns.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 24 }}>
        <strong>Estates</strong>
        {loading && <p style={{ marginTop: 8 }}>Loading…</p>}
        {error && (
          <p style={{ marginTop: 8, color: "crimson" }}>
            {error}
          </p>
        )}
        {!loading && !error && (
          <ul style={{ marginTop: 8 }}>
            {estates.length ? (
              estates.map((e) => <li key={e}>{e}</li>)
            ) : (
              <li>No estates found for this selection.</li>
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
