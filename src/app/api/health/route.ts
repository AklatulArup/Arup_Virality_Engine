import { NextResponse } from "next/server";
import { getGeminiKeys } from "@/lib/gemini-keys";
import { getApifyToken, describeApifyTokenSource } from "@/lib/apify-token";

export async function GET() {
  const mask = (v?: string | null) => (v ? `✓ ${v.slice(0, 10)}...` : "❌ NOT SET");

  // Gemini: count every configured rotation key (_2.._5), not just the primary.
  const geminiKeys = getGeminiKeys();
  const gemini     = geminiKeys.length > 0;
  const youtube    = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY_2;

  // Apify tokens resolved through the shared helper so this reflects what the
  // scrapers actually see — including which env var name supplied each one
  // (surfaces the mixed-case landmine if the "wrong" name is set).
  const tiktok    = getApifyToken("tiktok");
  const instagram = getApifyToken("instagram");
  const x         = getApifyToken("x");

  return NextResponse.json(
    {
      status: gemini && youtube
        ? "✅ All critical keys loaded"
        : !gemini ? "❌ Add GEMINI_API_KEY to Vercel" : "⚠️ YouTube key missing",
      keys: {
        "🤖 AI (Gemini)": gemini ? `✓ ${geminiKeys.length} key${geminiKeys.length === 1 ? "" : "s"} configured` : "❌ NOT SET",
        "▶ YouTube":      mask(youtube),
        "♪ TikTok":       tiktok    ? `✓ via ${describeApifyTokenSource("tiktok")}`    : "❌ NOT SET",
        "◎ Instagram":    instagram ? `✓ via ${describeApifyTokenSource("instagram")}` : "❌ NOT SET",
        "𝕏 X/Twitter":    x         ? `✓ via ${describeApifyTokenSource("x")}`         : "❌ NOT SET",
      },
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
