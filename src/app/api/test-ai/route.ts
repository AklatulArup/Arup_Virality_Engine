import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set in Vercel environment variables" });

  const results: Record<string, unknown> = { key: `✓ ${apiKey.slice(0,12)}...` };

  for (const model of ["gemini-2.0-flash", "gemini-1.5-flash-latest"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say: OK" }] }] }),
        }
      );
      const d = await r.json();
      results[model] = { ok: r.ok, response: d.candidates?.[0]?.content?.parts?.[0]?.text ?? null, error: d.error?.message ?? null };
      if (r.ok) break;
    } catch (e) { results[model] = { error: String(e) }; }
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
