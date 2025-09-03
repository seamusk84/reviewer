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
  status: "pending" | "approved" | "rejected";
};

type View = "pending" | "approved" | "rejected" | "deleted";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Moderate() {
  const [token, setToken] = React.useState("");
  const [view, setView] = React.useState<View>("pending");
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setToken(localStorage.getItem("modToken") || "");
  }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(selected.size === reviews.length ? new Set() : new Set(reviews.map(r => r.id)));
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSelected(new Set());
      const res = await fetch(`/api/moderation?view=${view}`, {
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

  async function act(action: "approve" | "reject" | "delete" | "restore", ids?: string[]) {
    const list = (ids && ids.length) ? ids : Array.from(selected);
    if (!list.length) return;
    if (action === "delete" && !confirm(`Delete ${list.length} review(s)?`)) return;

    const prev = reviews;
    setReviews(r => r.filter(x => !list.includes(x.id)));
    setSelected(new Set());

    try {
      const res = await fetch("/api/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: list, action }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Action failed");
    } catch (e: any) {
      setError(e.message);
      setReviews(prev); // rollback
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "32px auto", padding: "0 16px" }}>
      <h1>Moderator</h1>
      <p className="small">Enter password → choose view → load → bulk actions / per-row actions.</p>

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
        <select className="input" value={view} onChange={(e) => setView(e.target.value as View)} style={{ maxWidth: 180 }}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deleted">Deleted</option>
        </select>
        <button className="button" onClick={load} disabled={!token || loading}>
          {loading ? "Loading…" : "Load"}
        </button>
        {error && <span className="small" style={{ color: "#ffbdbd", marginLeft: 8 }}>{error}</span>}
      </div>

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={selected.size === reviews.length && reviews.length > 0} onChange={toggleAll} />
          Select all ({selected.size}/{reviews.length})
        </label>
        <button className="button" onClick={() => act("approve")} disabled={selected.size === 0 || view === "approved"}>
          Approve selected
        </button>
        <button className="button secondary" onClick={() => act("reject")} disabled={selected.size === 0 || view === "rejected"}>
          Reject selected
        </button>
        {view === "deleted" ? (
          <button className="button" onClick={() => act("restore")} disabled={selected.size === 0}>
            Restore selected
          </button>
        ) : (
          <button className="button secondary" onClick={() => act("delete")} disabled={selected.size === 0}>
            Delete selected
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {reviews.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              <strong>{r.county} / {r.town} / {r.estate}</strong>
              <span style={{ color: "#9db0ff" }}>{new Date(r.inserted_at).toLocaleString()}</span>
              <span>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span style={{ marginLeft: "auto" }}>
                <a href={`/${slug(r.county)}/${slug(r.town)}/${slug(r.estate)}`} style={{ color: "var(--brand)" }} target="_blank" rel="noreferrer">View page →</a>
              </span>
            </div>
            {r.title && <p style={{ marginTop: 6 }}><em>{r.title}</em></p>}
            {r.body && <p style={{ marginTop: 6 }}>{r.body}</p>}
            <p className="small" style={{ color: "#9db0ff" }}>By {r.name || "Anonymous"} {r.email ? `• ${r.email}` : ""}</p>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              {view !== "approved" && <button className="button" onClick={() => act("approve", [r.id])}>Approve</button>}
              {view !== "rejected" && <button className="button secondary" onClick={() => act("reject", [r.id])}>Reject</button>}
              {view === "deleted"
                ? <button className="button" onClick={() => act("restore", [r.id])}>Restore</button>
                : <button className="button secondary" onClick={() => act("delete", [r.id])}>Delete</button>}
            </div>
          </div>
        ))}
        {!loading && reviews.length === 0 && <p>No reviews for this view.</p>}
      </div>
    </div>
  );
}
