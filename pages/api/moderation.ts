// pages/api/moderate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""; // optional

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Lightweight password check (optional)
  if (ADMIN_PASSWORD) {
    const header = req.headers["x-admin-pass"];
    if (header !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("id, estate_id, rating, title, body, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[moderate GET] error:", error);
      return res.status(500).json({ error: "Failed to fetch pending reviews." });
    }

    return res.status(200).json({ reviews: data });
  }

  if (req.method === "POST") {
    const { id, action } = req.body || {};
    if (!id || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const status = action === "approve" ? "approved" : "rejected";

    const { error } = await supabaseAdmin.from("reviews").update({ status }).eq("id", id);
    if (error) {
      console.error("[moderate POST] update error:", error);
      return res.status(500).json({ error: "Failed to update review." });
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end("Method Not Allowed");
}
