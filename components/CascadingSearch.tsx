import React from "react";

type DataShape = Record<string, Record<string, string[]>>;
type Props = {
  fetchData: () => Promise<DataShape | undefined>;
  onNavigate: (path: string) => void;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export default function CascadingSearch({ fetchData, onNavigate }: Props) {
  const [data, setData] = React.useState<DataShape>({});
  const [counties, setCounties] = React.useState<string[]>([]);
  const [towns, setTowns] = React.useState<string[]>([]);
  const [estates, setEstates] = React.useState<string[]>([]);

  const [county, setCounty] = React.useState("");
  const [town, setTown] = React.useState("");
  const [estate, setEstate] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const countyRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = (await fetchData()) || {};
        setData(d);
        const cs = Object.keys(d).sort((a, b) => a.localeCompare(b));
        setCounties(cs);
        setMsg(null);
      } catch (e: any) {
        setMsg(e.message || "Failed to load data");
      } finally {
        setLoading(false);
        // autofocus first input on mount (desktop only, skip on mobile iOS quirks)
        if (countyRef.current && window.innerWidth > 640) countyRef.current.focus();
      }
    })();
  }, [fetchData]);

  // update towns/estates when selections change
  React.useEffect(() => {
    if (!county) { setTowns([]); setTown(""); setEstates([]); setEstate(""); return; }
    const t = Object.keys(data[county] || {}).sort((a,b)=>a.localeCompare(b));
    setTowns(t);
    if (!t.includes(town)) { setTown(""); setEstates([]); setEstate(""); }
  }, [county, data]);

  React.useEffect(() => {
    if (!county || !town) { setEstates([]); setEstate(""); return; }
    const e = [...(data[county]?.[town] || [])].sort((a,b)=>a.localeCompare(b));
    setEstates(e);
    if (!e.includes(estate)) setEstate(e[0] || "");
  }, [county, town, data]);

  // “closest match” helper for type-to-filter dropdowns
  function closest(list: string[], val: string) {
    if (!val) return "";
    const i = list.findIndex(x => x.toLowerCase().startsWith(val.toLowerCase()));
    if (i >= 0) return list[i];
    const after = list.find(x => x.toLowerCase() >= val.toLowerCase());
    return after || list[list.length - 1] || "";
  }

  function go() {
    if (!county || !town) return;
    const e = estate || "All Areas";
    onNavigate(`/${slugify(county)}/${slugify(town)}/${slugify(e)}`);
  }

  async function submitSuggestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      county: fd.get("county"),
      town: fd.get("town"),
      estate: fd.get("estate"),
      email: fd.get("email"),
      note: fd.get("note"),
    };
    try {
      await fetch("/api/suggestions", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      alert("Thanks! We’ve recorded your suggestion.");
      setShowAdd(false);
    } catch {
      alert("Could not send right now — try again later.");
    }
  }

  return (
    <div className="card">
      <div className="hero">
        <div className="kicker">Find your estate</div>
        <h1>Search by <em>County</em>, then <em>Town/Region</em>, then <em>Estate/Area</em></h1>
        <p>Type to filter each list. If there’s no exact match, we jump to the nearest alphabetical match.</p>
      </div>

      {loading && <p className="kicker">Loading data…</p>}
      {msg && <p className="kicker" style={{color:"#ffbdbd"}}>{msg}</p>}

      <div className="grid grid-3" style={{marginTop:12}}>
        <div>
          <label className="label" htmlFor="county">County</label>
          <input
            id="county"
            className="input"
            list="counties"
            placeholder="Start typing a county…"
            value={county}
            onChange={(e)=> setCounty(closest(counties, e.target.value))}
            ref={countyRef}
            autoComplete="off"
            aria-autocomplete="list"
          />
          <datalist id="counties">
            {counties.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="town">Town / Region</label>
          <input
            id="town"
            className="input"
            list="towns"
            placeholder={county ? "Start typing a town…" : "Pick a county first"}
            value={town}
            onChange={(e)=> setTown(closest(towns, e.target.value))}
            disabled={!county}
            autoComplete="off"
            aria-autocomplete="list"
          />
          <datalist id="towns">
            {towns.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="estate">Estate / Area</label>
          <input
            id="estate"
            className="input"
            list="estates"
            placeholder={town ? "Type or choose an estate…" : "Pick a town first"}
            value={estate}
            onChange={(e)=> setEstate(closest(estates, e.target.value))}
            disabled={!town}
            autoComplete="off"
            aria-autocomplete="list"
          />
          <datalist id="estates">
            {estates.map(e => <option key={e} value={e} />)}
          </datalist>
        </div>
      </div>

      <div className="row" style={{marginTop:14}}>
        <button className="button" onClick={go} disabled={!county || !town}>Go to estate page</button>
        <button className="button secondary" onClick={()=>{ setCounty(""); setTown(""); setEstate(""); }}>Clear</button>
        <button className="button secondary" onClick={()=> setShowAdd(s=>!s)}>Don’t see yours?</button>
      </div>

      {showAdd && (
        <form onSubmit={submitSuggestion} className="card" style={{marginTop:16}}>
          <div className="grid grid-2">
            <div>
              <div className="label">County</div>
              <input name="county" className="input" defaultValue={county} required />
            </div>
            <div>
              <div className="label">Town / Region</div>
              <input name="town" className="input" defaultValue={town} required />
            </div>
            <div>
              <div className="label">Estate / Area</div>
              <input name="estate" className="input" defaultValue={estate} required />
            </div>
            <div>
              <div className="label">Email (optional – for follow-up)</div>
              <input name="email" className="input" type="email" placeholder="you@example.com" />
            </div>
          </div>
          <div style={{marginTop:12}}>
            <div className="label">Notes (optional)</div>
            <textarea name="note" className="input" rows={4} placeholder="Anything we should know?"></textarea>
          </div>
          <div className="row" style={{marginTop:12}}>
            <button className="button">Submit suggestion</button>
            <button type="button" className="button secondary" onClick={()=> setShowAdd(false)}>Cancel</button>
          </div>
          <p className="small" style={{marginTop:8}}>We only use your email to follow up on your suggestion if needed.</p>
        </form>
      )}

      <p className="small" style={{marginTop:14}}>
        Admin quick tools: <a href="/data/estates.csv" style={{color:"var(--brand)"}}>download current CSV</a>
      </p>
    </div>
  );
}
