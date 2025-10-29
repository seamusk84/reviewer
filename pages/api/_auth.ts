import type { NextApiRequest, NextApiResponse } from "next";

export function requireAdminToken(req: NextApiRequest, res: NextApiResponse): boolean {
  const header = req.headers["x-admin-token"];
  const qs = typeof req.query.token === "string" ? req.query.token : undefined;
  const token = (Array.isArray(header) ? header[0] : header) || qs;
  if (!token || token !== process.env.ADMIN_DASH_TOKEN) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}
