// pages/api/debug-env.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  res.status(200).json({
    ok: true,
    supabaseUrlPresent: Boolean(url),
    supabaseKeyPresent: Boolean(key),
    // lengths only, so we don't leak secrets
    urlLength: url.length,
    keyLength: key.length,
  });
}
