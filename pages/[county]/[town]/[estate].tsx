// pages/[county]/[town]/[estate].tsx
import { useRouter } from "next/router";
import React from "react";

type Review = {
  id: string;
  inserted_at: string;
  rating: number;
  title: string | null;
  body: string | null;
  name: string | null;
};

const nice = (s?: string) => (s || "").replace(/-/g, " ");

export default function EstatePage() {
  const { county: c, town: t, estate: e } = (useRouter().query as Record<string, string>);
  const county = nice(c), town = nice(t), estate = nice(e);

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!county || !town || !estate) return;
    (async () => {
      try {
        setLoading(true);
        const qs = new URLSearchParams({ county, town, estate });
        const res = await fetch(`/api/reviews?${qs}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to load");
        setReviews(json.reviews || []);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [county, town, estate]);

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        {estate} — {town}, {county}
      </h1>
      <p className="small">New reviews are moderated before publishing.</p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Reviews</h2>
        {loading && <p>Loading…</p>}
        {err && <p style={{ color: "#ffbdbd" }}>{err}</p>}
        {!loading && !err && reviews.length === 0 && <p>No reviews yet. Be the first!</p>}

        <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {reviews.map((r) => (
            <li key={r.id} className="card">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong>
                <span>{r.title}</span>
                <span style={{ color: "#9db0ff", fontSize: 12, marginLeft: "auto" }}>
                  {new Date(r.inserted_at).toLocaleDateString()} · {r.name || "Anonymous"}
                </span>
              </div>
              {r.body && <p style={{ marginTop: 8 }}>{r.body}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Write a review</h2>
        <ReviewForm county={county} town={town} estate={estate} />
      </section>
    </div>
  );
}

function ReviewForm({ county, town, estate }: { county: string; town: string; estate: string }) {
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county, town, estate, rating, title, body, name, email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to submit");
      setMsg("Thanks! Your review was submitted and is pending approval.");
      setTitle(""); setBody(""); setName(""); setEmail(""); setRating(5);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 10, maxWidth: 640 }}>
      <label>
        Rating (1–5)
        <input
          className="input"
          type="number"
          min={1}
          max={5}
          value={rating}
          onChange={(e) => setRating(parseInt(e.target.value || "5", 10))}
          required
        />
      </label>
      <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="Your experience" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
      <div className="grid grid-2">
        <input className="input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email (optional, not shown)" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="row">
        <button className="button" disabled={submitting}>{submitting ? "Submitting…" : "Submit review"}</button>
        {msg && <p className="small" style={{ marginLeft: 8 }}>{msg}</p>}
      </div>
    </form>
  );
}
