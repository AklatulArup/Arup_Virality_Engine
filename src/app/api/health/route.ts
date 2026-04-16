import { NextResponse } from "next/server";

export async function GET() {
  function mask(val: string | undefined): string {
    if (!val) return "❌ NOT SET";
    return "✓ " + val.slice(0, 8) + "…" + val.slice(-4);
  }

  const openRouterKey  = process.env.OPENROUTER_API_KEY;
  const anthropicKey   = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;
  const youtubeKey     = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY_2;
  const instagramKey   = process.env.Instagram_API_KEY_2 || process.env.Instagram_API_Key;
  const tiktokKey      = process.env.TikTok_API_Key;

  const aiResolved = openRouterKey ? "openrouter" : anthropicKey ? "anthropic" : null;

  const keys = {
    "🤖 AI — OpenRouter (OPENROUTER_API_KEY)":      mask(openRouterKey),
    "🤖 AI — Anthropic (Claude_AI_Summary_API_KEY)": mask(process.env.Claude_AI_Summary_API_KEY),
    "🤖 AI — Resolved (will use)":                   aiResolved ? `✓ Using ${aiResolved}` : "❌ NO AI KEY — all AI features disabled",
    "▶ YouTube (YOUTUBE_API_KEY)":                   mask(process.env.YOUTUBE_API_KEY),
    "▶ YouTube (YOUTUBE_API_KEY_2)":                 mask(process.env.YOUTUBE_API_KEY_2),
    "▶ YouTube resolved":                            mask(youtubeKey),
    "◎ Instagram (Instagram_API_KEY_2)":             mask(process.env.Instagram_API_KEY_2),
    "◎ Instagram resolved":                          mask(instagramKey),
    "♪ TikTok (TikTok_API_Key)":                    mask(tiktokKey),
  };

  return NextResponse.json({
    status: aiResolved && youtubeKey
      ? `✅ All critical keys loaded — AI via ${aiResolved.toUpperCase()}`
      : !aiResolved
        ? "❌ No AI key — add OPENROUTER_API_KEY to Vercel env vars"
        : "⚠️ AI loaded but YouTube key missing",
    ai_model: aiResolved === "openrouter" ? "claude-sonnet-4-5 via OpenRouter" : aiResolved === "anthropic" ? "claude-sonnet-4-20250514 direct" : "none",
    keys,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
