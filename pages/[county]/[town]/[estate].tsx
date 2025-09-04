import { useRouter } from "next/router";
import Script from "next/script";
import { useEffect, useMemo, useState, FormEvent } from "react";

type Review = {
  id: string;
  inserted_at: string;
  rating: number;
  title: string | null;
  body: string;
  name: string | null;
};

declare global {
  interface Window {
    onHcaptchaVerified?: (token: string) => void;
    hcaptcha?: { reset: () => void };
  }
}

const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "";

export default function EstatePage() {
  const router = useRouter();
  const { county, town, estate } = router.query;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [submitOk, setSubmitOk] = useState<boolean>(false);

  const [captchaToken, setCaptchaToken] = useState<string>("");

  useEffect(() => {
    window.onHcaptchaVerified = (token: string) => setCaptchaToken(token);
  }, []);

  const pageKey = useMemo(() => {
    if (!county || !town || !estate) return "";
    return `${county}:${town}:${estate}`;
  }, [county, town, estate]);

  useEffect(() => {
    if (!county || !town || !estate) return;
    (async () => {
      setLoadingList(true);
      setLoadError("");
      try {
        const qs = new URLSearchParams({
          county: String(county),
          town: String(town),
          estate: String(estate),
        });
        const res = await fetch(`/api/reviews?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data?.error || "Failed to load reviews");
          setReviews([]);
        } else {
          setReviews(Array.isArray(data?.items) ? data.items : []);
        }
      } catch {
        setLoadError("Failed to load reviews");
        setReviews([]);
      } finally {
        setLoadingList(false);
      }
    })();
  }, [pageKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitOk(false);
    setSubmitError("");

    if (siteKey && !captchaToken) {
      setSubmitError("Please complete the captcha.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          county,
          town,
          estate,
          rating: Number(rating),
          title,
          body,
          name,
          email,
          hcaptchaToken: captchaToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error || "Submit failed");
      } else {
        setSubmitOk(true);
        setTitle("");
        setBody("");
        setName("");
        setEmail("");
        setRating(5);
        setCaptchaToken("");
        try { window.hcaptcha?.reset?.(); } catch {}
      }
    } catch {
      setSubmitError("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const heading = useMemo(() => {
    const c = String(county || "");
    const t = String(town || "");
    const e = String(estate || "");
    if (e.toLowerCase() === "all areas") return `All Areas — ${t}, ${c}`;
    return `${e} — ${t}, ${c}`;
  }, [county, town, estate]);

  return (
    <div>
      <h1 className="page-title">{heading}</h1>
      <p className="page-sub">New reviews are moderated before publishing.</p>

      <section className="card card-pad" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Leave a review</h2>

        {!!submitOk && (
          <div className="card card-pad" style={{ background: "#ecfdf5", borderColor: "#bbf7d0", color: "#065f46", padding: "12px", marginBottom: "10px" }}>
            Thanks! Your review was submitted and is pending approval.
          </div>
        )}
        {!!submitError && (
          <div className="card card-pad" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#7f1d1d", padding: "12px", marginBottom: "10px" }}>
            {submitError}
          </div>
        )}

        <form onSubmit={onSubmit} className="form-row" style={{ gap: 14 }}>
          <div className="form-row form-row-3">
            <div>
              <label className="label">Rating (1–5)</label>
              <input className="input" type="number" min={1} max={5} value={rating}
                     onChange={(e)=>setRating(Number(e.target.value)||5)} />
            </div>
            <div>
              <label className="label">Title (optional)</label>
              <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Short headline" />
            </div>
            <div>
              <label className="label">Your name (optional)</label>
              <input className="input" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Name" />
            </div>
          </div>

          <div>
            <label className="label">Your review</label>
            <textarea className="input" rows={6} value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Share your experience…" required />
          </div>

          <div className="form-row form-row-2">
            <div>
              <label className="label">Email (optional, not shown)</label>
              <input className="input" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              {/* hCaptcha (only renders if siteKey provided) */}
              {siteKey && (
                <>
                  <Script src="https://js.hcaptcha.com/1/api.js" strategy="afterInteractive" />
                  <div className="h-captcha" data-sitekey={siteKey} data-callback="onHcaptchaVerified" />
                  {/* <small className="helper">captcha token: {captchaToken ? `${captchaToken.length} chars` : 'none'}</small> */}
                </>
              )}
            </div>
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>
      </section>

      <section className="card card-pad">
        <h2 style={{ marginTop: 0 }}>Recent reviews</h2>
        {loadingList && <p className="helper">Loading…</p>}
        {!!loadError && <p className="helper" style={{ color: "#b91c1c" }}>{loadError}</p>}
        {!loadingList && !loadError && reviews.length === 0 && (
          <p className="helper">No reviews yet.</p>
        )}
        <div>
          {reviews.map((r) => (
            <div key={r.id} className="review-item">
              <div className="review-meta">
                {new Date(r.inserted_at).toLocaleDateString()} • <span className="stars">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
              </div>
              <div style={{ fontWeight: 600 }}>{r.title || "(No title)"}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>
              <div className="review-meta">{r.name ? `by ${r.name}` : ""}</div>
              <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
