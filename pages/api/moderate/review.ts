import type { NextApiRequest, NextApiResponse } from "next";
import { adminClient } from "../_adminClient";
import { requireAdminToken } from "../_auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminToken(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const { id, action } = req.body || {};
  if (!id || !["approve", "decline"].includes(action)) {
    return res.status(400).json({ ok: false, error: "bad_request" });
  }
  const status = action === "approve" ? "approved" : "declined";
  const { error } = await adminClient.from("reviews").update({ status }).eq("id", id);
  if (error) return res.status(200).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
