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

function getClientIp(req: NextApiRequest): string {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string") return xfwd.split(",")[0].trim();
  if (Array.isArray(xfwd)) return xfwd[0];
  return (req.socket && req.socket.remoteAddress) || "0.0.0.0";
}

function hashIp(ip: string): string {
  if (!RATE_LIMIT_SECRET) return ip;
  return crypto.createHmac("sha256", RATE_LIMIT_SECRET).update(ip).digest("hex");
}

async function verifyHCaptcha(token?: string) {
  if (!process.env.HCAPTCHA_SECRET || !process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY) {
    return { success: true }; // captcha disabled
  }
  if (!token) return { success: false, "error-codes": ["missing-token"] };

  const body = new URLSearchParams();
  body.set("secret", process.env.HCAPTCHA_SECRET);
  body.set("response", token);

  try {
    const resp = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return await resp.json();
  } catch {
    return { success: false, "error-codes": ["verify-failed"] };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { county, town, estate, rating, title, body, name, email, hcaptchaToken } = req.body || {};
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // 1) Rate limit
    if (RATE_LIMIT_SECRET) {
      const { count, error } = await service
        .from("submission_log")
        .select("id", { head: true, count: "exact" })
        .eq("ip_hash", ipHash)
        .gte("inserted_at", sinceIso);

      console.log("[RL] ip:", ip, "hash:", ipHash, "count:", count, "since:", sinceIso, "limit:", RATE_LIMIT_PER_HOUR);

      if (error) {
        console.error("[RL] count error:", error);
        return res.status(500).json({ error: "rate-limit-check-failed" });
      }
      if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
        return res.status(429).json({ error: "Too many submissions. Please try later." });
      }
    }

    // 2) hCaptcha
    const cap = await verifyHCaptcha(hcaptchaToken);
    if (!cap.success) {
      console.warn("[HCAPTCHA] failed:", cap);
      return res.status(400).json({ error: "captcha-failed" });
    }

    // 3) Insert log row
    if (RATE_LIMIT_SECRET) {
      const { error: logErr } = await service.from("submission_log").insert({ ip_hash: ipHash });
      if (logErr) console.error("[RL] log insert error:", logErr);
    }

    // 4) Insert review (pending)
    const { error: insErr } = await supabase.from("reviews").insert({
      county, town, estate, rating, title, body, name, email: email || null, status: "pending",
    });
    if (insErr) {
      console.error("[REVIEWS] insert error:", insErr);
      return res.status(500).json({ error: "insert-failed" });
    }

    // 5) Optional email alert
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
      } catch (e) {
        console.warn("[EMAIL] send failed", e);
      }
    }

    return res.status(200).json({ ok: true, status: "pending" });
  } catch (e) {
    console.error("[API] unexpected error", e);
    return res.status(500).json({ error: "unexpected" });
  }
}
