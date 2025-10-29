// pages/index.tsx
import * as React from "react";
import Head from "next/head";
import { supabase } from "../lib/supabaseClient";

/** Types */
type County = { id: string; name: string };
type Town = { id: string; name: string; county_id: string };
type Estate = { id: string; name: string; town_id: string };
type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  estate_id: string;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** ---------- 32 counties fallback ---------- */
const COUNTY_LIST: County[] = [
  "Antrim","Armagh","Carlow","Cavan","Clare","Cork","Derry","Donegal","Down","Dublin",
  "Fermanagh","Galway","Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford",
  "Louth","Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary","Tyrone",
  "Waterford","Westmeath","Wexford","Wicklow",
].map((name) => ({ id: slug(name), name }));

/** ---------- tiny CSV helpers (for /public/data/*.csv) ---------- */
async function fetchCSV(path: string): Promise<string[][]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return [];
  const text = await res.text();
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  return rows.map((r) => r.split(",").map((c) => c.trim()));
}

/** Try DB first; if empty/error, fall back to CSVs under /public/data */
function useCounties() {
  const [counties, set] = React.useState<County[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("counties").select("id,name").order("name");
      if (!cancel) {
        set(error || !data?.length ? COUNTY_LIST : (data as County[]));
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return { counties, loading };
}

function useTowns(countyId: string | null) {
  const [towns, set] = React.useState<Town[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!countyId) { set([]); return; }
      setLoading(true);

      // DB first
      const { data, error } = await supabase
        .from("towns").select("id,name,county_id").eq("county_id", countyId).order("name");

      if (!cancel && !error && data?.length) {
        set(data as Town[]);
        setLoading(false);
        return;
      }

      // Fallback to CSV: /public/data/places.csv
      // Expected columns (header allowed): Town,County
      const rows = await fetchCSV("/data/places.csv");
      const body = rows[0]?.[0]?.toLowerCase().includes("town") ? rows.slice(1) : rows;
      const fromCsv: Town[] = body
        .filter((r) => r.length >= 2)
        .map(([townName, countyName]) => {
          const cId = slug(countyName);
          return { id: slug(`${townName}-${cId}`), name: townName, county_id: cId };
        })
        .filter((t) => t.county_id === countyId)
        .sort((a, b) => a.name.localeCompare(b.name));

      set(fromCsv);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [countyId]);

  return { towns, loading };
}

const WHOLE_AREA = "Whole area";

function useEstates(town: Town | null) {
  const [estates, set] = React.useState<Estate[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!town) { set([]); return; }
      setLoading(true);

      // DB first
      const { data, error } = await supabase
        .from("estates").select("id,name,town_id").eq("town_id", town.id).order("name");

      if (!cancel && !error && data?.length) {
        set(data as Estate[]);
        setLoading(false);
        return;
      }

      // Fallback to CSV: /public/data/estates.csv
      // Expected columns (header allowed): Estate,Town
      const rows = await fetchCSV("/data/estates.csv");
      const body = rows[0]?.[0]?.toLowerCase().includes("estate") ? rows.slice(1) : rows;
      const fromCsv: Estate[] = body
        .filter((r) => r.length >= 2)
        .map(([estateName, townName]) => ({
          id: slug(`${estateName}-${townName}`),
          name: estateName,
          town_id: slug(`${townName}-${town.county_id}`),
        }))
        .filter((e) => e.town_id === town.id)
        .sort((a, b) => a.name.localeCompare(b.name));

      // If none, offer a synthetic "Whole area"
      const withWhole =
        fromCsv.length > 0
          ? fromCsv
          : [{ id: `${town.id}__whole`, name: WHOLE_AREA, town_id: town.id }];

      set(withWhole);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [town]);

  return { estates, loading };
}

function useReviews(estateId: string | null) {
  const [items, setItems] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!estateId) { setItems([]); return; }
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from("reviews")
        .select("id,rating,title,body,created_at,estate_id")
        .eq("estate_id", estateId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (!cancel) {
        if (error) setError(error.message);
        setItems((data || []) as Review[]);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [estateId]);

  return { items, loading, error };
}


