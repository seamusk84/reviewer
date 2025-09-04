// pages/api/debug-env.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    supabaseUrlPresent: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    moderatorTokenPresent: !!process.env.MODERATOR_TOKEN,
    captchaConfigured:
      !!process.env.HCAPTCHA_SECRET && !!process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY,
    rateLimitSecretPresent: !!process.env.RATE_LIMIT_SECRET,
    rateLimitPerHour: process.env.RATE_LIMIT_PER_HOUR || "(unset)",
  });
}
