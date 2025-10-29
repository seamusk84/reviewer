import type { NextApiRequest, NextApiResponse } from "next";
import { adminClient } from "../_adminClient";
import { requireAdminToken } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminToken(req, res)) return;

  const [r1, r2] = await Promise.all([
    adminClient
      .from("reviews")
      .select("id,title,body,created_at,status,rating,estate_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
    adminClient
      .from("area_suggestions")
      .select("id,county_id,town_id,estate_name,contact_email,created_at,status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  res.status(200).json({
    reviews: r1.data ?? [],
    areas: r2.data ?? [],
  });
}
