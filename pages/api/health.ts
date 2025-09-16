import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    resendConfigured: !!process.env.RESEND_API_KEY,
    // don’t print the key – just lengths to sanity check
    keyLen: process.env.RESEND_API_KEY?.length ?? 0,
  });
}
