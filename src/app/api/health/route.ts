import { NextResponse } from "next/server";

export async function GET() {
  const mask = (v?: string) => v ? `✓ ${v.slice(0,10)}...` : "❌ NOT SET";
  const gemini   = process.env.GEMINI_API_KEY;
  const youtube  = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY_2;
  const instagram= process.env.Instagram_API_KEY_2 || process.env.Instagram_API_Key;
  const tiktok   = process.env.TikTok_API_Key;

  return NextResponse.json({
    status: gemini && youtube ? "✅ All critical keys loaded" : !gemini ? "❌ Add GEMINI_API_KEY to Vercel" : "⚠️ YouTube key missing",
    keys: {
      "🤖 AI (GEMINI_API_KEY)": mask(gemini),
      "▶ YouTube":              mask(youtube),
      "◎ Instagram":            mask(instagram),
      "♪ TikTok":               mask(tiktok),
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
