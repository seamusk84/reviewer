// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);
const service = createClient(supabaseUrl, serviceKey);

const RATE_LIMIT_SECRET = process.env.RATE_LIMIT_SECRET || "";
const RATE_LIMIT_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR || "5", 10);

// ---------- helpers ----------
function getClientIp(req: NextApiRequest): string {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string") return xfwd.split(",")[0].trim();
  if (Array.isArray(xfwd)) return xfwd[0];
  return req.socket?.remoteAddress || "0.0.0.0";
}
function hashIp(ip: string) {
  if (!RATE_LIMIT_SECRET) return ip;
  return crypto.createHmac("sha256", RATE_LIMIT_SECRET).update(ip).digest("hex");
}
async function verifyHCaptcha(token?: string) {
  // If keys not set, treat captcha as disabled (always pass)
  if (!process.env.HCAPTCHA_SECRET || !process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY) {
    return { success: true };
  }
  if (!token) return { success: false, "error-codes": ["missing-token"] };

  const body = new URLSearchParams();
  body.set("secret", process.env.HCAPTCHA_SECRET);
  body.set("response", token);

  try {
    const r = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return await r.json();
  } catch {
    return { success: false, "error-codes": ["verify-failed"] };
  }
}

// ---------- handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    // Return approved reviews for a page
    const { county, town, estate } = req.query;
    if (!county || !town || !estate) {
      return res.status(400).json({ error: "missing-params" });
    }
    const { data, error } = await supabase
      .from("reviews")
      .select("id, inserted_at, rating, title, body, name")
      .eq("county", String(county))
      .eq("town", String(town))
      .eq("estate", String(estate))
      .eq("status", "approved")
      .is("deleted_at", null)
      .order("inserted_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: "list-failed" });
    return res.status(200).json({ items: data || [] });
  }

  if (req.method === "POST") {
    const { county, town, estate, rating, title, body, name, email, hcaptchaToken } = req.body || {};

    // 1) Rate limit
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    if (RATE_LIMIT_SECRET) {
      const { count, error: countErr } = await service
        .from("submission_log")
        .select("id", { head: true, count: "exact" })
        .eq("ip_hash", ipHash)
        .gte("inserted_at", sinceIso);

      if (countErr) return res.status(500).json({ error: "rate-limit-check-failed" });
      if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
        return res.status(429).json({ error: "Too many submissions. Please try later." });
      }
    }

    // 2) Captcha
    const cap = await verifyHCaptcha(hcaptchaToken);
    if (!cap.success) return res.status(400).json({ error: "captcha-failed" });

    // 3) Log request
    if (RATE_LIMIT_SECRET) {
      await service.from("submission_log").insert({ ip_hash: ipHash });
    }

    // 4) Insert review (pending)
    const { error: insErr } = await supabase.from("reviews").insert({
      county, town, estate, rating, title, body, name, email: email || null, status: "pending",
    });
    if (insErr) return res.status(500).json({ error: "insert-failed" });

    // 5) Optional email alert via Resend
    if (process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM && process.env.ALERT_EMAIL_TO) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.ALERT_EMAIL_FROM,
          to: process.env.ALERT_EMAIL_TO,
          subject: "New review submitted (pending)",
          text: `${county} / ${town} / ${estate}\n\nTitle: ${title}\nRating: ${rating}\n\n${body}\n\nFrom: ${name} ${email || ""}`,
        });
      } catch {
        /* non-fatal */
      }
    }

    return res.status(200).json({ ok: true, status: "pending" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
