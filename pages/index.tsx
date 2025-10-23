import * as React from "react";
import Head from "next/head";
import SuggestEstate from "../components/SuggestEstate";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

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
  if (loading) return <p style={{opacity:.7, marginTop:12}}>Loading reviews…</p>;
  if (error) return <p style={{color:"#b91c1c", marginTop:12}}>{error}</p>;
  if (!items.length) return <p style={{opacity:.7, marginTop:12}}>No reviews yet.</p>;

  return (
    <div style={{marginTop:12}}>
      {items.map((r) => (
        <div key={r.id} style={{border:"1px solid #e5e7eb", borderRadius:8, padding:12, marginBottom:12}}>
          <p style={{fontSize:12, opacity:.6}}>{new Date(r.created_at).toLocaleDateString()}</p>
          <p style={{fontWeight:600}}>{r.title || "(no title)"} • {r.rating}/5</p>
          <p style={{whiteSpace:"pre-wrap", marginTop:6}}>{r.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  // 1) read ?estate=<uuid> from URL
  const [estateId, setEstateId] = React.useState<string>("");
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("estate");
    if (q && !estateId) setEstateId(q);
  }, []);

  const [rating, setRating] = React.useState<number>(5);
  const [title, setTitle] = React.useState<string>("");
  const [body, setBody] = React.useState<string>("");

  const [submitting, setSubmitting] = React.useState(false);
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);

  const selectedEstateId = estateId.trim() || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg(null); setSubmitErr(null);
    try {
      if (!selectedEstateId) throw new Error("Please paste an estate UUID first.");
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

  // inline styles so inputs are guaranteed to show (no Tailwind needed)
  const box = { border:"1px solid #e5e7eb", borderRadius:8, padding:16, marginTop:8 } as const;
  const input = { width:"100%", border:"1px solid #d1d5db", borderRadius:6, padding:"8px 10px" } as const;
  const btn = { padding:"8px 14px", border:"1px solid #d1d5db", borderRadius:6, background:"#fff", cursor:"pointer" } as const;

  return (
    <>
      <Head>
        <title>Ireland Estate Reviews</title>
        <meta name="description" content="Independent reviews of Irish housing estates" />
      </Head>

      <main style={{maxWidth:880, margin:"0 auto", padding:24}}>
        <header style={{marginBottom:12}}>
          <h1 style={{fontSize:28, fontWeight:700}}>Ireland Estate Reviews</h1>
          <p style={{opacity:.8}}>
            Pick an estate (UUID), submit a review, and we’ll publish it once approved.
          </p>
        </header>

        {/* ESTATE SELECTION (inline-styled, cannot be hidden by CSS) */}
        <section style={box}>
          <label htmlFor="estateId" style={{display:"block", fontWeight:600, marginBottom:6}}>
            Estate ID (UUID from your database)
          </label>
          <input
            id="estateId"
            type="text"
            placeholder="e.g. 6c9c66e4-1c6a-4c39-9d70-2a2e1a3b1c22"
            value={estateId}
            onChange={(e) => setEstateId(e.target.value)}
            style={input}
          />
          <p style={{fontSize:12, opacity:.7, marginTop:6}}>
            Tip: Find this in Supabase → Table Editor → <code>public.estates</code>.
            You can also set it via the URL: <code>?estate=&lt;uuid&gt;</code>
          </p>
        </section>

        {/* SUGGEST AN AREA */}
        <section style={{marginTop:16}}>
          <SuggestEstate />
        </section>

        {/* REVIEW FORM */}
        <section style={{...box, marginTop:16}}>
          <h2 style={{fontWeight:600}}>Write a review</h2>
          <form onSubmit={handleSubmit}>
            <div style={{display:"grid", gap:12, gridTemplateColumns:"1fr 2fr"}}>
              <div>
                <label htmlFor="rating" style={{display:"block", fontSize:14, fontWeight:600, marginBottom:6}}>Rating</label>
                <select
                  id="rating"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  style={{...input, height:38}}
                >
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="title" style={{display:"block", fontSize:14, fontWeight:600, marginBottom:6}}>Title (optional)</label>
                <input
                  id="title"
                  type="text"
                  placeholder="Short summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={input}
                />
              </div>
            </div>

            <div style={{marginTop:12}}>
              <label htmlFor="body" style={{display:"block", fontSize:14, fontWeight:600, marginBottom:6}}>Your review</label>
              <textarea
                id="body"
                placeholder="Share your experience…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{...input, minHeight:120}}
              />
            </div>

            {submitErr && <p style={{color:"#b91c1c", marginTop:8}}>{submitErr}</p>}
            {submitMsg && <p style={{color:"#166534", marginTop:8}}>{submitMsg}</p>}

            <button disabled={submitting} type="submit" style={{...btn, marginTop:12}}>
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </form>
        </section>

        {/* APPROVED REVIEWS */}
        <section style={{...box, marginTop:16}}>
          <h2 style={{fontWeight:600}}>Approved reviews</h2>
          <Reviews estateId={selectedEstateId} />
        </section>
      </main>
    </>
  );
}
