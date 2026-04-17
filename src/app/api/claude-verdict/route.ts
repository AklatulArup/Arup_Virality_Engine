import { NextRequest, NextResponse } from "next/server";

// ── Platform-specific + psychology-aware system prompts ──────────────────
// Each persona knows the platform formula AND the psychological mechanisms
// that drive human behaviour on that platform.

const BASE_SYSTEMS: Record<string, string> = {
  algorithm:
    "You are an Algorithm Analyst. Write EXACTLY 3 sentences. " +
    "Sentence 1: what the platform algorithm is doing right now with this specific content and why, citing the exact primary signal. " +
    "Sentence 2: the key limiting or driving metric for THIS platform and the number that matters. " +
    "Sentence 3: what single change would move the outcome. Use exact numbers only. No fluff.",

  strategist:
    "You are a Content Strategist. Write EXACTLY 3 sentences. " +
    "Sentence 1: whether the hook and title are working for this platform, citing the engagement number. " +
    "Sentence 2: the structural reason it is succeeding or failing on THIS platform (not a generic answer). " +
    "Sentence 3: the single highest-leverage change.",

  psychologist:
    "You are an Audience Psychologist who understands that algorithm signals are effects, not causes. " +
    "Write EXACTLY 3 sentences. " +
    "Sentence 1: the dominant emotion this content activates and the specific psychological mechanism driving completion or sharing on this platform. " +
    "Sentence 2: what this audience does AFTER watching (follow, save, DM, comment, nothing) and why — cite the emotion-to-action chain. " +
    "Sentence 3: the single emotional gap or retention risk that is limiting the outcome.",

  competitor:
    "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. " +
    "Sentence 1: where this video outperforms the reference pool with a specific number. " +
    "Sentence 2: where it loses ground and why. " +
    "Sentence 3: the specific content format or emotional archetype that is being left on the table.",

  trend:
    "You are a Trend Intelligence Analyst. Write EXACTLY 3 sentences. " +
    "Sentence 1: whether this content is tapping into an active trend, emerging niche signal, or news event, and what that means for distribution. " +
    "Sentence 2: the timing verdict — is the creator early, on time, or late to this topic cycle — and what the window looks like. " +
    "Sentence 3: the specific niche-to-mainstream pathway this content could cross into and the bridge hook that would unlock it.",

  verdict:
    "You are a Chief Intelligence Officer. Write exactly 3 short paragraphs separated by a blank line. " +
    "No headers. No bullets. No markdown. " +
    "Paragraph 1: what the platform algorithm is doing right now, why, and what psychological mechanism is driving or limiting it. Cite the primary signal and number. " +
    "Paragraph 2: what will happen in the forecast window, the kill condition for THIS platform, and whether the content is trend-timed well. " +
    "Paragraph 3: one action to take within 48 hours and one mistake to avoid — both platform-specific and psychology-informed.",

  default:
    "You are a content intelligence analyst. Write 2 concise paragraphs. " +
    "Be specific with numbers. Reference the platform signals AND the human psychology behind them. No bullet points.",
};

// ── Platform context: algorithm formula + psychological model ────────────

