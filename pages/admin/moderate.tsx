// pages/admin/moderate.tsx
import React from "react";

type Review = {
  id: string;
  inserted_at: string;
  county: string;
  town: string;
  estate: string;
  rating: number;
  title: string | null;
  body: string | null;
  name: string | null;
  email: string | null;
  status: string;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Moderate() {
  const [token, setToken] = React.useState("");
  const [status, setStatus] = React.useState<"pending" | "approved" | "rejected">("pending");
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem("modToken") || "";
    setToken(saved);
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/moderation?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load");
      setReviews(json.reviews || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !confirm("Delete this review permanently? This cannot be undone.")) {
      return;
    }
    const prev = reviews;
    setReviews((r) => r.filter((x) => x.id !== id)); // optimistic removal
    try {
      const res = await fetch("/api/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Action failed");
    } catch (e: any) {
      setError(e.message);
      setReviews(prev); // rollback on error
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "32px auto", padding: "0 16px" }}>
      <h1>Moderator</h1>
      <p className="small">
        Enter the moderator password, choose a status filter, then load reviews.
        Admin actions run on the server with a service key.
      </p>

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          type="password"
          placeholder="Moderator password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            localStorage.setItem("modToken", e.target.value);
          }}
          style={{ maxWidth: 260 }}
        />

        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          style={{ maxWidth: 180 }}
          aria-label="Status filter"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button className="button" onClick={load} disabled={!token || loading}>
          {loading ? "Loading…" : "Load"}
        </button>

        {error && (
          <span className="small" style={{ color: "#ffbdbd", marginLeft: 8 }}>
            {error}
          </span>
        )}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {reviews.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong>
                {r.county} / {r.town} / {r.estate}
              </strong>
              <span style={{ color: "#9db0ff" }}>
                {new Date(r.inserted_at).toLocaleString()}
              </span>
              <span>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span style={{ marginLeft: "auto" }}>
                <a
                  href={`/${slug(r.county)}/${slug(r.town)}/${slug(r.estate)}`}
                  style={{ color: "var(--brand)" }}
                  target="_blank"
                  rel="noreferrer"
                >
                  View page →
                </a>
              </span>
            </div>
            {r.title && <p style={{ marginTop: 6 }}><em>{r.title}</em></p>}
            {r.body && <p style={{ marginTop: 6 }}>{r.body}</p>}
            <p className="small" style={{ color: "#9db0ff" }}>
              By {r.name || "Anonymous"} {r.email ? `• ${r.email}` : ""}
            </p>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="button" onClick={() => act(r.id, "approve")}>Approve</button>
              <button className="button secondary" onClick={() => act(r.id, "reject")}>Reject</button>
              <button className="button danger" onClick={() => act(r.id, "delete")}>Delete</button>
            </div>
          </div>
        ))}
        {!loading && reviews.length === 0 && <p>No reviews for this filter.</p>}
      </div>
    </div>
  );
}
