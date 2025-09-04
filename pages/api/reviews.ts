// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || "3");
const RATE_LIMIT_SECRET = process.env.RATE_LIMIT_SECRET || "";
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || ""; // if empty, captcha is disabled

function clientIp(req: NextApiRequest) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  return (xf.split(",")[0] || req.socket.remoteAddress || "").trim();
}
function ipHash(ip: string) {
  if (!RATE_LIMIT_SECRET) return ip;
  return crypto.createHmac("sha256", RATE_LIMIT_SECRET).update(ip).digest("hex");
}

async function verifyCaptcha(token?: string, remoteip?: string) {
  if (!HCAPTCHA_SECRET) return { ok: true, reason: "captcha-disabled" };
  if (!token) return { ok: false, reason: "missing-token" };
  const body = new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token });
  if (remoteip) body.set("remoteip", remoteip);
  try {
    const r = await fetch("https://hcaptcha.com/siteverify", { method: "POST", body });
    const j = await r.json();
    return j.success ? { ok: true } : { ok: false, reason: (j["error-codes"] || []).join(",") || "captcha-failed" };
  } catch {
    return { ok: false, reason: "verify-error" };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ---- GET: list approved reviews for a page ----
    if (req.method === "GET") {
      const { county, town, estate } = req.query as Record<string, string>;
      if (!county || !town || !estate) return res.status(400).json({ error: "missing-params" });

      const { data, error } = await db
        .from("reviews")
        .select("id, inserted_at, rating, title, body, name")
        .eq("county", county)
        .eq("town", town)
        .eq("estate", estate)
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("inserted_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[REVIEWS][GET] supabase", error);
        return res.status(500).json({ error: "db-error" });
      }
      return res.status(200).json({ items: data || [] });
    }

    // ---- POST: submit a pending review ----
    if (req.method === "POST") {
      const ip = clientIp(req);
      const hash = ipHash(ip);
      const {
        county,
        town,
        estate,
        rating,
        title,
        body,
        name,
        email,
        // accept both names to avoid mismatches between page & API
        hcaptchaToken,
        captchaToken,
      } = (req.body || {}) as Record<string, any>;

      if (!county || !town || !estate || !body) {
        return res.status(400).json({ error: "invalid-payload" });
      }
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: "invalid-rating" });
      }

      // CAPTCHA (only enforced if HCAPTCHA_SECRET is set)
      const cap = await verifyCaptcha(hcaptchaToken || captchaToken, ip);
      if (!cap.ok) {
        console.warn("[HCAPTCHA] failed:", cap.reason);
        return res.status(400).json({ error: "captcha-failed", reason: cap.reason });
      }

      // Rate limit (past hour)
      if (RATE_LIMIT_SECRET) {
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: cErr } = await db
          .from("submission_log")
          .select("id", { head: true, count: "exact" })
          .eq("ip_hash", hash)
          .gte("inserted_at", since);
        if (cErr) console.warn("[RATE] count error:", cErr?.message);
        if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
          return res.status(429).json({ error: "too-many" });
        }
      }

      // Insert review
      const { error: insErr } = await db.from("reviews").insert({
        county, town, estate,
        rating: r,
        title: title || null,
        body,
        name: name || null,
        email: email || null,
        status: "pending",
        deleted_at: null,
      });
      if (insErr) {
        console.error("[REVIEWS][INSERT]", insErr);
        return res.status(500).json({ error: "insert-failed" });
      }

      // Log for rate limit window
      if (RATE_LIMIT_SECRET) {
        const { error: logErr } = await db.from("submission_log").insert({ ip_hash: hash });
        if (logErr) console.warn("[RATE] log insert warn:", logErr?.message);
      }

      // Optional email alert
      try {
        if (process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM && process.env.ALERT_EMAIL_TO) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: process.env.ALERT_EMAIL_FROM,
            to: process.env.ALERT_EMAIL_TO,
            subject: `New review pending: ${estate} — ${town}, ${county}`,
            text:
              `Location: ${county} / ${town} / ${estate}\n` +
              `Rating: ${r}\nTitle: ${title || ""}\n\n${body}\n\n` +
              `Name: ${name || "Anonymous"}\nEmail: ${email || "N/A"}\n`,
          });
        }
      } catch (e) {
        console.warn("[EMAIL] send failed:", (e as any)?.message || e);
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method-not-allowed" });
  } catch (e: any) {
    console.error("[REVIEWS] unhandled", e?.message || e);
    return res.status(500).json({ error: "server-error" });
  }
}
