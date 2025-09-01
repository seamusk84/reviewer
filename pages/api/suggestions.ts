import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  console.log("New suggestion:", req.body); // View in Vercel → Functions → Logs
  return res.status(200).json({ ok: true });
}