const PLATFORM_CONTEXT: Record<string, string> = {
  youtube:
    "PLATFORM: YouTube Long-Form. Formula: AVD(50%) + CTR(30%) + Satisfaction(20%). " +
    "Kill threshold: CTR <2% = Browse/Suggested sunset. AVD <30% over 90 days = decay. " +
    "PSYCHOLOGY: Trust is the dominant mechanism. Viewers feel personally betrayed by clickbait (title over-promises, content under-delivers). " +
    "Curiosity + Inspiration sustain AVD. The Zeigarnik effect (open loops stacked every 2-3 min) prevents exit. " +
    "Satisfaction signal = did the viewer feel their time was well spent? Hype button (2026) directly measures this. " +
    "Niche: prop trading → funded trading search → forex education → trading tutorials. " +
    "CTA hierarchy: keep watching (AVD) > Hype button > FundedNext free trial > subscribe for series.",

  youtube_short:
    "PLATFORM: YouTube Shorts. Formula: V_vs(50%) + Loop(30%) + ExtShares(20%). " +
    "Kill threshold: >30% swipe-away Frame 1 = PERMANENT burial. No 48hr cap in 2026. " +
    "PSYCHOLOGY: Frame 1 triggers preattentive processing (0-50ms) — visual pattern interruption before conscious thought. " +
    "Loop rate is driven by hidden information psychology — something wasn't fully processed on first watch. " +
    "External shares (WhatsApp/Discord) are driven by awe or outrage — 'I need to show someone this.' " +
    "The Zeigarnik effect doesn't apply to Shorts — completion is mechanical (keep it short, don't give them time to think). " +
    "Niche: prop trading shorts → finance shorts → money shorts → entrepreneur shorts. " +
    "CTA hierarchy: external share to trading group > loop design > Long-Form bridge > FundedNext free trial.",

  tiktok:
    "PLATFORM: TikTok FYP. Formula: Completion(45%) + Rewatch(35%) + DM_send(20%). " +
    "Leaked points: DM=25, Save=15, Finish=8, Comment=8, Like=3. Kill: <70% completion = 200-view jail. " +
    "PSYCHOLOGY: Completion is driven by the Zeigarnik effect — never resolve the tension before the final 5 seconds. " +
    "Rewatch is driven by hidden information — design a detail that only makes sense on second viewing. " +
    "DM sends are driven by tribal identity ('this is us') or anxiety ('this could affect you') — not generic shareable content. " +
    "Like = dopamine but NO distribution power. Tell creators: stop optimising for likes. " +
    "The 3-beat arc for TikTok: Hook (0-2s pattern interrupt) → Deliver (3s-end-5s rapid revelation) → Residue (final 3s emotional state). " +
    "Niche: prop trading → day trading → finance → entrepreneur → making money online. " +
    "CTA: 'Send this to your trading group' > save > substantive comment > FundedNext free trial.",

  instagram:
    "PLATFORM: Instagram Reels. Formula: DM_sends(40%) + Saves(30%) + 3s_hold+Watch(30%). " +
    "Mosseri confirmed DM sends = #1 signal. Saves = 3x like. Kill: <40% 3-sec hold = 5-10x less reach. " +
    "PSYCHOLOGY: DM sends are driven by the belonging signal — 'this is for a specific person in my life.' " +
    "Saves are driven by anxiety reduction — 'I can't memorise this, I'll lose access to it.' Reference utility = saves. " +
    "3-sec hold is purely visual pattern interruption — the caption overlay appears at 1.5s so the hook MUST be visual. " +
    "The dual-signal holy grail: one CTA that creates both belonging (DM) and anxiety reduction (Save) simultaneously. " +
    "Niche: prop trading → personal finance → financial freedom → lifestyle aspirational. " +
    "CTA: DM + save dual signal > DM send to named recipient > save for reference > FundedNext free trial.",
};

function getPlatformContext(platform?: string): string {
  if (platform === "tiktok")        return PLATFORM_CONTEXT.tiktok;
  if (platform === "instagram")     return PLATFORM_CONTEXT.instagram;
  if (platform === "youtube_short") return PLATFORM_CONTEXT.youtube_short;
  return PLATFORM_CONTEXT.youtube;
}

// ── Playbook knowledge injection ─────────────────────────────────────────
// Key principles from the FundedNext playbook injected into every analysis

const PLAYBOOK_CONTEXT = `
PLAYBOOK PRINCIPLES (apply when relevant):
- Hook frameworks: Visual Proof, Counterintuitive, Number, Mistake/Failure, Event-Reactive, Loop/Rewatch, Search/SEO, Identity Mirror, Series/Day-N, Comparison
- Emotional arcs: Short-form = 3 beats (Disruption → Deliver → Residue). Long-form = 6 beats (Disruption → Stakes → Journey → Peak → Resolution → Call)
- The algorithm measures EFFECTS. Psychology creates the CAUSES. Fix the emotion first; the metrics follow.
- Highest-completion archetype across all platforms: Mistake/Failure reveal (vulnerability + 'this could happen to me')
- Highest-share archetype: Proof/Payout reveal (awe + inspiration) AND Market Event reaction (recency × spread)
- Arousal-action chain (Berger & Milkman): emotional stimulus → physiological arousal → urge to act → platform mechanic determines the action form
- FundedNext CTA hierarchy: Free trial (lowest friction) > Buy challenge (post proof only) > Community > Named recipient DM > Save for reference
`;

function buildSystemPrompt(persona: string, platform?: string): string {
  const base    = BASE_SYSTEMS[persona] ?? BASE_SYSTEMS.default;
  const platCtx = getPlatformContext(platform);
  return `${base}\n\nPLATFORM CONTEXT:\n${platCtx}\n${PLAYBOOK_CONTEXT}`;
}

function trim(p: string, max = 2800) {
  return p.length <= max ? p : p.slice(0, max) + "\n\n[context trimmed]";
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string; persona?: string; platform?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const system = buildSystemPrompt(body.persona ?? "default", body.platform);
  const prompt = trim(body.prompt);
  const errors: string[] = [];

  // 1. Gemini (primary)
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
              generationConfig: { maxOutputTokens: 500, temperature: 0.65 },
            }),
          }
        );
        const d = await r.json();
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

  // 2. Anthropic (fallback)
  const anthropicKey = process.env.Claude_AI_Summary_API_KEY || process.env.ANTHROPIC_API_KEY;
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
            max_tokens: 500,
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
    errors.push("Anthropic: no key set");
  }

  return NextResponse.json({
    error: "All AI providers failed",
    details: errors,
    fix: "Gemini quota may be exhausted (resets daily). Ensure Claude_AI_Summary_API_KEY is set in Vercel.",
  }, { status: 503 });
}
