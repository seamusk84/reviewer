// pages/api/moderation.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MOD_TOKEN = process.env.MODERATOR_TOKEN || "";

function unauthorized(res: NextApiResponse) {
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!url || !serviceKey) {
    return res
      .status(500)
      .json({ ok: false, error: "Supabase server key missing. Set SUPABASE_SERVICE_ROLE_KEY." });
  }

  // Expect Authorization: Bearer <token> (or x-mod-token)
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-mod-token"] as string);
  if (!token || token !== MOD_TOKEN) return unauthorized(res);

  const supabase = createClient(url, serviceKey);

  if (req.method === "GET") {
    // Filter: ?status=pending|approved|rejected
    const status = ((req.query.status as string) || "pending").toLowerCase();
    const allowed = ["pending", "approved", "rejected"];
    const filter = allowed.includes(status) ? status : "pending";

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("status", filter)
      .order("inserted_at", { ascending: false })
      .limit(200);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, reviews: data || [] });
  }

  if (req.method === "POST") {
    // { id, action: 'approve' | 'reject' | 'delete' }
    const { id, action } = req.body || {};
    if (!id || !["approve", "reject", "delete"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Bad payload" });
    }

    if (action === "delete") {
      const { error } = await supabase.from("reviews").delete().eq("id", id).limit(1);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, status: "deleted" });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("reviews")
      .update({ status: newStatus })
      .eq("id", id)
      .limit(1);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, status: newStatus });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
