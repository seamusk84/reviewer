import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabase
      .from("news_items")
      .select("text")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw error;
    res.status(200).json({ items: (data ?? []).map(r => r.text).filter(Boolean) });
  } catch {
    res.status(200).json({ items: [] });
  }
}
