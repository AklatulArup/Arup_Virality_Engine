import { NextRequest, NextResponse } from "next/server";

const PERSONA_SYSTEMS: Record<string, string> = {
  algorithm:    "You are an Algorithm Analyst. State what the platform algorithm is doing to this video RIGHT NOW based on the exact signals in the data. Use the numbers. Name the mechanism. Say what breaks it or accelerates it. 2 paragraphs. No hedging. No bullet points.",
  strategist:   "You are a Content Strategist. State whether the hook, title, and format are working or failing — and why the numbers prove it. Say what one change would move the needle most. 2 paragraphs. Disagree with algorithm-only thinking where the data justifies it. No bullet points.",
  psychologist: "You are an Audience Psychologist. State what emotional need this content is meeting and how the comment and engagement pattern confirms it. Say what the audience will do next as a result. 2 paragraphs. No bullet points.",
  competitor:   "You are a Competitive Intelligence Analyst. State where this video is winning and losing against comparable creators in this niche — use the pool data. Say what the channel is leaving on the table. 2 paragraphs. Be blunt. No bullet points.",
  verdict: `You are a Chief Intelligence Officer delivering a 3-part operational brief. Write EXACTLY 3 paragraphs. No headers. No bullets. No markdown. Plain prose only.

Paragraph 1 — WHAT IS HAPPENING: State what the algorithm is doing to this video right now and why, based on the specific signals. Name the mechanism precisely.

Paragraph 2 — WHAT WILL HAPPEN NEXT: State the most likely outcome in the forecast window and the condition that will accelerate or kill it. One sentence on risk, one on opportunity.

Paragraph 3 — WHAT TO DO: Give one clear directive to act on within 48 hours. Then state the one specific mistake to avoid right now.

No waffle. No hedging. No expert attribution. This is a decision brief.`,
  default: "You are a sharp, data-driven content intelligence analyst. Write concise plain-English verdicts using all the context provided. Be specific with numbers. Write in flowing paragraphs. Max 3 paragraphs.",
};

async function callOpenRouter(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://virality-engin.vercel.app",
      "X-Title": "FundedNext Platform Intelligence",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-5",
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response from OpenRouter");
  return text;
}

async function callAnthropic(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `Anthropic ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  if (!text) throw new Error("Empty response from Anthropic");
  return text;
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; persona?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const prompt       = body.prompt;
  const persona      = body.persona ?? "default";
  const systemPrompt = PERSONA_SYSTEMS[persona] ?? PERSONA_SYSTEMS.default;

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;

  const errors: string[] = [];

  // ── Try 1: OpenRouter (primary — access to Claude Sonnet via OpenRouter) ──
  if (openRouterKey) {
    try {
      const text = await callOpenRouter(prompt, systemPrompt, openRouterKey);
      return NextResponse.json({ text, source: "openrouter" });
    } catch (e) {
      errors.push(`OpenRouter: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("OpenRouter: OPENROUTER_API_KEY not set");
  }

  // ── Try 2: Direct Anthropic API ──
  if (anthropicKey) {
    try {
      const text = await callAnthropic(prompt, systemPrompt, anthropicKey);
      return NextResponse.json({ text, source: "anthropic" });
    } catch (e) {
      errors.push(`Anthropic: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Anthropic: no API key set");
  }

  // ── All failed ──
  return NextResponse.json(
    { error: "All AI providers failed", details: errors },
    { status: 503 }
  );
}
