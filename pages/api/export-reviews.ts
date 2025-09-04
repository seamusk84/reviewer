// pages/api/export-reviews.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MOD_TOKEN = process.env.MODERATOR_TOKEN || "";

type View = "pending" | "approved" | "rejected" | "deleted";

function unauthorized(res: NextApiResponse) {
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

function esc(v: unknown): string {
  // CSV escape: wrap in quotes, double internal quotes
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== MOD_TOKEN) return unauthorized(res);

  if (!url || !serviceKey) {
    return res.status(500).json({ ok: false, error: "Server keys missing" });
  }

  const supabase = createClient(url, serviceKey);

  try {
    let view: View = "pending";
    let ids: string[] | undefined;

    if (req.method === "GET") {
      view = ((req.query.view as string) || "pending").toLowerCase() as View;
    } else if (req.method === "POST") {
      view = ((req.body?.view as string) || "pending").toLowerCase() as View;
      if (Array.isArray(req.body?.ids)) {
        ids = req.body.ids.filter((x: unknown) => typeof x === "string");
      }
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // Build query
    let q = supabase
      .from("reviews")
      .select(
        "id, inserted_at, county, town, estate, rating, title, body, name, email, status, deleted_at",
        { head: false }
      )
      .order("inserted_at", { ascending: false });

    if (ids && ids.length) {
      q = q.in("id", ids);
    } else {
      if (view === "deleted") {
        q = q.not("deleted_at", "is", null);
      } else {
        q = q.is("deleted_at", null).eq("status", view);
      }
    }

    const { data, error } = await q.limit(5000); // guardrail
    if (error) return res.status(500).json({ ok: false, error: error.message });

    const rows = data || [];

    // Build CSV
    const header = [
      "id",
      "inserted_at",
      "county",
      "town",
      "estate",
      "rating",
      "title",
      "body",
      "name",
      "email",
      "status",
      "deleted_at",
    ];
    const lines = [header.join(",")];

    for (const r of rows) {
      lines.push(
        [
          esc(r.id),
          esc(r.inserted_at),
          esc(r.county),
          esc(r.town),
          esc(r.estate),
          esc(r.rating),
          esc(r.title),
          esc(r.body),
          esc(r.name),
          esc(r.email),
          esc(r.status),
          esc(r.deleted_at),
        ].join(",")
      );
    }

    const csv = lines.join("\n");
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename =
      ids && ids.length
        ? `reviews-selected-${stamp}.csv`
        : `reviews-${view}-${stamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Unknown error" });
  }
}
