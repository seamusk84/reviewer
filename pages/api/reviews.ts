// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Optional email alert config
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "";
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ ok: false, error: "Supabase env vars missing" });
  }
  const supabase = createClient(supabaseUrl, supabaseAnon);

  if (req.method === "GET") {
    const { county, town, estate } = req.query as Record<string, string>;
    if (!county || !town || !estate) {
      return res.status(400).json({ ok: false, error: "Missing county/town/estate" });
    }

    const { data, error } = await supabase
      .from("reviews")
      .select("id, inserted_at, rating, title, body, name")
      .eq("county", county)
      .eq("town", town)
      .eq("estate", estate)
      .eq("status", "approved")
      .is("deleted_at", null)
      .order("inserted_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, reviews: data || [] });
  }

  if (req.method === "POST") {
    try {
      const { county, town, estate, rating, title, body, name, email } = req.body || {};
      if (!county || !town || !estate || !rating) {
        return res.status(400).json({ ok: false, error: "Missing fields" });
      }
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        return res.status(400).json({ ok: false, error: "Rating must be 1–5" });
      }

      const { error } = await supabase.from("reviews").insert([{
        county, town, estate, rating: r,
        title: (title || "").slice(0, 120) || null,
        body: (body || "").slice(0, 2000) || null,
        name: (name || "").slice(0, 80) || null,
        email: (email || "").slice(0, 120) || null,
        status: "pending",
        deleted_at: null,
      }]);
      if (error) return res.status(500).json({ ok: false, error: error.message });

      // Optional email alert — only if env vars are set; try to load 'resend' dynamically.
      if (RESEND_API_KEY && ALERT_EMAIL_FROM && ALERT_EMAIL_TO) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const maybe = require("resend"); // will throw if not installed
          const Resend = maybe.Resend || maybe.default;
          const resend = new Resend(RESEND_API_KEY);
          await resend.emails.send({
            from: ALERT_EMAIL_FROM,
            to: ALERT_EMAIL_TO,
            subject: `New review pending: ${estate} — ${town}, ${county}`,
            text:
              `A new review was submitted.\n\n` +
              `Location: ${county} / ${town} / ${estate}\n` +
              `Rating: ${r}\n` +
              `Title: ${title || ""}\n\n` +
              `${body || ""}\n\n` +
              `Name: ${name || "Anonymous"}\n` +
              `Email: ${email || "N/A"}\n`,
          });
        } catch {
          // 'resend' not installed or send failed — ignore for now
        }
      }

      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
