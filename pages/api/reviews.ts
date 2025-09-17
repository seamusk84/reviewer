// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

/** ------------------------ ENV ------------------------ */
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MOD_EMAIL = process.env.MOD_EMAIL || "seamusk84@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const resendKey = process.env.RESEND_API_KEY;

/** ------------------------ DB ------------------------- */
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

/** ---------------------- Email ------------------------ */
const resend = resendKey ? new Resend(resendKey) : null;

/** ---------------------- Types ------------------------ */
type ReviewPayload = {
  county: string;
  region: string;
  estate?: string; // "All Areas" allowed
  rating: number; // 1..5
  title: string;
  body: string;
  user?: string;
  // Honeypot (should be empty)
  website?: string;
};

type DBReview = {
  id: string;
  created_at: string | null;
  inserted_at: string | null;
  county: string;
  region: string;
  estate: string;
  rating: number;
  title: string;
  body: string;
  user_display: string | null;
  status: "pending" | "approved" | "rejected";
  deleted_at: string | null;
};

/** --------------------- Helpers ----------------------- */
function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailText(p: Required<ReviewPayload>) {
  return [
    "New StreetSage Review",
    "",
    `County: ${p.county}`,
    `Region: ${p.region}`,
    `Estate/Town: ${p.estate}`,
    `Rating: ${p.rating} / 5`,
    `Title: ${p.title}`,
    "",
    "Body:",
    p.body,
    "",
    `User: ${p.user || "Anonymous"}`,
  ].join("\n");
}

function emailHtml(p: Required<ReviewPayload>) {
  return `
  <div style="font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5">
    <h2 style="margin:0 0 12px">New StreetSage Review</h2>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>County</strong></td><td>${esc(p.county)}</td></tr>
      <tr><td><strong>Region</strong></td><td>${esc(p.region)}</td></tr>
      <tr><td><strong>Estate/Town</strong></td><td>${esc(p.estate)}</td></tr>
      <tr><td><strong>Rating</strong></td><td>${p.rating} / 5</td></tr>
      <tr><td><strong>Title</strong></td><td>${esc(p.title)}</td></tr>
      <tr><td valign="top"><strong>Body</strong></td>
          <td><div style="white-space:pre-wrap;border:1px solid #eee;border-radius:8px;padding:12px;background:#fafafa">${esc(
            p.body
          )}</div></td></tr>
      <tr><td><strong>User</strong></td><td>${esc(p.user || "Anonymous")}</td></tr>
    </table>
  </div>`;
}

/** ----------------- Light rate limit ------------------ */
const windowMs = 60_000; // 1 minute
const maxPerWindow = 5; // 5 reviews/IP/min
const ipHits = new Map<string, { n: number; reset: number }>();
function hit(ip: string) {
  const now = Date.now();
  const slot = ipHits.get(ip);
  if (!slot || slot.reset < now) {
    ipHits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  slot.n++;
  return slot.n > maxPerWindow;
}
const ipOf = (req: NextApiRequest) =>
  ((req.headers["x-forwarded-for"] as string) || "")
    .split(",")[0]
    .trim() || req.socket.remoteAddress || "unknown";

/** ---------------------- Handler ---------------------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS (optional)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);

  res.setHeader("Allow", "GET, POST, OPTIONS");
  return res.status(405).json({ error: "Method not allowed" });
}

/** ------------------------- GET ----------------------- */
/** Public read: used by the estate page to fetch approved reviews */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) return res.status(500).json({ error: "Storage not configured" });

  const { status = "approved", county = "", region = "", estate = "" } =
    req.query as Record<string, string>;

  let q = supabase
    .from<DBReview>("reviews")
    .select(
      "id, created_at, inserted_at, county, region, estate, rating, title, body, user_display, status, deleted_at"
    )
    .eq("status", status)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (county) q = q.eq("county", county);
  if (region) q = q.eq("region", region);
  if (estate) q = q.eq("estate", estate);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Map to the lean shape your UI expects
  const reviews = (data || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at || r.inserted_at, // tolerate either
    rating: r.rating,
    title: r.title,
    body: r.body,
    user: r.user_display || undefined,
  }));

  return res.status(200).json({ reviews });
}

/** ------------------------ POST ----------------------- */
/** Create pending review + send moderation email */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) return res.status(500).json({ error: "Storage not configured" });

  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (!ct.includes("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json" });
  }

  const raw = (req.body || {}) as Partial<ReviewPayload>;
  const payload: ReviewPayload = {
    county: String(raw.county ?? "").trim(),
    region: String(raw.region ?? "").trim(),
    estate: String(raw.estate ?? "All Areas").trim() || "All Areas",
    rating: Number(raw.rating ?? 0),
    title: String(raw.title ?? "").trim(),
    body: String(raw.body ?? "").trim(),
    user: String(raw.user ?? "").trim() || undefined,
    website: String(raw.website ?? "").trim(), // honeypot
  };

  // Honeypot: silently accept
  if (payload.website) return res.status(200).json({ ok: true, skipped: true });

  // Validate
  const errors: string[] = [];
  if (!payload.county) errors.push("county is required");
  if (!payload.region) errors.push("region is required");
  if (Number.isNaN(payload.rating) || payload.rating < 1 || payload.rating > 5)
    errors.push("rating must be 1..5");
  if (!payload.title) errors.push("title is required");
  if (!payload.body) errors.push("body is required");
  if (payload.title.length > 120) errors.push("title too long");
  if (payload.body.length > 5000) errors.push("body too long");
  if (errors.length) return res.status(400).json({ error: "Invalid payload", details: errors });

  // Rate limit
  const ip = ipOf(req);
  if (hit(ip)) return res.status(429).json({ error: "Too many requests, slow down." });

  // Insert into Supabase as 'pending'
  const insert = {
    county: payload.county,
    region: payload.region,
    estate: payload.estate || "All Areas",
    rating: payload.rating,
    title: payload.title,
    body: payload.body,
    user_display: payload.user || null,
    status: "pending" as const,
  };

  const { data, error } = await supabase
    .from("reviews")
    .insert(insert)
    .select("id")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Send moderation email (best effort)
  if (resend) {
    try {
      const full: Required<ReviewPayload> = {
        county: payload.county,
        region: payload.region,
        estate: payload.estate || "All Areas",
        rating: payload.rating,
        title: payload.title,
        body: payload.body,
        user: payload.user || "",
        website: "",
      };
      await resend.emails.send({
        from: FROM_EMAIL,
        to: MOD_EMAIL,
        subject: `New Review: ${full.county} · ${full.region} · ${full.estate} (${full.rating}/5)`,
        html: emailHtml(full),
        text: emailText(full),
      });
    } catch (e) {
      console.warn("[reviews] email send failed:", e);
    }
  }

  return res.status(200).json({ ok: true, id: data?.id ?? null });
}
