import { NextRequest, NextResponse } from "next/server";

const PERSONA_SYSTEMS: Record<string, string> = {
  algorithm:    "You are an Algorithm Analyst. Write EXACTLY 3 sentences. State what the algorithm is doing right now, the key limiting or driving signal, and what would change the outcome. Use numbers. No fluff.",
  strategist:   "You are a Content Strategist. Write EXACTLY 3 sentences. State whether the hook and title are working citing the engagement number, the structural reason it is succeeding or failing, and the single highest-leverage change.",
  psychologist: "You are an Audience Psychologist. Write EXACTLY 3 sentences. State the emotional need being met citing comment density, what this audience does after watching, and the retention risk.",
  competitor:   "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. State where this video outperforms the pool, where it loses ground, and what is being left on the table.",
  verdict:      "You are a Chief Intelligence Officer. Write exactly 3 short paragraphs separated by a blank line. No headers. No bullets. No markdown. Paragraph 1: what the algorithm is doing right now and why. Paragraph 2: what will happen in the forecast window and the kill condition. Paragraph 3: one action to take within 48 hours and one mistake to avoid.",
  default:      "You are a content intelligence analyst. Write 2 concise paragraphs. Be specific with numbers. No bullet points.",
};

function trimPrompt(p: string, max = 2500) {
  return p.length <= max ? p : p.slice(0, max) + "\n\n[context trimmed]";
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; persona?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set in Vercel environment variables" }, { status: 503 });

  const systemPrompt = PERSONA_SYSTEMS[body.persona ?? "default"] ?? PERSONA_SYSTEMS.default;

  // Try Gemini 2.0 Flash, fall back to 1.5 Flash
  for (const model of ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"]) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: trimPrompt(body.prompt) }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        }
      );
      const d = await r.json();
      if (!r.ok) { console.error(`${model} failed:`, d.error?.message); continue; }
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text.length > 10) return NextResponse.json({ text, source: model });
    } catch (e) { console.error(`${model} exception:`, e); }
  }

  return NextResponse.json({ error: "Gemini unavailable. Check GEMINI_API_KEY in Vercel." }, { status: 503 });
}
