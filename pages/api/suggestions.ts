// pages/api/suggestions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { county, town, estate, notes } = req.body || {};
  if (!county || !town || !estate) {
    return res.status(400).json({ error: "county, town, and estate are required." });
  }

  const { error } = await supabaseAdmin.from("suggestions").insert({
    county: String(county).slice(0, 80),
    town: String(town).slice(0, 120),
    estate: String(estate).slice(0, 160),
    notes: notes ? String(notes).slice(0, 1000) : null,
  });

  if (error) {
    console.error("[suggestions POST] insert error:", error);
    return res.status(500).json({ error: "Failed to save suggestion." });
  }

  return res.status(200).json({ ok: true });
}
