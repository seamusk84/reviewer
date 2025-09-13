import FilterSelect from "../components/FilterSelect";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React from "react";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

type DataShape = Record<string, Record<string, string[]>>;

// Minimal CSV parser (handles quoted commas)
function splitCSVLine(line: string): string[] {
  const cells = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  return cells.map((c) => {
    let s = c.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');
    return s;
  });
}

function parseEstatesCSV(text: string): DataShape {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift(); if (!header) return {};
  const cols = splitCSVLine(header).map(h => h.trim().toLowerCase());
  const iCounty = cols.indexOf("county");
  const iTown = cols.indexOf("town");
  const iEstate = cols.indexOf("estate");
  const data: DataShape = {};
  for (const line of lines) {
    if (!line) continue;
    const parts = splitCSVLine(line);
    const county = parts[iCounty]?.trim();
    const town = parts[iTown]?.trim();
    const estate = parts[iEstate]?.trim() || "All Areas";
    if (!county || !town) continue;
    (data[county] ||= {});
    (data[county][town] ||= []);
    if (!data[county][town].includes(estate)) data[county][town].push(estate);
  }
  return data;
}

// Small on-page status badge (you can remove later)
function DebugCounts() {
  const [msg, setMsg] = React.useState<string>("Loading…");
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/data/estates.csv", { cache: "no-store" });
        if (!res.ok) throw new Error("estates.csv not found");
        const txt = await res.text();
        const data = parseEstatesCSV(txt);
        const counties = Object.keys(data).length;
        const towns = Object.values(data).reduce((n, t) => n + Object.keys(t).length, 0);
        setMsg(`Loaded ${counties} counties · ${towns} towns`);
      } catch (e: any) {
        setMsg(`Data error: ${e.message || "failed to load"}`);
      }
    })();
  }, []);
  return (
    <div style={{
      position: "fixed", right: 12, bottom: 12, background: "white",
      border: "1px solid #e5e7eb", borderRadius: 12, padding: "6px 10px",
      fontSize: 12, color: "#374151", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 50
    }}>
      {msg}
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const fetchData = async () => {
    const res = await fetch("/data/estates.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load estates.csv");
    const txt = await res.text();
    const data = parseEstatesCSV(txt);
    return data;
  };

  return (
    <>
      <CascadingSearch fetchData={fetchData} onNavigate={(p) => router.push(p)} />
      <DebugCounts />
    </>
  );
}
