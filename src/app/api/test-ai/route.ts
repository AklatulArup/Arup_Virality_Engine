import { NextResponse } from "next/server";

export async function GET() {
  const apiKey =
    process.env.Claude_AI_Summary_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY;

  if (!apiKey) return NextResponse.json({
    error: "No key found",
    checked: ["Claude_AI_Summary_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
  });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        messages: [{ role: "user", content: "Say: OK" }],
      }),
    });
    const d = await r.json();
    return NextResponse.json({
      key_prefix: apiKey.slice(0, 15) + "...",
      status: r.status,
      ok: r.ok,
      response: d.content?.[0]?.text ?? null,
      error: d.error ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