/** -------- Suggest Area: inline form (no mail client needed) -------- */
function SuggestAreaForm({ countyId, townId }: { countyId: string | null; townId: string | null }) {
  const [estateName, setEstateName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle"|"saving"|"ok"|"err">("idle");
  const disabled = !countyId || !townId || !estateName;

  async function submit() {
    try {
      setStatus("saving");
      // create table area_suggestions first (see SQL below)
      const { error } = await supabase.from("area_suggestions").insert({
        county_id: countyId,
        town_id: townId,
        estate_name: estateName,
        contact_email: email || null,
      });
      if (error) throw error;
      setStatus("ok");
      setEstateName("");
      setEmail("");
    } catch (e) {
      setStatus("err");
    }
  }

  return (
    <div className="mt16">
      <div className="grid">
        <input
          className="select"
          placeholder="Estate/Area name"
          value={estateName}
          onChange={(e) => setEstateName(e.target.value)}
        />
        <input
          className="select"
          placeholder="(Optional) contact email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn mt16" disabled={disabled || status==="saving"} onClick={submit}>
        {status === "saving" ? "Sending…" : "Suggest this area"}
      </button>
      {status === "ok" && <div className="small mt16">Thanks — we got your suggestion.</div>}
      {status === "err" && <div className="small mt16">Couldn’t send. Try again in a minute.</div>}
    </div>
  );
}

/** -------- Optional: Rolling News ticker (uses /api/news if present) -------- */
function NewsTicker() {
  const [items, setItems] = React.useState<string[]>([]);
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) return;
        const data = await res.json(); // expect { items: string[] } or similar
        if (!cancel) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);
  if (!items.length) return null;
  return (
    <div style={{
      overflow: "hidden",
      whiteSpace: "nowrap",
      border: "1px solid rgba(255,255,255,.08)",
      borderRadius: 12,
      padding: "8px 12px",
      marginBottom: 16,
      background: "#0b1220"
    }}>
      <div className="small" style={{
        display: "inline-block",
        animation: "ticker 30s linear infinite",
      }}>
        {items.map((t, i) => (
          <span key={i} style={{ marginRight: 32 }}>• {t}</span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

/** ---------------- Page ---------------- */
export default function Home() {
  const { counties, loading: countiesLoading } = useCounties();
  const [countyId, setCountyId] = React.useState<string | null>(null);

  const { towns, loading: townsLoading } = useTowns(countyId);
  const [townId, setTownId] = React.useState<string | null>(null);
  const activeTown = React.useMemo(
    () => towns.find((t) => t.id === townId) || null,
    [towns, townId]
  );

  const { estates, loading: estatesLoading } = useEstates(activeTown);
  const [estateId, setEstateId] = React.useState<string | null>(null);

  const { items: reviews, loading: reviewsLoading, error: reviewsError } = useReviews(estateId);

  React.useEffect(() => { setTownId(null); setEstateId(null); }, [countyId]);
  React.useEffect(() => { setEstateId(null); }, [townId]);

  return (
    <>
      <Head>
        <title>StreetSage – Honest estate reviews across Ireland</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="container">
        <header className="header">
          <h1 className="h1">StreetSage</h1>
          <div className="sub">Find resident insights – County → Town → Estate/Area</div>
        </header>

        <NewsTicker />

        <main className="card">
          <div className="grid">
            <div>
              <label className="small">County</label>
              <select className="select mt8" value={countyId ?? ""} onChange={(e)=>setCountyId(e.target.value||null)}>
                <option value="">Select a county</option>
                {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {countiesLoading && <div className="small mt16">Loading counties…</div>}
            </div>

            <div>
              <label className="small">Town</label>
              <select className="select mt8" value={townId ?? ""} onChange={(e)=>setTownId(e.target.value||null)} disabled={!countyId}>
                <option value="">{countyId ? "Select a town" : "Select a county first"}</option>
                {towns.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {townsLoading && <div className="small mt16">Loading towns…</div>}
            </div>
          </div>

          <div className="mt16">
            <label className="small">Estate/Area</label>
            <select className="select mt8" value={estateId ?? ""} onChange={(e)=>setEstateId(e.target.value||null)} disabled={!townId}>
              <option value="">{townId ? "Select an estate/area" : "Select a town first"}</option>
              {estates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {estatesLoading && <div className="small mt16">Loading estates…</div>}
          </div>

          <div className="mt24">
            <button className="btn" disabled={!estateId} onClick={()=>window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" })}>
              View reviews
            </button>
          </div>

          <hr />

          <section id="reviews" className="mt16">
            <div className="muted small">Reviews</div>
            {!estateId && <div className="mt8 muted">Pick an estate/area to see recent reviews.</div>}
            {estateId && reviewsLoading && <div className="mt8">Loading reviews…</div>}
            {estateId && reviewsError && <div className="mt8">Couldn’t load reviews: {reviewsError}</div>}
            {estateId && !reviewsLoading && !reviewsError && reviews.length === 0 && <div className="mt8 muted">No reviews yet for this selection.</div>}
            {reviews.map((r) => (
              <article key={r.id} className="review">
                <div className="badge">★ {r.rating}/5</div>
                {r.title && <h3 style={{margin:"8px 0 6px"}}>{r.title}</h3>}
                {r.body && <p style={{margin:"0 0 8px"}}>{r.body}</p>}
                <div className="small muted">{new Date(r.created_at).toLocaleDateString()}</div>
              </article>
            ))}
          </section>

          <hr />

          <section className="mt16">
            <div className="muted small">Don’t see your estate/area?</div>
            <p className="mt8">Suggest it here — no email app needed.</p>
            <SuggestAreaForm countyId={countyId} townId={townId} />
          </section>
        </main>

        <footer className="mt24 small muted">Built with ❤️ in Ireland • StreetSage</footer>
      </div>
    </>
  );
}
