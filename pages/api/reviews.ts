// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Server client (uses service role; server-only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Public client (uses anon key; respects RLS)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const { estateId, rating, title, body } = req.body || {};
      if (!estateId || !rating || !body) {
        return res.status(400).json({ error: "Missing estateId, rating, or body." });
      }

      const { data, error } = await supabaseAdmin
        .from("reviews")
        .insert({
          estate_id: String(estateId),
          rating: Number(rating),
          title: title ? String(title).slice(0, 120) : null,
          body: String(body).slice(0, 5000),
          status: "pending",
        })
        .select("id, created_at, status")
        .single();

      if (error) {
        console.error("[reviews POST] insert error:", error);
        return res.status(500).json({ error: "Failed to submit review." });
      }

      return res.status(200).json({ ok: true, review: data });
    } catch (e: any) {
      console.error("[reviews POST] exception:", e);
      return res.status(500).json({ error: "Unexpected server error." });
    }
  }

  if (req.method === "GET") {
    const { estateId } = req.query;
    if (!estateId || typeof estateId !== "string") {
      return res.status(400).json({ error: "estateId is required." });
    }

    // Use anon client: RLS will only return approved reviews
    const { data, error } = await supabaseAnon
      .from("reviews")
      .select("id, rating, title, body, created_at")
      .eq("estate_id", estateId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[reviews GET] select error:", error);
      return res.status(500).json({ error: "Failed to fetch reviews." });
    }

    return res.status(200).json({ reviews: data });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end("Method Not Allowed");
}
