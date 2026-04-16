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

// ── Google Gemini (free tier — 15 requests/min, no credit card) ──────────────
async function callGemini(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: trimPrompt(prompt) }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
    }),
  });

  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message ?? `Gemini HTTP ${r.status}`);
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

// ── Anthropic direct ──────────────────────────────────────────────────────────
async function callAnthropic(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: trimPrompt(prompt) }],
    }),
  });

  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message ?? `Anthropic HTTP ${r.status}`);
  const text = d.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  if (!text) throw new Error("Anthropic returned empty response");
  return text;
}

// ── Groq (free tier — fast Llama inference) ───────────────────────────────────
async function callGroq(prompt: string, systemPrompt: string, apiKey: string): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: trimPrompt(prompt) },
      ],
    }),
  });

  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message ?? `Groq HTTP ${r.status}`);
  const text = d.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; persona?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const systemPrompt = PERSONA_SYSTEMS[body.persona ?? "default"] ?? PERSONA_SYSTEMS.default;
  const geminiKey    = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.Claude_AI_Summary_API_KEY;
  const groqKey      = process.env.GROQ_API_KEY;

  const errors: string[] = [];

  // ── 1. Gemini (primary — free, reliable) ──
  if (geminiKey) {
    try {
      const text = await callGemini(body.prompt, systemPrompt, geminiKey);
      return NextResponse.json({ text, source: "gemini" });
    } catch (e) {
      errors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Gemini: GEMINI_API_KEY not set");
  }

  // ── 2. Anthropic (fallback) ──
  if (anthropicKey) {
    try {
      const text = await callAnthropic(body.prompt, systemPrompt, anthropicKey);
      return NextResponse.json({ text, source: "anthropic" });
    } catch (e) {
      errors.push(`Anthropic: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Anthropic: no key set");
  }

  // ── 3. Groq (second fallback — free) ──
  if (groqKey) {
    try {
      const text = await callGroq(body.prompt, systemPrompt, groqKey);
      return NextResponse.json({ text, source: "groq" });
    } catch (e) {
      errors.push(`Groq: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errors.push("Groq: GROQ_API_KEY not set");
  }

  return NextResponse.json({
    error: "All AI providers failed",
    details: errors,
    tip: "Add GEMINI_API_KEY to Vercel env vars. Get a free key at aistudio.google.com",
  }, { status: 503 });
}
