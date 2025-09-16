// pages/api/review.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

/**
 * Email service
 * - Make sure RESEND_API_KEY is set in env (Vercel Project → Settings → Environment Variables)
 * - FROM must be allowed by your Resend plan; sandbox works with onboarding@resend.dev
 */
const resend = new Resend(process.env.RESEND_API_KEY);

// Moderation recipient + sender
const MOD_EMAIL = "seamusk84@gmail.com";
const FROM_EMAIL = "onboarding@resend.dev";

/* -------------------------------------------------------------------------- */
/*                                Types & utils                               */
/* -------------------------------------------------------------------------- */
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

// Simple helper to safely render user strings in HTML
function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toTextEmail(p: Required<ReviewPayload>) {
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

function toHtmlEmail(p: Required<ReviewPayload>) {
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

/* -------------------------------------------------------------------------- */
/*                            Basic in-memory limits                           */
/* -------------------------------------------------------------------------- */

// Very light IP-based rate limit (best-effort; per serverless instance)
const windowMs = 60_000; // 1 minute
const maxPerWindow = 5; // allow 5 reviews/IP/minute
const ipHits = new Map<string, { count: number; resetAt: number }>();

function hitLimit(ip: string) {
  const now = Date.now();
  const slot = ipHits.get(ip);
  if (!slot || slot.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  slot.count++;
  if (slot.count > maxPerWindow) return true;
  return false;
}

function getIp(req: NextApiRequest) {
  // Vercel forwards IP via x-forwarded-for
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  return (xf.split(",")[0] || req.socket.remoteAddress || "unknown").trim();
}

/* -------------------------------------------------------------------------- */
/*                                   Handler                                  */
/* -------------------------------------------------------------------------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Optional CORS for local tests (safe to remove on prod)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce JSON content for predictable parsing
  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (!ct.includes("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json" });
  }

  // Parse + normalize
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

  // Honeypot: if filled, silently accept but do nothing to avoid tipping off bots
  if (payload.website) {
    return res.status(200).json({ ok: true, silent: true });
  }

  // Validation
  const errors: string[] = [];
  const MAX_TITLE = 120;
  const MAX_BODY = 5000;

  if (!payload.county) errors.push("county is required");
  if (!payload.region) errors.push("region is required");
  if (Number.isNaN(payload.rating) || payload.rating < 1 || payload.rating > 5)
    errors.push("rating must be 1..5");
  if (!payload.title) errors.push("title is required");
  if (!payload.body) errors.push("body is required");
  if (payload.title.length > MAX_TITLE) errors.push(`title too long (max ${MAX_TITLE})`);
  if (payload.body.length > MAX_BODY) errors.push(`body too long (max ${MAX_BODY})`);

  if (errors.length) {
    return res.status(400).json({ error: "Invalid payload", details: errors });
  }

  // Rate limit by IP (best-effort)
  const ip = getIp(req);
  if (hitLimit(ip)) {
    return res.status(429).json({ error: "Too many requests, slow down." });
  }

  // Build message
  const complete: Required<ReviewPayload> = {
    county: payload.county,
    region: payload.region,
    estate: payload.estate || "All Areas",
    rating: payload.rating,
    title: payload.title,
    body: payload.body,
    user: payload.user || "",
    website: "",
  };

  const subject = `New Review: ${complete.county} · ${complete.region} · ${complete.estate} (${complete.rating}/5)`;
  const html = toHtmlEmail(complete);
  const text = toTextEmail(complete);

  // Safety: no API key
  if (!process.env.RESEND_API_KEY) {
    console.warn("[review] RESEND_API_KEY missing — skipping email send");
    return res.status(200).json({ ok: true, email: "skipped (no key)" });
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: MOD_EMAIL,
      subject,
      html,
      text,
    });

    // You can inspect `result` if needed (id, etc.)
    return res.status(200).json({ ok: true, id: (result as any)?.id ?? null });
  } catch (err) {
    console.error("[review] Resend error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
