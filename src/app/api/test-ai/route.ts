import { NextResponse } from "next/server";

export async function GET() {
  const geminiKey    = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;
  const groqKey      = process.env.GROQ_API_KEY;

  const results: Record<string, unknown> = {
    keys: {
      gemini:    geminiKey    ? `✓ ${geminiKey.slice(0,12)}...`    : "❌ NOT SET — add GEMINI_API_KEY",
      anthropic: anthropicKey ? `✓ ${anthropicKey.slice(0,12)}...` : "❌ NOT SET",
      groq:      groqKey      ? `✓ ${groqKey.slice(0,12)}...`      : "❌ NOT SET — add GROQ_API_KEY",
    }
  };

  // Test Gemini
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say: OK" }] }] }),
        }
      );
      const d = await r.json();
      results.gemini_test = {
        status: r.status, ok: r.ok,
        response: d.candidates?.[0]?.content?.parts?.[0]?.text ?? null,
        error: d.error?.message ?? null,
      };
    } catch (e) { results.gemini_test = { error: String(e) }; }
  }

  // Test Anthropic
  if (anthropicKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 20, messages: [{ role: "user", content: "Say: OK" }] }),
      });
      const d = await r.json();
      results.anthropic_test = {
        status: r.status, ok: r.ok,
        response: d.content?.[0]?.text ?? null,
        error: d.error?.message ?? null,
      };
    } catch (e) { results.anthropic_test = { error: String(e) }; }
  }

  // Test Groq
  if (groqKey) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.1-8b-instant", max_tokens: 20, messages: [{ role: "user", content: "Say: OK" }] }),
      });
      const d = await r.json();
      results.groq_test = {
        status: r.status, ok: r.ok,
        response: d.choices?.[0]?.message?.content ?? null,
        error: d.error?.message ?? null,
      };
    } catch (e) { results.groq_test = { error: String(e) }; }
  }

  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
