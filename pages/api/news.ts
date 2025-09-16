// pages/api/news.ts
import type { NextApiRequest, NextApiResponse } from "next";

type NewsItem = {
  source: "RTE" | "Irish Times" | "Irish Independent";
  title: string;
  link: string;
  pubDate?: string;
};

const FEEDS: { source: NewsItem["source"]; url: string }[] = [
  { source: "RTE", url: "https://www.rte.ie/rss/news.xml" },
  { source: "Irish Times", url: "https://www.irishtimes.com/rss/home/feed.xml" },
  { source: "Irish Independent", url: "https://www.independent.ie/rss" },
];

// Tiny XML helpers (no deps)
function textBetween(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : undefined;
}

// Parses up to `limit` <item> nodes from an RSS/Atom-ish feed
function parseFeed(xml: string, source: NewsItem["source"], limit = 6): NewsItem[] {
  const items: NewsItem[] = [];
  // Try common item tags: <item> (RSS) or <entry> (Atom)
  const chunks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) || [];
  for (const chunk of chunks.slice(0, limit)) {
    // Try several common fields
    const title =
      textBetween(chunk, "title")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    // <link> may be a simple tag or have href attr in Atom
    let link =
      textBetween(chunk, "link")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    if (!link) {
      const href = chunk.match(/<link[^>]*href="([^"]+)"/i);
      if (href) link = href[1];
    }
    const pubDate =
      textBetween(chunk, "pubDate") ||
      textBetween(chunk, "updated") ||
      textBetween(chunk, "dc:date") ||
      undefined;

    if (title && link) {
      items.push({ source, title, link, pubDate });
    }
  }
  return items;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const r = await fetch(f.url, { headers: { "User-Agent": "StreetSage/1.0" } });
        if (!r.ok) throw new Error(`${f.source} feed failed: ${r.status}`);
        const xml = await r.text();
        return parseFeed(xml, f.source);
      })
    );

    const items = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      // light de-dup by title text
      .reduce<NewsItem[]>((acc, cur) => {
        if (!acc.some((x) => x.title.toLowerCase() === cur.title.toLowerCase())) acc.push(cur);
        return acc;
      }, [])
      .slice(0, 18); // cap total

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300"); // 5 min on Vercel edge cache
    res.status(200).json({ items });
  } catch (e: any) {
    console.error(e);
    res.status(200).json({ items: [] }); // fail-soft: just return an empty list
  }
}
