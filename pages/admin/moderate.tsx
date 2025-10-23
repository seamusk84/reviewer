// pages/admin/moderate.tsx
import { useEffect, useState } from "react";

type Review = {
  id: string;
  estate_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

export default function ModeratePage() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [pass, setPass] = useState("");

  const headers: HeadersInit = {};
  if (pass) headers["x-admin-pass"] = pass;

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/moderate", { headers });
    const j = await r.json();
    setItems(j.reviews || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ id, action }),
    });
    await load();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Pending reviews</h1>

      {process.env.NEXT_PUBLIC_NEEDS_ADMIN_PASS && (
        <div className="flex gap-2">
          <input
            className="border rounded p-2 flex-1"
            placeholder="Admin password"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button className="border rounded px-3" onClick={load}>Unlock</button>
        </div>
      )}

      {loading && <p>Loading…</p>}
      {!loading && items.length === 0 && <p>No pending reviews.</p>}

      {items.map((r) => (
        <div key={r.id} className="border rounded p-3 space-y-2">
          <p className="text-sm opacity-70">{new Date(r.created_at).toLocaleString()}</p>
          <p className="font-medium">{r.title || "(no title)"} • {r.rating}/5</p>
          <p className="whitespace-pre-wrap">{r.body}</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => act(r.id, "approve")}>
              Approve
            </button>
            <button className="px-3 py-1 border rounded" onClick={() => act(r.id, "reject")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
