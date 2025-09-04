// pages/[county]/[town]/[estate].tsx
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

  // form state
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [submitOk, setSubmitOk] = useState<boolean>(false);

  // hCaptcha
  const [captchaToken, setCaptchaToken] = useState<string>("");

  // register the global callback that hCaptcha calls
  useEffect(() => {
    window.onHcaptchaVerified = (token: string) => {
      setCaptchaToken(token);
    };
  }, []);

  const pageKey = useMemo(() => {
    if (!county || !town || !estate) return "";
    return `${county}:${town}:${estate}`;
  }, [county, town, estate]);

  // load approved reviews
  useEffect(() => {
    if (!county || !town || !estate) return;

    const fetchReviews = async () => {
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
      } catch (e: any) {
        setLoadError("Failed to load reviews");
        setReviews([]);
      } finally {
        setLoadingList(false);
      }
    };

    fetchReviews();
  }, [pageKey]); // reload when page key changes

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitOk(false);
    setSubmitError("");

    // If captcha is enabled (siteKey present), require the token
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

        // reset captcha after successful submit
        setCaptchaToken("");
        try {
          window.hcaptcha?.reset?.();
        } catch {}

        // (Optional) re-fetch list so you can see it after approval later
      }
    } catch (e: any) {
      setSubmitError("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const heading = useMemo(() => {
    const c = String(county || "");
    const t = String(town || "");
    const e = String(estate || "");
    if (e.toLowerCase() === "all areas") {
      return `all areas — ${t}, ${c}`;
    }
    return `${e} — ${t}, ${c}`;
  }, [county, town, estate]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-semibold mb-1">{heading}</h1>
      <p className="text-sm text-slate-400 mb-6">
        New reviews are moderated before publishing.
      </p>

      {/* Reviews */}
      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Reviews</h2>
        {loadingList && <p className="text-slate-400">Loading…</p>}
        {!!loadError && (
          <p className="text-red-400 text-sm mb-3">{loadError}</p>
        )}
        {!loadingList && !loadError && reviews.length === 0 && (
          <p className="text-slate-400 text-sm">No reviews yet.</p>
        )}
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-800 p-4">
              <div className="text-sm text-slate-400">
                {new Date(r.inserted_at).toLocaleDateString()}
              </div>
              <div className="font-semibold">
                {r.title || "(No title)"} • {r.rating}/5
              </div>
              <div className="whitespace-pre-wrap">{r.body}</div>
              <div className="text-sm text-slate-400 mt-1">
                {r.name ? `by ${r.name}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Write a review */}
      <section>
        <h2 className="text-lg font-medium mb-3">Write a review</h2>

        {!!submitOk && (
          <div className="mb-3 rounded bg-emerald-800/40 px-3 py-2 text-sm">
            Thanks! Your review was submitted and is pending approval.
          </div>
        )}
        {!!submitError && (
          <div className="mb-3 rounded bg-rose-900/40 px-3 py-2 text-sm">
            {submitError}
          </div>
        )}

        <form onSubmit={onSubmit} className="rounded-xl bg-slate-800 p-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Rating (1–5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value) || 5)}
              className="w-full rounded bg-slate-900 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2"
              placeholder="Short headline"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Your review</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 h-40"
              placeholder="Share your experience…"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Your name (optional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded bg-slate-900 px-3 py-2"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Email (optional, not shown)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded bg-slate-900 px-3 py-2"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* hCaptcha (only rendered if a sitekey exists) */}
          {siteKey && (
            <>
              <Script
                src="https://js.hcaptcha.com/1/api.js"
                strategy="afterInteractive"
              />
              <div
                className="h-captcha mt-2"
                data-sitekey={siteKey}
                data-callback="onHcaptchaVerified"
              />
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded bg-emerald-500 px-4 py-2 font-medium text-emerald-950 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>
      </section>
    </div>
  );
}
