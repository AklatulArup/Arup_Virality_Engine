import { NextResponse } from "next/server";

export async function GET() {
  function mask(v: string | undefined) { return v ? `✓ ${v.slice(0,10)}...` : "❌ NOT SET"; }

  const geminiKey    = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;
  const groqKey      = process.env.GROQ_API_KEY;
  const youtubeKey   = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY_2;
  const instagramKey = process.env.Instagram_API_KEY_2 || process.env.Instagram_API_Key;
  const tiktokKey    = process.env.TikTok_API_Key;

  const aiResolved = geminiKey ? "gemini" : anthropicKey ? "anthropic" : groqKey ? "groq" : null;

  return NextResponse.json({
    status: aiResolved && youtubeKey ? `✅ Ready — AI via ${aiResolved.toUpperCase()}` : !aiResolved ? "❌ No AI key — add GEMINI_API_KEY to Vercel" : "⚠️ No YouTube key",
    ai_provider: aiResolved ?? "none",
    keys: {
      "🤖 Gemini (GEMINI_API_KEY)":          mask(geminiKey),
      "🤖 Anthropic (Claude_AI_Summary_API_KEY)": mask(anthropicKey),
      "🤖 Groq (GROQ_API_KEY)":              mask(groqKey),
      "🤖 AI resolved":                       aiResolved ? `Using ${aiResolved}` : "❌ NONE",
      "▶ YouTube":                            mask(youtubeKey),
      "◎ Instagram":                          mask(instagramKey),
      "♪ TikTok":                             mask(tiktokKey),
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
