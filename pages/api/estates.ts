// pages/api/estates.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// use anon client (RLS should allow select on estates)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabaseAnon
    .from("estates")
    .select("id, name, town, county")
    .order("county", { ascending: true })
    .order("town", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[estates GET] error:", error);
    return res.status(500).json({ error: "Failed to fetch estates" });
  }
  return res.status(200).json({ estates: data ?? [] });
}
