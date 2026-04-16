import { NextRequest, NextResponse } from "next/server";

const PERSONA_SYSTEMS: Record<string, string> = {
  algorithm:    "You are an Algorithm Analyst. Write EXACTLY 3 sentences about this video. State what the algorithm is doing right now, the key limiting or driving signal, and what would change the outcome. Use numbers. No fluff.",
  strategist:   "You are a Content Strategist. Write EXACTLY 3 sentences. State whether the hook and title are working citing the engagement number, the structural reason it is succeeding or failing, and the single highest-leverage change.",
  psychologist: "You are an Audience Psychologist. Write EXACTLY 3 sentences. State the emotional need being met citing comment density, what this audience does after watching, and the retention risk.",
  competitor:   "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. State where this video outperforms the pool, where it loses ground, and what is being left on the table.",
  verdict:      "You are a Chief Intelligence Officer. Write exactly 3 short paragraphs separated by a blank line. No headers. No bullets. No markdown. Paragraph 1: what the algorithm is doing right now and why. Paragraph 2: what will happen in the forecast window and the kill condition. Paragraph 3: one action to take within 48 hours and one mistake to avoid.",
  default:      "You are a content intelligence analyst. Write 2 concise paragraphs. Be specific with numbers. No bullet points.",
};

function trimPrompt(prompt: string, maxChars = 2500): string {
  if (prompt.length <= maxChars) return prompt;
  return prompt.slice(0, maxChars) + "\n\n[context trimmed]";
}

export async function POST(req: NextRequest) {
  // Parse body
  let body: { prompt?: string; persona?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const systemPrompt = PERSONA_SYSTEMS[body.persona ?? "default"] ?? PERSONA_SYSTEMS.default;
  const prompt = trimPrompt(body.prompt);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;

  // ── OpenRouter ──────────────────────────────────────────────────────────────
  if (openRouterKey) {
    for (const model of [
      "meta-llama/llama-3.1-8b-instruct:free",
      "google/gemma-2-9b-it:free",
      "mistralai/mistral-7b-instruct:free",
    ]) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://virality-engin.vercel.app",
            "X-Title": "FundedNext Intelligence",
          },
          body: JSON.stringify({
            model,
            max_tokens: 400,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user",   content: prompt },
            ],
          }),
        });

        const d = await r.json();
        const text = d.choices?.[0]?.message?.content ?? "";
        if (text.length > 10) {
          return NextResponse.json({ text, source: `openrouter:${model}` });
        }
        // If error, log and continue to next model
        if (!r.ok) {
          console.error(`OpenRouter ${model} failed:`, d.error?.message ?? r.status);
        }
      } catch (e) {
        console.error(`OpenRouter ${model} exception:`, e);
      }
    }
  }

  // ── Anthropic direct ────────────────────────────────────────────────────────
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
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await r.json();
      const text = d.content?.find((b: {type:string}) => b.type === "text")?.text ?? "";
      if (text.length > 10) {
        return NextResponse.json({ text, source: "anthropic" });
      }
      console.error("Anthropic failed:", d.error?.message ?? r.status);
    } catch (e) {
      console.error("Anthropic exception:", e);
    }
  }

  // ── Both failed — return diagnostic ────────────────────────────────────────
  return NextResponse.json({
    error: "All AI providers failed",
    openrouter_key_set: !!openRouterKey,
    anthropic_key_set: !!anthropicKey,
    tip: "Check Vercel logs for detailed error. Visit /api/test-ai to diagnose.",
  }, { status: 503 });
}
