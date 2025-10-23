import * as React from "react";
import Head from "next/head";
import SuggestEstate from "../components/SuggestEstate";

/* ---------- Types ---------- */
type Estate = {
  id: string;
  name: string | null;
  town: string | null;
  county: string | null;
};

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

/* ---------- Reviews list (reads approved via /api/reviews) ---------- */
function Reviews({ estateId }: { estateId: string | null }) {
  const [items, setItems] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!estateId) { setItems([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/reviews?estateId=${estateId}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to fetch reviews");
        if (!cancelled) setItems(j.reviews || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estateId]);

  if (!estateId) return null;
  if (loading) return <p className="mt-3 text-sm opacity-70">Loading reviews…</p>;
  if (error) return <p className="mt-3 text-sm text-red-600">{error}</p>;
  if (!items.length) return <p className="mt-3 text-sm opacity-70">No reviews yet.</p>;

  return (
    <div className="mt-3 space-y-3">
      {items.map((r) => (
        <div key={r.id} className="border rounded p-3">
          <p className="text-xs opacity-60">{new Date(r.created_at).toLocaleDateString()}</p>
          <p className="font-medium">{r.title || "(no title)"} • {r.rating}/5</p>
          <p className="whitespace-pre-wrap mt-1">{r.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export default function HomePage() {
  /* Estates data for dropdowns */
  const [estates, setEstates] = React.useState<Estate[]>([]);
  const [loadingEstates, setLoadingEstates] = React.useState(true);
  const [estatesErr, setEstatesErr] = React.useState<string | null>(null);

  /* Selections */
  const [county, setCounty] = React.useState<string>("");
  const [town, setTown] = React.useState<string>("");
  const [estateId, setEstateId] = React.useState<string>("");

  /* Review form */
  const [rating, setRating] = React.useState<number>(5);
  const [title, setTitle] = React.useState<string>("");
  const [body, setBody] = React.useState<string>("");

  const [submitting, setSubmitting] = React.useState(false);
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);

  /* Load estates once */
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/estates");
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load estates");
        setEstates(j.estates || []);
      } catch (e: any) {
        setEstatesErr(e.message);
      } finally {
        setLoadingEstates(false);
      }
    })();
  }, []);

  /* Derived options */
  const counties = React.useMemo(
    () => Array.from(new Set(estates.map(e => e.county || "").filter(Boolean))).sort(),
    [estates]
  );

  const towns = React.useMemo(
    () =>
      Array.from(
        new Set(
          estates
            .filter(e => (e.county || "") === county)
            .map(e => e.town || "")
            .filter(Boolean)
        )
      ).sort(),
    [estates, county]
  );

  const estatesForTown = React.useMemo(
    () => estates.filter(e => (e.county || "") === county && (e.town || "") === town),
    [estates, county, town]
  );

  /* Reset child selections when parent changes */
  React.useEffect(() => { setTown(""); setEstateId(""); }, [county]);
  React.useEffect(() => { setEstateId(""); }, [town]);

  const selectedEstateId = estateId || null;

  /* Submit review */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg(null); setSubmitErr(null);
    try {
      if (!selectedEstateId) throw new Error("Pick an estate first.");
      if (!body.trim()) throw new Error("Please enter your review text.");

      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estateId: selectedEstateId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to submit review");

      setSubmitMsg("Submitted! Your review will appear once approved.");
      setTitle(""); setBody(""); setRating(5);
    } catch (e: any) {
      setSubmitErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Ireland Estate Reviews</title>
        <meta name="description" content="Independent reviews of Irish housing estates" />
      </Head>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Ireland Estate Reviews</h1>
          <p className="text-sm opacity-80">Pick your area, submit a review, we’ll publish it once approved.</p>
        </header>

        {/* Cascading selectors */}
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-medium">Select your area</h2>

          {loadingEstates && <p className="text-sm opacity-70">Loading areas…</p>}
          {estatesErr && <p className="text-sm text-red-600">{estatesErr}</p>}

          {!loadingEstates && !estatesErr && (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">County</label>
                <select
                  className="border rounded p-2 w-full"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                >
                  <option value="">Select county…</option>
                  {counties.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Town</label>
                <select
                  className="border rounded p-2 w-full"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  disabled={!county}
                >
                  <option value="">Select town…</option>
                  {towns.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Estate</label>
                <select
                  className="border rounded p-2 w-full"
                  value={estateId}
                  onChange={(e) => setEstateId(e.target.value)}
                  disabled={!town}
                >
                  <option value="">Select estate…</option>
                  {estatesForTown.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name || "(Unnamed)"}{e.town ? `, ${e.town}` : ""}{e.county ? `, ${e.county}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* “Don’t see your area?” */}
        <section>
          <SuggestEstate />
        </section>

        {/* Review form */}
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-medium">Write a review</h2>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Rating</label>
                <select
                  className="border rounded p-2 w-full"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Title (optional)</label>
                <input
                  className="border rounded p-2 w-full"
                  placeholder="Short summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Your review</label>
              <textarea
                className="border rounded p-2 w-full min-h-[120px]"
                placeholder="Share your experience…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}
            {submitMsg && <p className="text-sm text-green-700">{submitMsg}</p>}

            <button
              className="px-4 py-2 border rounded"
              disabled={submitting || !selectedEstateId}
              type="submit"
            >
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </section>

        {/* Approved reviews */}
        <section className="border rounded p-4">
          <h2 className="font-medium">Approved reviews</h2>
          <Reviews estateId={selectedEstateId} />
        </section>
      </main>
    </>
  );
}
