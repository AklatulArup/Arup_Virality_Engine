import { NextRequest, NextResponse } from "next/server";

// News API route — fetches live trading/finance/market news
// Uses GNews API (free tier: 100 requests/day) as primary
// Falls back to keyword-based headline scraping from Google News RSS if no key set
//
// HOW TO GET A KEY:
//   GNews: https://gnews.io — free tier = 100 req/day, no CC needed
//   NewsAPI: https://newsapi.org — free tier = 100 req/day (dev only, no prod)
//   Both are free. GNews is preferred (no domain restrictions on free tier).

const TRADING_KEYWORDS = [
  "NFP", "non-farm payroll", "FOMC", "Federal Reserve", "interest rate",
  "CPI", "inflation", "market crash", "S&P 500", "Nasdaq", "Bitcoin",
  "prop firm", "funded trader", "forex", "futures", "hedge fund",
];

// Cached to avoid burning API quota on repeated requests
let newsCache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "market_event" | "prop_firm" | "crypto" | "economic_data" | "general";
  urgency: "breaking" | "recent" | "background";
  trendMultiplier: number; // estimated view multiplier for content about this topic
  hoursOld: number;
}

function categorize(title: string, desc: string): NewsItem["category"] {
  const t = `${title} ${desc}`.toLowerCase();
  if (/prop firm|funded trader|fundednext|ftmo|the5ers|myforexfunds/i.test(t)) return "prop_firm";
  if (/bitcoin|crypto|ethereum|btc|eth|defi|nft/i.test(t)) return "crypto";
  if (/nfp|cpi|fomc|gdp|inflation|payroll|fed rate|interest rate/i.test(t)) return "economic_data";
  if (/crash|dump|pump|rally|surge|plunge|market|dow|nasdaq|s&p/i.test(t)) return "market_event";
  return "general";
}

function calcUrgency(publishedAt: string): { urgency: NewsItem["urgency"]; hoursOld: number } {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const hoursOld = Math.round(ageMs / 3600000);
  const urgency: NewsItem["urgency"] =
    hoursOld < 2  ? "breaking" :
    hoursOld < 24 ? "recent"   : "background";
  return { urgency, hoursOld };
}

function calcTrendMultiplier(category: NewsItem["category"], urgency: NewsItem["urgency"]): number {
  const baseMultipliers: Record<NewsItem["category"], number> = {
    market_event:  3.5,
    economic_data: 3.0,
    prop_firm:     2.5,
    crypto:        2.8,
    general:       1.2,
  };
  const urgencyMod: Record<NewsItem["urgency"], number> = {
    breaking:   1.0,
    recent:     0.7,
    background: 0.3,
  };
  return parseFloat((baseMultipliers[category] * urgencyMod[urgency]).toFixed(2));
}

async function fetchFromGNews(query: string, apiKey: string): Promise<NewsItem[]> {
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("sortby", "publishedAt");

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`GNews error: ${res.status}`);
  const data = await res.json();

  return (data.articles ?? []).map((a: {
    title: string; description?: string; url: string;
    source?: { name?: string }; publishedAt: string;
  }) => {
    const cat = categorize(a.title, a.description ?? "");
    const { urgency, hoursOld } = calcUrgency(a.publishedAt);
    return {
      title: a.title,
      description: a.description ?? "",
      url: a.url,
      source: a.source?.name ?? "Unknown",
      publishedAt: a.publishedAt,
      category: cat,
      urgency,
      trendMultiplier: calcTrendMultiplier(cat, urgency),
      hoursOld,
    };
  });
}

// Google News RSS fallback (no API key needed)
async function fetchFromGoogleNewsRSS(query: string): Promise<NewsItem[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const text = await res.text();

    // Parse RSS items (basic XML parsing without a library)
    const items: NewsItem[] = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    for (const item of itemMatches.slice(0, 10)) {
      const title  = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
      const link   = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
      const pubDate= item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? new Date().toISOString();
      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "Google News";

      if (!title) continue;
      const cat = categorize(title, "");
      const { urgency, hoursOld } = calcUrgency(pubDate);
      items.push({
        title, description: "", url: link, source,
        publishedAt: pubDate, category: cat, urgency,
        trendMultiplier: calcTrendMultiplier(cat, urgency),
        hoursOld,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "forex trading prop firm market";
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  // Return cache if fresh
  if (!forceRefresh && newsCache && Date.now() - newsCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ items: newsCache.items, cached: true, fetchedAt: newsCache.fetchedAt });
  }

  const gnewsKey = process.env.GNEWS_API_KEY ?? process.env.GNEWS_API ?? process.env.NEWS_API_KEY;
  let items: NewsItem[] = [];

  try {
    if (gnewsKey) {
      items = await fetchFromGNews(query, gnewsKey);
    } else {
      // No API key — use Google News RSS (free, no auth)
      items = await fetchFromGoogleNewsRSS("forex OR \"prop firm\" OR \"funded trader\" OR \"market crash\" OR FOMC OR NFP OR CPI");
    }
  } catch (e) {
    // Fallback to RSS even if GNews fails
    try {
      items = await fetchFromGoogleNewsRSS("forex trading prop firm market");
    } catch {
      return NextResponse.json({ error: String(e), items: [] }, { status: 500 });
    }
  }

  // Sort: breaking first, then by trendMultiplier
  items.sort((a, b) => {
    const urgOrd = { breaking: 0, recent: 1, background: 2 };
    return (urgOrd[a.urgency] - urgOrd[b.urgency]) || (b.trendMultiplier - a.trendMultiplier);
  });

  newsCache = { items, fetchedAt: Date.now() };

  return NextResponse.json({
    items,
    cached: false,
    fetchedAt: Date.now(),
    hasApiKey: !!gnewsKey,
    source: gnewsKey ? "GNews API" : "Google News RSS (no API key — add GNEWS_API_KEY for better results)",
  });
}
