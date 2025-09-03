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
    return res.status(500).json({ ok: false, error: "Server keys missing" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== MOD_TOKEN) return unauthorized(res);

  const supabase = createClient(url, serviceKey);

  if (req.method === "GET") {
    // view=pending|approved|rejected|deleted  (default pending)
    const view = ((req.query.view as string) || "pending").toLowerCase();

    let q = supabase.from("reviews").select("*").order("inserted_at", { ascending: false });

    if (view === "deleted") {
      q = q.not("deleted_at", "is", null);
    } else {
      q = q.is("deleted_at", null).eq("status", view);
    }

    const { data, error } = await q.limit(500);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, reviews: data || [] });
  }

  if (req.method === "POST") {
    // { ids: string[]; action: 'approve'|'reject'|'delete'|'restore' }
    const { ids, action } = req.body || {};
    const list: string[] = Array.isArray(ids) ? ids : [];
    if (!list.length || !["approve", "reject", "delete", "restore"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Bad payload" });
    }

    if (action === "delete") {
      const { error } = await supabase
        .from("reviews")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", list);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, status: "deleted" });
    }

    if (action === "restore") {
      const { error } = await supabase.from("reviews").update({ deleted_at: null }).in("id", list);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, status: "restored" });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error } = await supabase.from("reviews").update({ status: newStatus }).in("id", list);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, status: newStatus });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
