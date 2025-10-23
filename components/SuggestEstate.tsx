// components/SuggestEstate.tsx
import { useState } from "react";

export default function SuggestEstate() {
  const [open, setOpen] = useState(false);
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [estate, setEstate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county, town, estate, notes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed");
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) return <p className="text-sm mt-2">Thanks! We’ll review and add this soon.</p>;

  return (
    <div className="mt-4">
      {!open ? (
        <button className="underline text-sm" onClick={() => setOpen(true)}>
          Don’t see your area? Suggest it here
        </button>
      ) : (
        <div className="border rounded p-3 space-y-2">
          <div className="grid gap-2">
            <input className="border rounded p-2" placeholder="County" value={county} onChange={(e)=>setCounty(e.target.value)} />
            <input className="border rounded p-2" placeholder="Town" value={town} onChange={(e)=>setTown(e.target.value)} />
            <input className="border rounded p-2" placeholder="Estate" value={estate} onChange={(e)=>setEstate(e.target.value)} />
            <textarea className="border rounded p-2" placeholder="Notes (optional)" value={notes} onChange={(e)=>setNotes(e.target.value)} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button disabled={saving} className="px-3 py-2 border rounded" onClick={submit}>
              {saving ? "Sending..." : "Send"}
            </button>
            <button className="px-3 py-2 border rounded" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
