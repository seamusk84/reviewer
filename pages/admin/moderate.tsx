import * as React from "react";

type ReviewRow = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  status: string;
  rating: number;
  estate_id: string;
};

type AreaRow = {
  id: string;
  county_id: string;
  town_id: string;
  estate_name: string;
  contact_email: string | null;
  created_at: string;
  status: string;
};

async function postJSON(url: string, body: any, token: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify(body),
  });
}

export default function ModeratePage() {
  const [token, setToken] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [areas, setAreas] = React.useState<AreaRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Allow supplying ?token= in the URL
  React.useEffect(() => {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("token");
    if (t) setToken(t);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/list-pending?token=" + encodeURIComponent(token), {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Unauthorized or network error");
      const j = await res.json();
      setReviews(Array.isArray(j.reviews) ? j.reviews : []);
      setAreas(Array.isArray(j.areas) ? j.areas : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function act(kind: "review" | "area", id: string, action: "approve" | "decline") {
    const url = kind === "review" ? "/api/moderate/review" : "/api/moderate/area";
    await postJSON(url, { id, action }, token);
    if (kind === "review") setReviews((x) => x.filter((r) => r.id !== id));
    else setAreas((x) => x.filter((a) => a.id !== id));
  }

  return (
    <div className="container">
      <h1 className="h1">Moderation</h1>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="small muted">Enter your admin token to view queues.</div>
        <div className="grid" style={{ marginTop: 12 }}>
          <input
            className="select"
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="btn" onClick={load} disabled={!token || loading}>
            {loading ? "Loading…" : "Load pending"}
          </button>
        </div>
        {error && <div className="small" style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pending Reviews</h3>
        {!reviews.length && <div className="small muted">None</div>}
        {reviews.map((r) => (
          <div key={r.id} className="review">
            <div className="small muted">
              {new Date(r.created_at).toLocaleString()} • Estate ID: {r.estate_id} • Rating: {r.rating}
            </div>
            {r.title && <strong>{r.title}</strong>}
            {r.body && <p className="mt8" style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>}
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => act("review", r.id, "approve")}>Approve</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => act("review", r.id, "decline")}>Decline</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pending Area Suggestions</h3>
        {!areas.length && <div className="small muted">None</div>}
        {areas.map((a) => (
          <div key={a.id} className="review">
            <div className="small muted">{new Date(a.created_at).toLocaleString()}</div>
            <div>County: <strong>{a.county_id}</strong> • Town: <strong>{a.town_id}</strong></div>
            <div>Estate/Area: <strong>{a.estate_name}</strong></div>
            {a.contact_email && <div className="small">Email: {a.contact_email}</div>}
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => act("area", a.id, "approve")}>Approve</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => act("area", a.id, "decline")}>Decline</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
