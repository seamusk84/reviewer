// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || "3");
const RATE_LIMIT_SECRET = process.env.RATE_LIMIT_SECRET || "fallback-secret";
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "";

function ipFromReq(req: NextApiRequest) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  return (xf.split(",")[0] || req.socket.remoteAddress || "").trim();
}
function hashIp(ip: string) {
  return crypto.createHmac("sha256", RATE_LIMIT_SECRET).update(ip).digest("hex");
}

async function verifyCaptcha(token: string | undefined, ip: string) {
  // If not configured, allow through
  if (!HCAPTCHA_SECRET) return { ok: true };
  if (!token) return { ok: false, code: "captcha-missing" };

  try {
    const body = new URLSearchParams({
      secret: HCAPTCHA_SECRET,
      response: token,
      remoteip: ip,
    });
    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      body,
    });
    const json = await res.json();
    if (json.success) return { ok: true };
    return { ok: false, code: "captcha-failed", details: json["error-codes"] };
  } catch {
    return { ok: false, code: "captcha-error" };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // -------- GET (load approved) --------
    if (req.method === "GET") {
      const { county, town, estate } = req.query;
      if (!county || !town || !estate)
        return res.status(400).json({ error: "missing-params" });

      const { data, error } = await supabase
        .from("reviews")
        .select("id, inserted_at, rating, title, body, name")
        .eq("status", "approved")
        .is("deleted_at", null)
        .eq("county", String(county))
        .eq("town", String(town))
        .eq("estate", String(estate))
        .order("inserted_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[REVIEWS][GET] supabase", error);
        return res.status(500).json({ error: "db-error" });
      }
      return res.json({ items: data || [] });
    }

    // -------- POST (submit pending) --------
    if (req.method === "POST") {
      const ip = ipFromReq(req);
      const ipHash = hashIp(ip);

      const {
        county,
        town,
        estate,
        rating,
        title,
        body,
        name,
        email,
        hcaptchaToken,
      } = req.body || {};

      if (!county || !town || !estate || !body || !rating)
        return res.status(400).json({ error: "invalid-payload" });

      const r = Number(rating);
      if (Number.isNaN(r) || r < 1 || r > 5)
        return res.status(400).json({ error: "invalid-rating" });

      // Captcha (only enforced if HCAPTCHA_SECRET is set)
      const captcha = await verifyCaptcha(hcaptchaToken, ip);
      if (!captcha.ok) {
        console.warn("[HCAPTCHA]", captcha);
        return res.status(400).json({ error: "captcha-failed" });
      }

      // Rate limit: count last 60 minutes
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount, error: rlErr } = await supabase
        .from("submission_log")
        .select("*", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("inserted_at", since);

      if (rlErr) console.error("[RATE-LIMIT] count error", rlErr);
      if ((recentCount || 0) >= RATE_LIMIT_PER_HOUR)
        return res.status(429).json({ error: "too-many" });

      // Insert review (pending)
      const { error: insErr } = await supabase.from("reviews").insert({
        county,
        town,
        estate,
        rating: r,
        title: title || null,
        body,
        name: name || null,
        email: email || null,
        status: "pending",
      });
      if (insErr) {
        console.error("[REVIEWS][INSERT]", insErr);
        return res.status(500).json({ error: "insert-failed" });
      }

      // Log submission for rate limit window
      const { error: logErr } = await supabase
        .from("submission_log")
        .insert({ ip_hash: ipHash });
      if (logErr) console.warn("[RATE-LIMIT] log insert warn", logErr);

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method-not-allowed" });
  } catch (e) {
    console.error("[REVIEWS] unhandled", e);
    return res.status(500).json({ error: "server-error" });
  }
}
