// pages/index.tsx
import * as React from "react";
import Head from "next/head";
import { supabase } from "../lib/supabaseClient";

/** ---------- Types ---------- */
type County = { id: string; name: string };
type Town   = { id: string; name: string; county_id: string };
type Estate = { id: string; name: string; town_id: string };
type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  estate_id: string;
};

/** ---------- Utils ---------- */
const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Ultra-safe CSV loader for files in /public/data */
async function fetchCSV(path: string): Promise<string[][]> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text) return [];
    return text
      .replace(/^\uFEFF/, "") // strip BOM
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => r.split(",").map((c) => c.trim()));
  } catch {
    return [];
  }
}

/** ---------- 32 counties fallback (always available) ---------- */
const COUNTY_LIST: County[] = [
  "Antrim","Armagh","Carlow","Cavan","Clare","Cork","Derry","Donegal","Down","Dublin",
  "Fermanagh","Galway","Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford",
  "Louth","Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary","Tyrone",
  "Waterford","Westmeath","Wexford","Wicklow",
].map((name) => ({ id: slug(name), name }));

/** ---------- Error boundary to avoid white screen ---------- */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any, info: any) { console.error("StreetSage error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="small">Something went wrong rendering this section.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** ---------- Data hooks (DB first, CSV fallback) ---------- */
function useCounties() {
  const [counties, set] = React.useState<County[]>(COUNTY_LIST);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("counties").select("id,name").order("name");
        if (!cancel && !error && Array.isArray(data) && data.length) set(data as County[]);
      } catch {
        // ignore -> fallback remains COUNTY_LIST
      } finally {
        if (!cancel) setLoading(false);
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

      try {
        // Try DB
        const { data, error } = await supabase
          .from("towns")
          .select("id,name,county_id")
          .eq("county_id", countyId)
          .order("name");

        if (!cancel && !error && Array.isArray(data) && data.length) {
          set(data as Town[]);
          return;
        }

        // Fallback to CSV: /public/data/places.csv with columns: Town,County
        const rows = await fetchCSV("/data/places.csv");
        const body = rows[0]?.[0]?.toLowerCase().includes("town") ? rows.slice(1) : rows;
        const fromCsv: Town[] = body
          .filter((r) => r.length >= 2)
          .map(([townName, countyName]) => ({
            id: slug(`${townName}-${slug(countyName)}`),
            name: townName,
            county_id: slug(countyName),
          }))
          .filter((t) => t.county_id === countyId)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancel) set(fromCsv);
      } finally {
        if (!cancel) setLoading(false);
      }
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

      try {
        // Try DB
        const { data, error } = await supabase
          .from("estates")
          .select("id,name,town_id")
          .eq("town_id", town.id)
          .order("name");

        if (!cancel && !error && Array.isArray(data) && data.length) {
          set(data as Estate[]);
          return;
        }

        // Fallback to CSV: /public/data/estates.csv with columns: Estate,Town
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

        const withWhole =
          fromCsv.length > 0
            ? fromCsv
            : [{ id: `${town.id}__whole`, name: WHOLE_AREA, town_id: town.id }];

        if (!cancel) set(withWhole);
      } finally {
        if (!cancel) setLoading(false);
      }
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
    if (!estateId) { setItems([]); return; }
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("id,rating,title,body,created_at,estate_id")
          .eq("estate_id", estateId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (!cancel) {
          if (error) setError(error.message);
          setItems(Array.isArray(data) ? (data as Review[]) : []);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Unknown error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [estateId]);

  return { items, loading, error };
}

/** ---------- Suggest Area Form (requires County & Town) ---------- */
function SuggestAreaForm({
  countyId, townId, counties, towns,
}: {
  countyId: string | null;
  townId: string | null;
  counties: County[];
  towns: Town[];
}) {
  const [estateName, setEstateName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle"|"saving"|"ok"|"err">("idle");

  const county = counties.find(c => c.id === countyId) || null;
  const town   = towns.find(t => t.id === townId) || null;
  const disabled = !county || !town || !estateName;

  async function submit() {
    try {
      setStatus("saving");
      const { error } = await supabase.from("area_suggestions").insert({
        county_id: county!.id,
        town_id: town!.id,
        estate_name: estateName,
        contact_email: email || null,
        status: "pending",
      });
      if (error) throw error;
      setStatus("ok");
      setEstateName("");
      setEmail("");
    } catch (e) {
      console.error(e);
      setStatus("err");
    }
  }

  return (
    <div className="mt16">
      <div className="small muted">Your selection</div>
      <div className="mt8">
        <span className="badge" style={{marginRight:8}}>County: {county?.name ?? "—"}</span>
        <span className="badge">Town: {town?.name ?? "—"}</span>
      </div>

      <div className="grid mt16">
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
      <div className="small mt16 muted">Tip: pick County and Town above before suggesting.</div>
    </div>
  );
}

/** ---------- Page ---------- */
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

  const countyList = Array.isArray(counties) ? counties : [];
  const townList = Array.isArray(towns) ? towns : [];
  const estateList = Array.isArray(estates) ? estates : [];
  const reviewList = Array.isArray(reviews) ? reviews : [];

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

        <ErrorBoundary>
          <main className="card">
            {/* County / Town */}
            <div className="grid">
              <div>
                <label className="small">County</label>
                <select
                  className="select mt8"
                  value={countyId ?? ""}
                  onChange={(e) => setCountyId(e.target.value || null)}
                >
                  <option value="">Select a county</option>
                  {countyList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {countiesLoading && <div className="small mt16">Loading counties…</div>}
              </div>

              <div>
                <label className="small">Town</label>
                <select
                  className="select mt8"
                  value={townId ?? ""}
                  onChange={(e) => setTownId(e.target.value || null)}
                  disabled={!countyId}
                >
                  <option value="">{countyId ? "Select a town" : "Select a county first"}</option>
                  {townList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {townsLoading && <div className="small mt16">Loading towns…</div>}
              </div>
            </div>

            {/* Estate/Area */}
            <div className="mt16">
              <label className="small">Estate/Area</label>
              <select
                className="select mt8"
                value={estateId ?? ""}
                onChange={(e) => setEstateId(e.target.value || null)}
                disabled={!townId}
              >
                <option value="">{townId ? "Select an estate/area" : "Select a town first"}</option>
                {estateList.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {estatesLoading && <div className="small mt16">Loading estates…</div>}
            </div>

            {/* CTA */}
            <div className="mt24">
              <button
                className="btn"
                disabled={!estateId}
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
              >
                View reviews
              </button>
            </div>

            <hr />

            {/* Reviews */}
            <section id="reviews" className="mt16">
              <div className="muted small">Reviews</div>
              {!estateId && <div className="mt8 muted">Pick an estate/area to see recent reviews.</div>}
              {estateId && reviewsLoading && <div className="mt8">Loading reviews…</div>}
              {estateId && reviewsError && <div className="mt8">Couldn’t load reviews: {reviewsError}</div>}
              {estateId && !reviewsLoading && !reviewsError && reviewList.length === 0 && (
                <div className="mt8 muted">No reviews yet for this selection.</div>
              )}
              {reviewList.map((r) => (
                <article key={r.id} className="review">
                  <div className="badge">★ {r.rating}/5</div>
                  {r.title && <h3 style={{ margin: "8px 0 6px" }}>{r.title}</h3>}
                  {r.body && <p style={{ margin: "0 0 8px" }}>{r.body}</p>}
                  <div className="small muted">{new Date(r.created_at).toLocaleDateString()}</div>
                </article>
              ))}
            </section>

            <hr />

            {/* Suggest Area (requires County + Town) */}
            <section className="mt16">
              <div className="muted small">Don’t see your estate/area?</div>
              <p className="mt8">Pick a County and Town above, then suggest the Estate/Area here.</p>
              <SuggestAreaForm
                countyId={countyId}
                townId={townId}
                counties={countyList}
                towns={townList}
              />
            </section>
          </main>
        </ErrorBoundary>

        <footer className="mt24 small muted">Built with ❤️ in Ireland • StreetSage</footer>
      </div>
    </>
  );
}
