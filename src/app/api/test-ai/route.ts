import { NextResponse } from "next/server";

export async function GET() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;

  const results: Record<string, unknown> = {
    keys: {
      openrouter: openRouterKey ? `✓ set (${openRouterKey.slice(0,12)}...)` : "❌ NOT SET",
      anthropic:  anthropicKey  ? `✓ set (${anthropicKey.slice(0,12)}...)`  : "❌ NOT SET",
    }
  };

  // Test OpenRouter with smallest free model
  if (openRouterKey) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://virality-engin.vercel.app",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct:free",
          max_tokens: 20,
          messages: [{ role: "user", content: "Say: OK" }],
        }),
      });
      const d = await r.json();
      results.openrouter_test = {
        status: r.status,
        ok: r.ok,
        response: d.choices?.[0]?.message?.content ?? null,
        error: d.error ?? null,
      };
    } catch (e) {
      results.openrouter_test = { error: String(e) };
    }
  }

  // Test Anthropic
  if (anthropicKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 20,
          messages: [{ role: "user", content: "Say: OK" }],
        }),
      });
      const d = await r.json();
      results.anthropic_test = {
        status: r.status,
        ok: r.ok,
        response: d.content?.[0]?.text ?? null,
        error: d.error ?? null,
      };
    } catch (e) {
      results.anthropic_test = { error: String(e) };
    }
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
