import { NextRequest, NextResponse } from "next/server";
import { computePsychScore, RESIDUE_SIGNAL_MAP } from "@/lib/psychology-score";
import { analyzeCommentIntelligence, estimateCommentQuality } from "@/lib/comment-intelligence";
import { detectTrends } from "@/lib/trend-intelligence";

// ─── Platform-specific analysis system prompts ────────────────────────────
// Each persona is platform-aware AND psychology-aware.
// The enriched prompt builder (below) injects full context.

const BASE_SYSTEMS: Record<string, string> = {
  algorithm:
    "You are an Algorithm Analyst for a content intelligence platform. Write EXACTLY 3 sentences. " +
    "Sentence 1: what the platform algorithm is doing right now with this specific content and which signal is driving or limiting it — use exact numbers. " +
    "Sentence 2: the psychological mechanism behind that signal (why humans are behaving that way). " +
    "Sentence 3: the single change that would most improve the outcome. No fluff.",

  strategist:
    "You are a Content Strategist. Write EXACTLY 3 sentences. " +
    "State whether the hook is working on this platform (cite the engagement number and the psychological trigger it activates), " +
    "the structural reason it is succeeding or failing, " +
    "and the single highest-leverage change including which emotional residue to engineer.",

  psychologist:
    "You are an Audience Psychologist. Write EXACTLY 3 sentences. " +
    "State the dominant emotional trigger active in this content and what it makes viewers do after watching (save, DM, share, or scroll away). " +
    "State what the comment pattern reveals about whether the psychological trigger landed. " +
    "State the one psychological design change that would increase the sharing behavior most on this specific platform.",

  competitor:
    "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. " +
    "State where this video outperforms the reference pool (cite the metric). " +
    "State where it loses ground and the psychological reason why. " +
    "State what content format or emotional angle the competition is exploiting that this creator is leaving on the table.",

  verdict:
    "You are a Chief Intelligence Officer. Write exactly 3 short paragraphs separated by a blank line. No headers. No bullets. No markdown. " +
    "Paragraph 1: what the platform algorithm is doing right now and the psychological reason (the human behavior causing the metric). " +
    "Paragraph 2: what will happen in the forecast window, the kill condition for this platform, and the trend window (open or closed). " +
    "Paragraph 3: one action to take within 48 hours (specific, not generic) and one psychological mistake to avoid.",

  default:
    "You are a content intelligence analyst. Write 2 concise paragraphs. Be specific with numbers. " +
    "Reference both the platform algorithm signals AND the psychological mechanisms driving them. No bullet points.",
};

// ─── Platform distribution context ────────────────────────────────────────

const PLATFORM_ALGO_CONTEXT: Record<string, string> = {
  youtube:
    "PLATFORM: YouTube Long-Form | Formula: AVD(50%) + CTR(30%) + Satisfaction/Hype(20%) | " +
    "Kill: CTR <2% sustained = Browse/Suggested sunset (search survives) | " +
    "Psychology: Tension-release cycle drives AVD. Curiosity gaps stack open loops. Loss aversion prevents early exit. " +
    "Satisfaction = Hype button (channels <500K subs) + post-watch surveys. Evergreen model — search views run indefinitely. | " +
    "Niche: prop trading → funded trading search → forex education → trading tutorials",

  youtube_short:
    "PLATFORM: YouTube Shorts | Formula: V_vs(50%) + Loop_rate(30%) + External_shares(20%) | " +
    "Kill: >30% swipe-away on Frame 1 = PERMANENT burial | No 48hr virality cap in 2026 | " +
    "Psychology: Pattern interrupt arrests scroll in 50-300ms (preattentive processing). " +
    "Open loop design creates natural rewatch. Tribal belonging drives external shares to WhatsApp/Discord. | " +
    "Niche: prop trading shorts → finance shorts → money shorts → entrepreneur shorts",

  tiktok:
    "PLATFORM: TikTok FYP | Formula: Completion(45%) + Rewatch(35%) + DM_send(20%) | " +
    "Leaked pts: DM=25, Save=15, Finish=8, Comment=8, Like=3 | " +
    "Kill: <70% completion in first 60 min = permanent 200-view jail | " +
    "Psychology: Curiosity gaps and open loops drive completion. Identity/tribal signals drive DM sends (viewer sends to person who shares their identity). " +
    "Zeigarnik effect keeps viewers watching to resolve open loops. | " +
    "Niche: prop trading → day trading → finance → entrepreneur → making money online",

  instagram:
    "PLATFORM: Instagram Reels | Formula: DM_sends(40%) + Saves(30%) + 3s_hold+Watch(30%) | " +
    "Kill: 3-sec hold <40% = 5-10x less reach | Watermark = excluded permanently | " +
    "Psychology: DM sends driven by tribal belonging + identity signal (viewer sends to specific person they identify with). " +
    "Saves driven by utility hoarding + anxiety (fear of not having the information when needed). " +
    "3-sec hold requires preattentive visual pattern interrupt before caption overlay at 1.5s. | " +
    "Niche: prop trading → personal finance → financial freedom → lifestyle",
};

function getPlatformContext(platform?: string): string {
  return PLATFORM_ALGO_CONTEXT[platform ?? "youtube"] ?? PLATFORM_ALGO_CONTEXT.youtube;
}

// ─── Prompt enrichment with psych + comment + trend context ───────────────

