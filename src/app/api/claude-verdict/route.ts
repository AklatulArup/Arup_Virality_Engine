import { NextRequest, NextResponse } from "next/server";

const PERSONA_SYSTEMS: Record<string, string> = {
  algorithm:    "You are an Algorithm Analyst. Write EXACTLY 3 sentences. State what the algorithm is doing right now, the key limiting or driving signal, and what would change the outcome. Use numbers. No fluff.",
  strategist:   "You are a Content Strategist. Write EXACTLY 3 sentences. State whether the hook and title are working citing the engagement number, the structural reason it is succeeding or failing, and the single highest-leverage change.",
  psychologist: "You are an Audience Psychologist. Write EXACTLY 3 sentences. State the emotional need being met citing comment density, what this audience does after watching, and the retention risk.",
  competitor:   "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. State where this video outperforms the pool, where it loses ground, and what is being left on the table.",
  verdict:      "You are a Chief Intelligence Officer. Write exactly 3 short paragraphs separated by a blank line. No headers. No bullets. No markdown. Paragraph 1: what the algorithm is doing right now and why. Paragraph 2: what will happen in the forecast window and the kill condition. Paragraph 3: one action to take within 48 hours and one mistake to avoid.",
  default:      "You are a content intelligence analyst. Write 2 concise paragraphs. Be specific with numbers. No bullet points.",
};

function trim(p: string, max = 2500) {
  return p.length <= max ? p : p.slice(0, max) + "\n\n[context trimmed]";
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; persona?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const system  = PERSONA_SYSTEMS[body.persona ?? "default"] ?? PERSONA_SYSTEMS.default;
  const prompt  = trim(body.prompt);
  const errors: string[] = [];

  // ── 1. Gemini (primary) ────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
  if (geminiKey) {
    for (const model of ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
            }),
          }
        );
        const d = await r.json();
        // Skip on quota or model-not-found errors, break on others
        if (!r.ok) {
          const msg = d.error?.message ?? `HTTP ${r.status}`;
          errors.push(`Gemini/${model}: ${msg.slice(0, 100)}`);
          if (r.status === 429 || msg.includes("quota") || msg.includes("not found")) continue;
          break;
        }
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text.length > 10) return NextResponse.json({ text, source: model });
      } catch (e) { errors.push(`Gemini/${model}: ${e}`); }
    }
  } else {
    errors.push("Gemini: GEMINI_API_KEY not set");
  }

  // ── 2. Anthropic (fallback) ────────────────────────────────────────────────
  const anthropicKey =
    process.env.Claude_AI_Summary_API_KEY ||
    process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    for (const model of ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"]) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 400,
            system,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const d = await r.json();
        if (!r.ok) { errors.push(`Anthropic/${model}: ${d.error?.message}`); continue; }
        const text = d.content?.find((b: {type:string}) => b.type === "text")?.text ?? "";
        if (text.length > 10) return NextResponse.json({ text, source: model });
      } catch (e) { errors.push(`Anthropic/${model}: ${e}`); }
    }
  } else {
    errors.push("Anthropic: no key set (add Claude_AI_Summary_API_KEY to Vercel)");
  }

  return NextResponse.json({
    error: "All AI providers failed",
    details: errors,
    fix: "Gemini quota may be exhausted (resets daily). Add Claude_AI_Summary_API_KEY to Vercel as backup.",
  }, { status: 503 });
}
