import React from "react";

type DataShape = Record<string, Record<string, string[]>>;
type Props = {
  fetchData: () => Promise<DataShape>;
  onNavigate: (path: string) => void;
};

export default function CascadingSearch({ fetchData, onNavigate }: Props) {
  const [data, setData] = React.useState<DataShape>({});
  const [counties, setCounties] = React.useState<string[]>([]);
  const [towns, setTowns] = React.useState<string[]>([]);
  const [estates, setEstates] = React.useState<string[]>([]);

  const [county, setCounty] = React.useState("");
  const [town, setTown] = React.useState("");
  const [estate, setEstate] = React.useState("");

  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const d = await fetchData();
      setData(d || {});
      const cs = Object.keys(d || {}).sort((a,b)=>a.localeCompare(b));
      setCounties(cs);
      setLoading(false);
    })();
  }, [fetchData]);

  React.useEffect(() => {
    const t = (data[county] ? Object.keys(data[county]) : []).sort((a,b)=>a.localeCompare(b));
    setTowns(t);
    setTown("");
    setEstate("");
    setEstates([]);
  }, [county]);

  React.useEffect(() => {
    const e = (data[county] && data[county][town] ? [...data[county][town]] : []).sort((a,b)=>a.localeCompare(b));
    setEstates(e);
    setEstate("");
  }, [town, county, data]);

  function go() {
    if (!county || !town || !estate) return;
    const safe = (s:string)=>encodeURIComponent(s.toLowerCase().replace(/\s+/g,"-"));
    onNavigate(`/${safe(county)}/${safe(town)}/${safe(estate)}`);
  }

  // helper to pick the first alphabetical match when typing
  function pickClosest(val: string, list: string[]) {
    const v = val.trim().toLowerCase();
    if (!v) return "";
    const exact = list.find(x => x.toLowerCase() === v);
    if (exact) return exact;
    const starts = list.find(x => x.toLowerCase().startsWith(v));
    if (starts) return starts;
    return list[0] || "";
  }

  return (
    <section id="browse">
      <h1 className="page-title">Find your estate</h1>
      <p className="page-sub">Drill down by <strong>County</strong> → <strong>Town/Region</strong> → <strong>Estate/Area</strong>.</p>

      <div className="card card-pad">
        {loading ? (
          <p className="helper">Loading places…</p>
        ) : (
          <>
            <div className="form-row form-row-3">
              {/* County */}
              <div>
                <label className="label" htmlFor="county">County</label>
                <input
                  id="county"
                  className="input"
                  placeholder="Start typing a county…"
                  list="counties"
                  value={county}
                  onChange={(e) => {
                    const v = e.target.value;
                    // allow free typing; on blur snap to closest
                    setCounty(v);
                  }}
                  onBlur={(e)=>{
                    const v = pickClosest(e.target.value, counties);
                    setCounty(v);
                  }}
                />
                <datalist id="counties">
                  {counties.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className="helper">Type to filter. We’ll pick the closest match on blur.</p>
              </div>

              {/* Town */}
              <div>
                <label className="label" htmlFor="town">Town / Region</label>
                <input
                  id="town"
                  className="input"
                  placeholder={county ? "Start typing a town…" : "Select a county first"}
                  list="towns"
                  value={town}
                  onChange={(e)=>setTown(e.target.value)}
                  onBlur={(e)=>{
                    const v = pickClosest(e.target.value, towns);
                    setTown(v);
                  }}
                  disabled={!county}
                />
                <datalist id="towns">
                  {towns.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>

              {/* Estate */}
              <div>
                <label className="label" htmlFor="estate">Estate / Area</label>
                <input
                  id="estate"
                  className="input"
                  placeholder={town ? "Start typing an estate…" : "Select a town first"}
                  list="estates"
                  value={estate}
                  onChange={(e)=>setEstate(e.target.value)}
                  onBlur={(e)=>{
                    const v = pickClosest(e.target.value, estates);
                    setEstate(v);
                  }}
                  disabled={!town}
                />
                <datalist id="estates">
                  {estates.map(e => <option key={e} value={e} />)}
                </datalist>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button className="btn" onClick={go} disabled={!county || !town || !estate}>Search</button>
              <span className="helper">Tip: choose “All Areas” to review the whole town.</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
