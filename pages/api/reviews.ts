// pages/api/reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Create Supabase clients
// --- Admin client (uses service_role key, bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// --- Public client (uses anon key, respects RLS)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle POST → create a new review
  if (req.method === "POST") {
    try {
      const { estateId, rating, title, body } = req.body || {};

      // Basic validation
      if (!estateId || !rating || !body) {
        return res.status(400).json({ error: "Missing estateId, rating, or body." });
      }

      // Insert as 'pending' for moderation
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

  // Handle GET → fetch approved reviews for one estate
  if (req.method === "GET") {
    const { estateId } = req.query;

    if (!estateId || typeof estateId !== "string") {
      return res.status(400).json({ error: "estateId is required." });
    }

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

  // Method not allowed
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end("Method Not Allowed");
}