function buildEnrichedSystem(persona: string, platform?: string): string {
  const base = BASE_SYSTEMS[persona] ?? BASE_SYSTEMS.default;
  const platformCtx = getPlatformContext(platform);
  return `${base}\n\nPLATFORM + PSYCHOLOGY CONTEXT:\n${platformCtx}`;
}

function trim(p: string, max = 3000) {
  return p.length <= max ? p : p.slice(0, max) + "\n\n[context trimmed for length]";
}

// ─── Request handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    persona?: string;
    platform?: string;
    // Optional enrichment inputs — if provided, we compute psych/comment/trend scores
    title?: string;
    tags?: string[];
    description?: string;
    comments?: string[];
    commentCount?: number;
    views?: number;
    likes?: number;
    publishedDaysAgo?: number;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  // ── Compute enrichment scores if inputs provided ──────────────────────
  let enrichmentContext = "";

  if (body.title) {
    const platform = body.platform ?? "youtube";
    const tags = body.tags ?? [];
    const description = body.description ?? "";

    // Psychological score
    const psychScore = computePsychScore(body.title, tags, description, platform);
    const residueSignal = RESIDUE_SIGNAL_MAP[psychScore.emotionalResidueType];

    enrichmentContext += `\n\nPSYCHOLOGICAL ANALYSIS:\n`;
    enrichmentContext += `Overall psych score: ${psychScore.overall}/100 | `;
    enrichmentContext += `Emotional residue: ${psychScore.emotionalResidueType} (strength: ${Math.round(psychScore.residueStrength * 100)}%) → ${residueSignal}\n`;
    enrichmentContext += `Shareability: ${psychScore.shareabilityScore}/100 | Saveability: ${psychScore.saveabilityScore}/100 | `;
    enrichmentContext += `Completion pull: ${psychScore.completionPullScore}/100 | Rewatch: ${psychScore.watchAgainScore}/100\n`;
    enrichmentContext += `Top triggers: ${psychScore.triggers.slice(0, 3).map(t => `${t.label}(${Math.round(t.score * 100)}%)`).join(", ")}\n`;
    enrichmentContext += `Design gap: ${psychScore.topRecommendation}\n`;

    // Comment analysis
    if (body.comments && body.comments.length > 0) {
      const commentIntel = analyzeCommentIntelligence(body.comments);
      enrichmentContext += `\nCOMMENT INTELLIGENCE (${commentIntel.totalAnalyzed} comments):\n`;
      enrichmentContext += `Dominant archetype: ${commentIntel.dominantLabel} | `;
      enrichmentContext += `Trust score: ${commentIntel.trustSignalStrength}/100 | Community: ${commentIntel.communitySignalStrength}/100\n`;
      enrichmentContext += `Conversion signals: ${commentIntel.conversionSignalStrength}/100 | Reply chain potential: ${commentIntel.replyChainPotential}/100\n`;
      enrichmentContext += `Diagnosis: ${commentIntel.viralityDiagnosis}\n`;
      if (commentIntel.contentOpportunities.length > 0) {
        enrichmentContext += `Opportunity: ${commentIntel.contentOpportunities[0]}\n`;
      }
    } else if (body.commentCount !== undefined && body.views !== undefined) {
      const quality = estimateCommentQuality(body.commentCount, body.views, body.likes ?? 0, platform);
      enrichmentContext += `\nCOMMENT QUALITY (estimated): ${quality.qualityScore}/100 | ${quality.interpretation}\n`;
    }

    // Trend detection
    const trendIntel = detectTrends(body.title, tags, description, platform, body.publishedDaysAgo);
    if (trendIntel.activeTrends.length > 0) {
      const topTrend = trendIntel.activeTrends[0];
      enrichmentContext += `\nTREND INTELLIGENCE:\n`;
      enrichmentContext += `Active trend: "${topTrend.topic}" | Phase: ${topTrend.phase} | Reach multiplier: ${topTrend.estimatedReachMultiplier}x\n`;
      enrichmentContext += `Window: ${topTrend.windowOpen ? "OPEN — " + topTrend.urgency : "CLOSED"} | Likelihood: ${topTrend.likelihoodLabel}\n`;
      enrichmentContext += `Recommended angle: ${topTrend.contentAngles[0]}\n`;
    }
    if (trendIntel.newsIntegrationOpportunity) {
      enrichmentContext += `NEWS INTEGRATION: Content relates to a live news event — timing bonus active. Post within 2 hours of news break for maximum recency boost.\n`;
    }
  }

  const system = buildEnrichedSystem(body.persona ?? "default", body.platform);
  const fullPrompt = trim(body.prompt + enrichmentContext);
  const errors: string[] = [];

  // ── 1. Gemini (primary) ────────────────────────────────────────────────
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
              contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
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
  }

  // ── 2. Anthropic (fallback) ────────────────────────────────────────────
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
            messages: [{ role: "user", content: fullPrompt }],
          }),
        });
        const d = await r.json();
        if (!r.ok) { errors.push(`Anthropic/${model}: ${d.error?.message}`); continue; }
        const text = d.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
        if (text.length > 10) return NextResponse.json({ text, source: model });
      } catch (e) { errors.push(`Anthropic/${model}: ${e}`); }
    }
  }

  return NextResponse.json({
    error: "All AI providers failed",
    details: errors,
    fix: "Gemini quota may be exhausted (resets daily). Ensure Claude_AI_Summary_API_KEY is set in Vercel.",
  }, { status: 503 });
}
