// pages/index.tsx
import * as React from "react";
import Head from "next/head";
import { supabase } from "../lib/supabaseClient";

/** --- Types (kept local so you don't need a separate types.ts) --- */
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

/** --- Minimal fallback so the UI isn't empty if the DB is blank or blocked by RLS --- */
const FALLBACK = {
  counties: [
    { id: "kildare", name: "Kildare" },
    { id: "clare", name: "Clare" },
  ] as County[],
  towns: [
    { id: "celbridge", name: "Celbridge", county_id: "kildare" },
    { id: "ennistymon", name: "Ennistymon", county_id: "clare" },
  ] as Town[],
  estates: [
    { id: "castle-village", name: "Castle Village", town_id: "celbridge" },
    { id: "abbey-view", name: "Abbey View", town_id: "ennistymon" },
  ] as Estate[],
};

/** --- Data hooks --- */
function useCounties() {
  const [counties, setCounties] = React.useState<County[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("counties")
        .select("id,name")
        .order("name");
      if (!cancel) {
        setCounties(error || !data?.length ? FALLBACK.counties : (data as County[]));
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return { counties, loading };
}

function useTowns(countyId: string | null) {
  const [towns, setTowns] = React.useState<Town[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!countyId) {
        setTowns([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("towns")
        .select("id,name,county_id")
        .eq("county_id", countyId)
        .order("name");
      if (!cancel) {
        setTowns(
          error || !data?.length
            ? FALLBACK.towns.filter((t) => t.county_id === countyId)
            : (data as Town[])
        );
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [countyId]);

  return { towns, loading };
}

function useEstates(townId: string | null) {
  const [estates, setEstates] = React.useState<Estate[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!townId) {
        setEstates([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("estates")
        .select("id,name,town_id")
        .eq("town_id", townId)
        .order("name");
      if (!cancel) {
        setEstates(
          error || !data?.length
            ? FALLBACK.estates.filter((e) => e.town_id === townId)
            : (data as Estate[])
        );
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [townId]);

  return { estates, loading };
}

function useReviews(estateId: string | null) {
  const [items, setItems] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!estateId) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
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
    return () => {
      cancel = true;
    };
  }, [estateId]);

  return { items, loading, error };
}

/** --- Page --- */
export default function Home() {
  const { counties, loading: countiesLoading } = useCounties();

  const [countyId, setCountyId] = React.useState<string | null>(null);
  const { towns, loading: townsLoading } = useTowns(countyId);

  const [townId, setTownId] = React.useState<string | null>(null);
  const { estates, loading: estatesLoading } = useEstates(townId);

  const [estateId, setEstateId] = React.useState<string | null>(null);
  const {
    items: reviews,
    loading: reviewsLoading,
    error: reviewsError,
  } = useReviews(estateId);

  // Reset children when parent changes
  React.useEffect(() => {
    setTownId(null);
    setEstateId(null);
  }, [countyId]);

  React.useEffect(() => {
    setEstateId(null);
  }, [townId]);

  return (
    <>
      <Head>
        <title>StreetSage – Honest estate reviews across Ireland</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="container">
        <header className="header">
          <h1 className="h1">StreetSage</h1>
          <div className="sub">Find resident insights – County → Town → Estate</div>
        </header>

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
                {counties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
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
                <option value="">
                  {countyId ? "Select a town" : "Select a county first"}
                </option>
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {townsLoading && <div className="small mt16">Loading towns…</div>}
            </div>
          </div>

          {/* Estate */}
          <div className="mt16">
            <label className="small">Estate</label>
            <select
              className="select mt8"
              value={estateId ?? ""}
              onChange={(e) => setEstateId(e.target.value || null)}
              disabled={!townId}
            >
              <option value="">
                {townId ? "Select an estate" : "Select a town first"}
              </option>
              {estates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {estatesLoading && <div className="small mt16">Loading estates…</div>}
          </div>

          {/* CTA */}
          <div className="mt24">
            <button
              className="btn"
              disabled={!estateId}
              onClick={() =>
                window.scrollTo({
                  top: document.body.scrollHeight,
                  behavior: "smooth",
                })
              }
            >
              View reviews
            </button>
          </div>

          <hr />

          {/* Reviews */}
          <section id="reviews" className="mt16">
            <div className="muted small">Reviews</div>
            {!estateId && (
              <div className="mt8 muted">Pick an estate to see recent reviews.</div>
            )}
            {estateId && reviewsLoading && <div className="mt8">Loading reviews…</div>}
            {estateId && reviewsError && (
              <div className="mt8">Couldn’t load reviews: {reviewsError}</div>
            )}
            {estateId && !reviewsLoading && !reviewsError && reviews.length === 0 && (
              <div className="mt8 muted">No reviews yet for this estate.</div>
            )}
            {reviews.map((r) => (
              <article key={r.id} className="review">
                <div className="badge">★ {r.rating}/5</div>
                {r.title && <h3 style={{ margin: "8px 0 6px" }}>{r.title}</h3>}
                {r.body && <p style={{ margin: "0 0 8px" }}>{r.body}</p>}
                <div className="small muted">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </article>
            ))}
          </section>

          <hr />

          {/* Suggest estate */}
          <section className="mt16">
            <div className="muted small">Don’t see your estate?</div>
            <p className="mt8">
              Suggest a new estate and we’ll add it after a quick check.
            </p>
            <a
              className="btn"
              href="mailto:streetsage+suggest@yourdomain.ie?subject=Suggest%20Estate"
            >
              Suggest an estate
            </a>
          </section>
        </main>

        <footer className="mt24 small muted">
          Built with ❤️ in Ireland • StreetSage
        </footer>
      </div>
    </>
  );
}
