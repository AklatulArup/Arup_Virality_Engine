"use client";

import React, { useState, useEffect, useRef } from "react";
import type { EnrichedVideo, ChannelData, ReferenceStore, KeywordBank } from "@/lib/types";
import { buildContextualPrompt, updateSessionMemory } from "@/lib/context-memory";
import { formatNumber } from "@/lib/formatters";

interface ExpertWarRoomProps {
  video: EnrichedVideo;
  channel: ChannelData | null;
  channelMedian: number;
  recentVideos: EnrichedVideo[];
  referenceStore?: ReferenceStore | null;
  keywordBank?: KeywordBank | null;
}

interface ExpertOpinion {
  persona: string;
  text: string;
  words: string[];
  loading: boolean;
  done: boolean;
  error?: string;
}

// ── 9 Experts — sequential deliberation order ─────────────────────────────────
// Order matters: each expert reads previous outputs. Trend sets context → Algorithm
// + Psychologist debate → Strategist + Reverse Engineer resolve → Creator Coach
// (creator-specific) → Risk Auditor (brand safety) → Script Architect (output)
// → Verdict (synthesises all 8)

const EXPERTS = [
  { id: "trend",       name: "Trend Analyst",          role: "News · Timing · Niche Pathway",      icon: "📈", color: "#E879F9", glow: "rgba(232,121,249,0.30)", stance: "Timing is the hidden multiplier" },
  { id: "algorithm",   name: "Algorithm Analyst",       role: "Distribution · Signals · Formula",   icon: "⚡", color: "#60A5FA", glow: "rgba(96,165,250,0.35)",  stance: "Platform signals drive everything" },
  { id: "psychologist",name: "Audience Psychologist",   role: "Emotion · Behaviour · Completion",   icon: "◎",  color: "#A78BFA", glow: "rgba(167,139,250,0.30)", stance: "Emotion creates the signal, not vice versa" },
  { id: "strategist",  name: "Content Strategist",      role: "Hook · Format · Title · CTA",        icon: "◆",  color: "#2ECC8A", glow: "rgba(46,204,138,0.32)",  stance: "Structure determines the ceiling" },
  { id: "reverse",     name: "Reverse Engineer",        role: "Viral Blueprint · Replication",      icon: "🔬", color: "#F97316", glow: "rgba(249,115,22,0.30)",  stance: "Every result has a repeatable formula" },
  { id: "creator",     name: "Creator Coach",           role: "Last 10 Videos · What Changed",      icon: "📊", color: "#34D399", glow: "rgba(52,211,153,0.30)",  stance: "Creator trajectory beats single-video analysis" },
  { id: "competitor",  name: "Competitive Intel",       role: "Niche · Benchmark · Positioning",    icon: "🎯", color: "#F59E0B", glow: "rgba(245,158,11,0.30)",  stance: "Relative performance is what matters" },
  { id: "risk",        name: "Risk Auditor",            role: "Sentiment · Brand Safety · Trust",   icon: "🛡️", color: "#FF7B7B", glow: "rgba(255,123,123,0.30)", stance: "Trust is the product — protect it first" },
  { id: "architect",   name: "Script Architect",        role: "Hook · Script · CTA · Deliverable",  icon: "✍️", color: "#FBBF24", glow: "rgba(251,191,36,0.30)",  stance: "Analysis without output is theatre" },
];

const TIMEFRAME_OPTIONS = [
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

// ── Persona system prompts — each knows its position in the deliberation chain ──

function getPersonaSystem(id: string, platform: string): string {
  const plat = platform === "tiktok" ? "TikTok FYP (Completion 45% + Rewatch 35% + DM 20%)"
    : platform === "instagram"       ? "Instagram Reels (DM sends 40% + Saves 30% + Hold 30%)"
    : platform === "youtube_short"   ? "YouTube Shorts (V_vs 50% + Loop 30% + ExtShares 20%)"
    :                                  "YouTube Long-Form (AVD 50% + CTR 30% + Satisfaction 20%)";

  const prompts: Record<string, string> = {
    trend:
      `You are a Trend Analyst. Platform: ${plat}. ` +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: is this content tapping an active news/market event, an emerging trend signal, or is it evergreen — cite the specific topic and its timing phase. " +
      "Sentence 2: timing verdict — is the creator early, perfectly timed, or late to this cycle, and what is the distribution window. " +
      "Sentence 3: the specific niche-to-mainstream bridge this content could cross and the exact hook phrase that would unlock it. Numbers and specifics only.",

    algorithm:
      `You are an Algorithm Analyst. Platform: ${plat}. ` +
      "The Trend Analyst has just set the timing context above. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: what the ${plat} algorithm is doing to this video RIGHT NOW and the exact signal number that is driving or limiting it. " +
      "Sentence 2: the specific kill threshold this video is closest to on this platform — and whether it has already crossed it. " +
      "Sentence 3: the single metric change that would shift the algorithm's decision. Use exact numbers. Disagree with the Trend Analyst if the timing context is irrelevant to the signal.",

    psychologist:
      `You are an Audience Psychologist. Platform: ${plat}. ` +
      "You have read the Trend and Algorithm analyses above. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: the dominant emotion this content activates (from: awe, outrage, anxiety, validation, curiosity, inspiration) and the specific psychological mechanism that drives the primary sharing action on THIS platform. " +
      "Sentence 2: what this audience does AFTER watching — follow, save, DM, comment, nothing — and WHY based on the emotional state created. " +
      "Sentence 3: the single emotional gap or completion risk. Directly challenge the Algorithm Analyst if you believe psychology is the binding constraint, not the platform signal.",

    strategist:
      `You are a Content Strategist. Platform: ${plat}. ` +
      "You have read the Trend, Algorithm, and Psychology analyses. Your job is to resolve the most important disagreement between them with a structural recommendation. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: which of the 10 hook frameworks this content uses (Visual Proof / Counterintuitive / Number / Mistake / Event-Reactive / Loop / Search / Identity Mirror / Series / Comparison) and whether it is the optimal framework for this platform. " +
      "Sentence 2: the structural reason the content is succeeding or failing — not just the metric, but the format decision that caused it. " +
      "Sentence 3: the single highest-leverage change. This should resolve the algorithm vs psychology debate if one exists.",

    reverse:
      `You are a Reverse Engineer specialising in viral content replication. Platform: ${plat}. ` +
      "You have read all 4 analyses above. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: the exact structural formula of this content that made it work (or fail) — hook type + emotional mechanism + content arc + CTA placement. Be specific enough that a creator could replicate it. " +
      "Sentence 2: the single variation that would improve the formula for THIS platform's primary signal. " +
      "Sentence 3: the specific angle or topic this creator should use for the NEXT video to compound on this performance.",

    creator:
      `You are a Creator Coach. Platform: ${plat}. ` +
      "You have read all 5 expert analyses above AND the creator's last 10 video performance data below. " +
      "This is the most important analysis because it is creator-specific, not generic. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: based on the last 10 videos, what SPECIFICALLY changed between the creator's previous pattern and this video — format, topic, length, hook type — and whether that change helped or hurt. " +
      "Sentence 2: what the creator's dominant archetype is based on their catalogue, and whether this video fits or breaks from it. " +
      "Sentence 3: one concrete instruction for the NEXT video — not a generic tip, a specific directive based on their personal performance trend.",

    competitor:
      `You are a Competitive Intelligence Analyst. Platform: ${plat}. ` +
      "You have read all analyses above. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: where this video outperforms the reference pool with a specific metric. " +
      "Sentence 2: where it loses ground and the exact format or topic the strongest competitor uses that this creator does not. " +
      "Sentence 3: the one niche gap — content that the audience wants but no one in the pool is producing — that this creator could own.",

    risk:
      `You are a Risk Auditor for FundedNext content. Platform: ${plat}. ` +
      "You have read all analyses above. Your job is brand safety and trust trajectory — not performance. " +
      "Write EXACTLY 3 sentences. " +
      "Sentence 1: the comment sentiment trajectory — is trust building, stable, or eroding — and the specific signal (comment archetype, skepticism rate, conversion signal) that tells you this. " +
      "Sentence 2: any brand safety flag — does this content risk negative association with FundedNext, regulatory language issues, or an overloaded CTA that damages trust. " +
      "Sentence 3: one compliance or trust-building recommendation for the next piece of content.",

    architect:
      `You are a Script Architect. Platform: ${plat}. ` +
      "You have read all 8 expert analyses above. Your job is to turn intelligence into a deliverable script the RM team can hand to a creator RIGHT NOW. " +
      "Write in exactly this format, no other text:\n" +
      "HOOK (first 2 seconds): [exact hook line — specific, not a template]\n" +
      "BEAT 2 (deliver): [1 sentence on what to cover and how]\n" +
      "BEAT 3 (residue): [the exact emotional state to end on and why]\n" +
      "CTA LINE: [exact CTA line — platform-specific, names the recipient or action]\n" +
      "WHY THIS WORKS: [1 sentence explaining the psychological + algorithmic mechanism]\n" +
      "This is operational output. Every word must be usable.",

    verdict:
      `You are a Chief Intelligence Officer. You have received 8 expert analyses. ` +
      "Your job is a decision brief — not a summary. " +
      "Write EXACTLY 4 short paragraphs separated by blank lines. No headers. No bullets. Plain prose. " +
      "Paragraph 1 (HAPPENING NOW): what the algorithm is doing, the primary psychological mechanism driving or limiting it, and whether timing is helping or hurting. One precise statement per factor. " +
      "Paragraph 2 (WHAT WILL HAPPEN): the most likely view trajectory in the forecast window, the specific kill condition, and the one opportunity window. " +
      "Paragraph 3 (CREATOR DIRECTIVE): based on this creator's specific recent trajectory — not generic advice — the one thing they should do differently in the next video. " +
      "Paragraph 4 (SCRIPT HOOK): the exact hook line from the Script Architect's output, and the exact CTA line. These are the two things a creator can use immediately. " +
      "No hedging. No waffle. This is a decision brief.",
  };

  return prompts[id] ?? prompts.verdict;
}

// ── Build per-persona prompt with creator context + previous expert outputs ───

function buildSequentialPrompt(
  video: EnrichedVideo,
  channel: ChannelData | null,
  channelMedian: number,
  recentVideos: EnrichedVideo[],
  referenceStore: ReferenceStore | null | undefined,
  keywordBank: KeywordBank | null | undefined,
  persona: string,
  forecastDays: number,
  previousOutputs: Record<string, string>,
  newsContext: string,
  platform: string,
): string {
  // ── Base video context ──────────────────────────────────────────────────────
  const base = buildContextualPrompt({
    video, channel, channelMedian, platform,
    phase: "ANALYSIS", recentVideos, referenceStore, keywordBank, persona,
  });

  // ── Creator last-10 grounding ────────────────────────────────────────────────
  const poolEntries = referenceStore?.entries ?? [];
  const creatorEntries = poolEntries
    .filter(e => e.channelName === video.channel && e.type === "video")
    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
    .slice(0, 10);

  const last10 = creatorEntries.length > 0
    ? creatorEntries.map((e, i) => {
        const views = e.metrics?.views ?? 0;
        const eng   = e.metrics?.engagement?.toFixed(1) ?? "?";
        const vrs   = e.metrics?.vrsScore ?? 0;
        return `  ${i+1}. "${e.name}" → ${formatNumber(views)} views | ${eng}% eng | VRS ${vrs}`;
      }).join("\n")
    : "  No recent videos in reference pool. Add this creator's videos for creator-specific coaching.";

  // Performance trend analysis
  const viewTrend = creatorEntries.length >= 3
    ? (() => {
        const recent3 = creatorEntries.slice(0, 3).map(e => e.metrics?.views ?? 0);
        const older3  = creatorEntries.slice(3, 6).map(e => e.metrics?.views ?? 0);
        const r = recent3.reduce((a,b) => a+b, 0) / Math.max(1, recent3.length);
        const o = older3.reduce((a,b) => a+b, 0) / Math.max(1, older3.length);
        const delta = o > 0 ? Math.round(((r - o) / o) * 100) : 0;
        return `${delta >= 0 ? "+" : ""}${delta}% vs previous 3 videos`;
      })()
    : "insufficient data";

  const creatorBlock = `
════ CREATOR CONTEXT: LAST 10 VIDEOS (${video.channel}) ════

Last 10 published videos (newest first):
${last10}

Performance trend: ${viewTrend}
Channel median: ${formatNumber(channelMedian)} views
This video vs median: ${video.vsBaseline}x
`;

  // ── News / trend context (injected for all personas) ─────────────────────────
  const trendBlock = newsContext ? `
════ LIVE TREND CONTEXT ════
${newsContext}
` : "";

  // ── Pool benchmarks ───────────────────────────────────────────────────────────
  const platformEntries = poolEntries.filter(e => e.platform === platform || e.platform === "youtube");
  const subBand = channel?.subs ?? 0;
  const lookalikeEntries = platformEntries.filter(e => {
    const s = e.metrics?.subs ?? 0;
    return s > subBand * 0.5 && s < subBand * 2;
  });
  const lookalikeAvgViews = lookalikeEntries.length > 0
    ? Math.round(lookalikeEntries.reduce((s,e) => s + (e.metrics?.views ?? 0), 0) / lookalikeEntries.length)
    : 0;

  // ── Decay-based forecast ───────────────────────────────────────────────────────
  const decayRate = 0.95;
  let fv = video.views, fvel = video.velocity;
  for (let d = 0; d < forecastDays; d++) { fvel *= decayRate; fv += fvel; }
  const fTotal = Math.round(fv);
  const fAdd   = Math.round(fv - video.views);

  const analyticsBlock = `
════ DEEP ANALYTICS — ${forecastDays}-DAY TIMEFRAME ════

LOOKALIKE BENCHMARK (channels ${formatNumber(subBand * 0.5)}–${formatNumber(subBand * 2)} subs):
  ${lookalikeEntries.length} channels tracked | Avg views: ${lookalikeAvgViews > 0 ? formatNumber(lookalikeAvgViews) : "N/A"}
  ${lookalikeAvgViews > 0 ? `This video vs lookalike avg: ${Math.round(((video.views - lookalikeAvgViews) / lookalikeAvgViews) * 100)}%` : ""}

NICHE POOL (${platformEntries.length} videos):
  Pool avg VRS: ${platformEntries.length > 0
    ? Math.round(platformEntries.reduce((s,e) => s + (e.metrics?.vrsScore ?? 0), 0) / platformEntries.length)
    : 0}/100

${forecastDays}-DAY PROJECTION:
  Current: ${formatNumber(video.views)} views (day ${video.days})
  Projected at day ${video.days + forecastDays}: ${formatNumber(fTotal)} (+${formatNumber(fAdd)})
  Confidence: ${video.days < 3 ? "LOW (<3 days old)" : video.days < 7 ? "MEDIUM" : "HIGH (decay curve established)"}
`;

  // ── Previous expert outputs (the deliberation chain) ──────────────────────────
  const prevBlock = Object.keys(previousOutputs).length > 0
    ? `\n════ PREVIOUS EXPERT ANALYSES ════\n${
        Object.entries(previousOutputs)
          .map(([p, t]) => {
            const expert = EXPERTS.find(e => e.id === p);
            return `[${(expert?.name ?? p).toUpperCase()}]:\n${t.slice(0, 400)}${t.length > 400 ? "…" : ""}`;
          })
          .join("\n\n")
      }\n\nNow give YOUR analysis. Disagree with previous experts where your expertise differs. Do not just summarise — add NEW information.\n`
    : "";

  return base + creatorBlock + trendBlock + analyticsBlock + prevBlock;
}

// ── Fetch with platform context ───────────────────────────────────────────────

async function callExpert(prompt: string, persona: string, platform: string): Promise<string> {
  const res = await fetch("/api/claude-verdict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, persona, platform }),
  });
  const data: { text?: string; error?: string } = await res.json().catch(() => ({}));
  if (data.text && data.text.length > 20) return data.text;
  throw new Error(data.error ?? "No response from AI provider");
}

// ── Fetch live news for trend context ────────────────────────────────────────

async function fetchNewsContext(title: string): Promise<string> {
  try {
    const query = encodeURIComponent(title.slice(0, 60));
    const res = await fetch(`/api/news?q=${query}`, { next: { revalidate: 900 } } as RequestInit);
    if (!res.ok) return "";
    const data = await res.json();
    const items: Array<{title:string;source:string;urgency:string;trendMultiplier:number;hoursOld:number}> = data.items ?? [];
    if (items.length === 0) return "";
    const top3 = items.slice(0, 3);
    return top3.map(i =>
      `• [${i.urgency.toUpperCase()}] "${i.title}" — ${i.source} (${i.hoursOld}h ago, ${i.trendMultiplier}× multiplier)`
    ).join("\n");
  } catch {
    return "";
  }
}

// ── Strip markdown ────────────────────────────────────────────────────────────

function stripMd(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function streamWords(text: string, onWord: (w: string[]) => void, onDone: () => void) {
  const words = text.split(" "); let i = 0; const cur: string[] = [];
  return setInterval(() => {
    if (i >= words.length) { onDone(); return; }
    const chunk = Math.min(words.length - i, Math.floor(Math.random() * 3) + 1);
    for (let j = 0; j < chunk; j++) cur.push(words[i++]);
    onWord([...cur]);
  }, 28);
}

function ThinkingDots({ color }: { color: string }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(x => (x + 1) % 4), 350); return () => clearInterval(t); }, []);
  return <span className="font-mono" style={{ color, fontSize: 13, letterSpacing: 2 }}>{"●".repeat(f)}{"○".repeat(3 - f)}</span>;
}

function CircuitNode({ color, size = 4 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color,
      flexShrink: 0,
      animation: "pulseDot 2s ease-in-out infinite",
    }} />
  );
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(video: EnrichedVideo): string {
  if (video.platform === "tiktok")        return "tiktok";
  if (video.platform === "instagram")     return "instagram";
  if (video.platform === "youtube_short") return "youtube_short";
  const secs = video.durationSeconds ?? 0;
  return secs > 0 && secs <= 180 ? "youtube_short" : "youtube";
}

// ── VRS tiers ─────────────────────────────────────────────────────────────────

function getVRSTier(score: number) {
  if (score >= 80) return { label: "TIER 1 — EXCELLENT", color: "#2ECC8A" };
  if (score >= 65) return { label: "TIER 2 — STRONG",    color: "#60A5FA" };
  if (score >= 50) return { label: "TIER 3 — COMPETITIVE",color: "#F59E0B" };
  if (score >= 35) return { label: "TIER 4 — NEEDS WORK", color: "#F97316" };
  return               { label: "TIER 5 — REWORK",       color: "#FF4D6A" };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExpertWarRoomPanel({
  video, channel, channelMedian, recentVideos, referenceStore, keywordBank,
}: ExpertWarRoomProps) {
  const [opinions, setOpinions]     = useState<Record<string, ExpertOpinion>>({});
  const [verdict, setVerdict]       = useState<ExpertOpinion | null>(null);
  const [verdictWords, setVW]       = useState<string[]>([]);
  const [running, setRunning]       = useState(false);
  const [phase, setPhase]           = useState<"idle" | "experts" | "verdict" | "done">("idle");
  const [forecastDays, setForecast] = useState(30);
  const [activeExpert, setActive]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [newsCtx, setNewsCtx]       = useState("");
  const intervals                   = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => () => { intervals.current.forEach(clearInterval); }, []);

  const platform = detectPlatform(video);
  const currentTier = getVRSTier(video.vrs.estimatedFullScore);

  // Simple forecast
  const decayRate = 0.95;
  let fv = video.views, fvel = video.velocity;
  for (let d = 0; d < forecastDays; d++) { fvel *= decayRate; fv += fvel; }
  const fTotal = Math.round(fv);
  const fAdd   = Math.round(fv - video.views);

  async function runWarRoom() {
    intervals.current.forEach(clearInterval);
    intervals.current = [];
    setRunning(true);
    setPhase("experts");
    setOpinions({});
    setVerdict(null);
    setVW([]);
    setExpanded(null);
    setCurrentRound(0);
    updateSessionMemory(video, channel, platform, "WAR_ROOM");

    // Fetch live news context first
    const liveNews = await fetchNewsContext(video.title);
    setNewsCtx(liveNews);

    // Initialise all as queued
    const init: Record<string, ExpertOpinion> = {};
    EXPERTS.forEach(e => { init[e.id] = { persona: e.id, text: "", words: [], loading: false, done: false }; });
    setOpinions({ ...init });

    // ── SEQUENTIAL DELIBERATION ────────────────────────────────────────────────
    // Each expert fires AFTER the previous one completes and reads their output.
    // This is the key difference from the old parallel model.

    const collectedOutputs: Record<string, string> = {};

    for (let i = 0; i < EXPERTS.length; i++) {
      const expert = EXPERTS[i];
      setCurrentRound(i + 1);
      setActive(expert.id);

      // Mark this expert as loading
      setOpinions(prev => ({
        ...prev,
        [expert.id]: { persona: expert.id, text: "", words: [], loading: true, done: false },
      }));

      // Build prompt with ALL previous outputs in the chain
      const prompt = buildSequentialPrompt(
        video, channel, channelMedian, recentVideos,
        referenceStore, keywordBank,
        expert.id, forecastDays,
        collectedOutputs,  // ← the growing chain of previous expert outputs
        liveNews,
        platform,
      );

      // Override system prompt per persona
      let rawText = "";
      try {
        const res = await fetch("/api/claude-verdict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            persona: expert.id,
            platform,
            system: getPersonaSystem(expert.id, platform),
          }),
        });
        const data = await res.json();
        rawText = data.text ?? "";
        if (!rawText || rawText.length < 10) throw new Error(data.error ?? "Empty response");
      } catch (err) {
        rawText = `Analysis unavailable: ${err instanceof Error ? err.message : "failed"}`;
        setOpinions(prev => ({
          ...prev,
          [expert.id]: { persona: expert.id, text: rawText, words: rawText.split(" "), loading: false, done: true, error: rawText },
        }));
        continue;
      }

      // Store in deliberation chain (full text, not truncated)
      collectedOutputs[expert.id] = rawText;

      // Stream the words into the UI
      await new Promise<void>(resolve => {
        const iv = streamWords(
          rawText,
          (w) => setOpinions(prev => ({ ...prev, [expert.id]: { ...prev[expert.id], words: w, loading: false } })),
          () => {
            setOpinions(prev => ({
              ...prev,
              [expert.id]: { persona: expert.id, text: rawText, words: rawText.split(" "), loading: false, done: true },
            }));
            resolve();
          },
        );
        intervals.current.push(iv);
      });

      // Brief pause — deliberation feel
      if (i < EXPERTS.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    setActive(null);

    // ── VERDICT — reads all 9 expert outputs ─────────────────────────────────
    setPhase("verdict");
    setActive("verdict");
    setVerdict({ persona: "verdict", text: "", words: [], loading: true, done: false });

    try {
      const verdictCtx = Object.entries(collectedOutputs)
        .map(([p, t]) => {
          const exp = EXPERTS.find(e => e.id === p);
          return `[${(exp?.name ?? p).toUpperCase()}]:\n${t.replace(/\n/g, " ").slice(0, 300)}…`;
        })
        .join("\n\n");

      const vPrompt = buildSequentialPrompt(
        video, channel, channelMedian, recentVideos,
        referenceStore, keywordBank,
        "verdict", forecastDays,
        collectedOutputs, liveNews, platform,
      ) + `\n\n════ ALL 9 EXPERT ANALYSES ════\n${verdictCtx}\n\nDeliver the 4-paragraph decision brief.`;

      const vtRaw = await callExpert(vPrompt, "verdict", platform);
      const vt = stripMd(vtRaw);

      await new Promise<void>(resolve => {
        const iv = streamWords(
          vt,
          (w) => { setVW([...w]); setVerdict(p => p ? { ...p, words: w, loading: false } : p); },
          () => {
            setVW(vt.split(" "));
            setVerdict(p => p ? { ...p, text: vt, words: vt.split(" "), loading: false, done: true } : p);
            setPhase("done");
            setActive(null);
          },
        );
        intervals.current.push(iv);
      });
    } catch {
      setVerdict({ persona: "verdict", text: "Verdict unavailable.", words: ["Verdict", "unavailable."], loading: false, done: true, error: "failed" });
      setPhase("done");
    }

    setRunning(false);
  }

  // Platform label for display
  const platformLabel =
    platform === "tiktok"        ? "TikTok FYP" :
    platform === "instagram"     ? "Instagram Reels" :
    platform === "youtube_short" ? "YouTube Shorts" :
    "YouTube Long-Form";

  return (
    <div className="glass-card" style={{ overflow: "hidden", position: "relative" }}>
      {/* Animated top border */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg,transparent,#60A5FA,#2ECC8A,#A78BFA,#F59E0B,#E879F9,transparent)",
        backgroundSize: "300% 100%",
        animation: phase !== "idle" ? "cosmicShimmer 3s linear infinite" : "none",
      }} />

      <div style={{ padding: "18px 20px" }}>

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,rgba(255,77,106,0.18),rgba(245,158,11,0.10))",
              border: "1px solid rgba(255,77,106,0.3)", fontSize: 15,
              boxShadow: phase !== "idle" ? "0 0 22px rgba(255,77,106,0.4)" : "0 0 8px rgba(255,77,106,0.15)",
              transition: "box-shadow 0.4s",
            }}>⚔</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E6E1", letterSpacing: "-0.02em" }}>
                Expert War Room
              </div>
              <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                <span className="font-mono" style={{ fontSize: 7, color: "#60A5FA", letterSpacing: "0.1em" }}>
                  {platformLabel.toUpperCase()}
                </span>
                <span style={{ fontSize: 7, color: "#3A3835" }}>·</span>
                <span className="font-mono" style={{ fontSize: 7, color: "#5E5A57", letterSpacing: "0.08em" }}>
                  9 EXPERTS · SEQUENTIAL DELIBERATION
                </span>
                {phase !== "idle" && (
                  <>
                    <span style={{ fontSize: 7, color: "#3A3835" }}>·</span>
                    <span className="font-mono" style={{ fontSize: 7, color: "#F59E0B", letterSpacing: "0.08em" }}>
                      ROUND {currentRound}/9
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {TIMEFRAME_OPTIONS.map(opt => (
                <button key={opt.days} onClick={() => setForecast(opt.days)}
                  className="font-mono font-bold rounded-md"
                  style={{
                    padding: "3px 7px", fontSize: 9, cursor: "pointer", transition: "all 0.15s",
                    background: forecastDays === opt.days ? "rgba(96,165,250,0.15)" : "transparent",
                    border: `1px solid ${forecastDays === opt.days ? "rgba(96,165,250,0.4)" : "transparent"}`,
                    color: forecastDays === opt.days ? "#60A5FA" : "#5E5A57",
                  }}>{opt.label}</button>
              ))}
            </div>

            {phase === "idle" && (
              <button onClick={runWarRoom}
                className="flex items-center gap-1.5 font-semibold rounded-lg"
                style={{
                  height: 32, padding: "0 14px", fontSize: 11, cursor: "pointer",
                  background: "linear-gradient(135deg,rgba(255,77,106,0.18),rgba(245,158,11,0.10))",
                  border: "1px solid rgba(255,77,106,0.4)", color: "#E8E6E1",
                  boxShadow: "0 0 16px rgba(255,77,106,0.18),inset 0 1px 0 rgba(255,255,255,0.10)",
                }}>
                <span style={{ fontSize: 12 }}>⚡</span> Run Analysis
              </button>
            )}
            {(phase === "experts" || phase === "verdict") && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="orbital-loader" style={{ width: 12, height: 12, borderTopColor: phase === "verdict" ? "#FF4D6A" : "#E879F9", borderWidth: 1.5 }} />
                <span className="font-mono" style={{ fontSize: 9, color: phase === "verdict" ? "#FF4D6A" : "#E879F9", letterSpacing: "0.08em" }}>
                  {phase === "experts" ? `EXPERT ${currentRound} OF 9` : "SYNTHESISING VERDICT"}
                </span>
              </div>
            )}
            {phase === "done" && (
              <button onClick={runWarRoom}
                className="font-mono rounded-md"
                style={{ padding: "4px 10px", fontSize: 9, color: "#5E5A57", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", letterSpacing: "0.08em" }}>
                ↻ RE-RUN
              </button>
            )}
          </div>
        </div>

        {/* ── LIVE CONTEXT CHIPS ── */}
        {phase !== "idle" && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
              style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)" }}>
              <div>
                <div className="font-mono" style={{ fontSize: 7, color: "#60A5FA", letterSpacing: "0.08em" }}>PLATFORM</div>
                <div className="font-mono font-bold" style={{ fontSize: 8, color: "#E8E6E1" }}>{platformLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
              style={{ background: `${currentTier.color}08`, border: `1px solid ${currentTier.color}22` }}>
              <div>
                <div className="font-mono" style={{ fontSize: 7, color: currentTier.color, letterSpacing: "0.08em" }}>VRS SCORE</div>
                <div className="font-mono font-bold" style={{ fontSize: 8, color: "#E8E6E1" }}>{video.vrs.estimatedFullScore}/100</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
              style={{ background: "rgba(46,204,138,0.06)", border: "1px solid rgba(46,204,138,0.18)" }}>
              <div>
                <div className="font-mono" style={{ fontSize: 7, color: "#2ECC8A", letterSpacing: "0.08em" }}>{forecastDays}D FORECAST</div>
                <div className="font-mono font-bold" style={{ fontSize: 8, color: "#E8E6E1" }}>{formatNumber(fTotal)} <span style={{ color: "#5E5A57" }}>+{formatNumber(fAdd)}</span></div>
              </div>
            </div>
            {newsCtx && (
              <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
                style={{ background: "rgba(232,121,249,0.06)", border: "1px solid rgba(232,121,249,0.2)" }}>
                <span style={{ fontSize: 9 }}>📈</span>
                <div className="font-mono" style={{ fontSize: 7, color: "#E879F9", letterSpacing: "0.08em" }}>LIVE NEWS CONTEXT ACTIVE</div>
              </div>
            )}
          </div>
        )}

        {/* ── ROUND TABLE — live deliberation view ── */}
        {(phase === "experts" || phase === "verdict" || phase === "done") && (
          <div className="mb-5" style={{ padding: "8px 0 0" }}>
            <RoundTable
              experts={EXPERTS}
              opinions={opinions}
              activeExpert={activeExpert}
              phase={phase}
              currentRound={currentRound}
              onSeatClick={(id) => {
                setExpanded(expanded === id ? null : id);
                // Scroll to the clicked expert's transcript strip
                setTimeout(() => {
                  const el = document.getElementById(`expert-transcript-${id}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 50);
              }}
            />
          </div>
        )}

        {/* ── EXPERT DELIBERATION STRIPS ── */}
        {Object.keys(opinions).length > 0 && (
          <div className="space-y-1.5 mb-4">
            {EXPERTS.map((expert, idx) => {
              const op       = opinions[expert.id];
              const isActive = activeExpert === expert.id && !op?.done;
              const isExp    = expanded === expert.id;
              const isQueued = !op?.done && !isActive && phase === "experts" && currentRound <= idx;
              const borderColor = isActive
                ? `${expert.color}55`
                : op?.done && !op?.error ? `${expert.color}22`
                : "rgba(255,255,255,0.05)";
              const preview = op?.words?.slice(0, 18).join(" ") ?? "";

              return (
                <div id={`expert-transcript-${expert.id}`} key={expert.id} style={{
                  background: isActive ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.20)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 9, overflow: "hidden",
                  boxShadow: isActive ? `0 0 18px ${expert.glow}` : "none",
                  opacity: isQueued ? 0.4 : 1,
                  transition: "border-color 0.2s,box-shadow 0.2s,opacity 0.3s",
                }}>
                  {isActive && (
                    <div style={{
                      height: 1,
                      background: `linear-gradient(90deg,transparent,${expert.color},transparent)`,
                      backgroundSize: "200% 100%",
                      animation: "cosmicShimmer 1.0s linear infinite",
                    }} />
                  )}

                  {/* Header */}
                  <button
                    onClick={() => op?.done ? setExpanded(isExp ? null : expert.id) : undefined}
                    className="w-full flex items-center gap-2.5"
                    style={{ padding: "8px 12px", background: "transparent", border: "none", cursor: op?.done ? "pointer" : "default", textAlign: "left" }}
                  >
                    {/* Round number */}
                    <div className="font-mono" style={{
                      fontSize: 9, width: 18, textAlign: "center", flexShrink: 0,
                      color: isActive ? expert.color : "#3A3835",
                    }}>{idx + 1}</div>

                    {/* Icon */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `linear-gradient(135deg,${expert.color}20,${expert.color}08)`,
                      border: `1px solid ${expert.color}30`, fontSize: 12,
                      boxShadow: isActive ? `0 0 12px ${expert.color}60` : "none",
                    }}>{expert.icon}</div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E8E6E1" }}>{expert.name}</span>
                        <span className="font-mono" style={{ fontSize: 7, color: expert.color, opacity: 0.6, letterSpacing: "0.07em" }}>{expert.role.toUpperCase()}</span>
                      </div>
                      {op?.done && !isExp && (
                        <div style={{ fontSize: 10.5, color: "#5E5A57", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {preview}…
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
                          <ThinkingDots color={expert.color} />
                          <span className="font-mono" style={{ fontSize: 7, color: expert.color, letterSpacing: "0.08em" }}>DELIBERATING…</span>
                        </div>
                      )}
                      {isQueued && (
                        <div style={{ fontSize: 8, color: "#3A3835", marginTop: 1, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                          WAITING FOR ROUND {currentRound}…
                        </div>
                      )}
                    </div>

                    {/* Right indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {op?.done && !op?.error && <CircuitNode color={expert.color} size={5} />}
                      {op?.done && (
                        <span className="font-mono" style={{ fontSize: 9, color: isExp ? "#E8E6E1" : "#4A4845" }}>
                          {isExp ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded full text */}
                  {op?.done && isExp && (
                    <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${expert.color}12` }}>
                      <pre style={{
                        fontSize: 11.5, color: "#B8B6B1", lineHeight: 1.75,
                        paddingTop: 10, margin: 0,
                        fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{op.text}</pre>
                    </div>
                  )}

                  {/* Streaming text */}
                  {!op?.done && (op?.words ?? []).length > 0 && (
                    <div style={{ padding: "0 12px 10px" }}>
                      <p style={{ fontSize: 11, color: "#8A8885", lineHeight: 1.65, margin: 0 }}>
                        {(op?.words ?? []).join(" ")}
                        <span style={{ display: "inline-block", width: 6, height: 11, verticalAlign: "middle", background: expert.color, marginLeft: 2, opacity: 0.8, animation: "glowPulse 0.7s ease-in-out infinite" }} />
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CHIEF INTELLIGENCE VERDICT ── */}
        {verdict && (
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: `1px solid ${verdict.done ? "rgba(255,255,255,0.12)" : "rgba(255,77,106,0.35)"}`,
            background: "rgba(0,0,0,0.3)",
            boxShadow: verdict.done ? "none" : "0 0 28px rgba(255,77,106,0.10)",
            transition: "border-color 0.4s,box-shadow 0.4s",
          }}>
            {!verdict.done && <div style={{ height: 2, background: "linear-gradient(90deg,#FF4D6A,#F59E0B,#2ECC8A,#60A5FA,#E879F9,#FF4D6A)", backgroundSize: "300% 100%", animation: "cosmicShimmer 2s linear infinite" }} />}
            {verdict.done  && <div style={{ height: 2, background: "linear-gradient(90deg,transparent,#FF4D6A88,#F59E0B88,#2ECC8A88,transparent)" }} />}

            <div className="flex items-center gap-2.5" style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg,rgba(255,77,106,0.2),rgba(245,158,11,0.12))",
                border: "1px solid rgba(255,77,106,0.3)", fontSize: 13,
                boxShadow: verdict.loading ? "0 0 16px rgba(255,77,106,0.4)" : "0 0 6px rgba(255,77,106,0.15)",
              }}>⚖</div>
              <div className="flex-1">
                <div style={{ fontSize: 11, fontWeight: 700, color: "#E8E6E1" }}>Chief Intelligence Verdict</div>
                <div className="font-mono" style={{ fontSize: 7, color: "#5E5A57", letterSpacing: "0.1em" }}>
                  9 EXPERTS · {forecastDays}D HORIZON · DECISION BRIEF
                </div>
              </div>
              {verdict.loading && <span className="orbital-loader" style={{ width: 14, height: 14, borderTopColor: "#FF4D6A", borderWidth: 1.5 }} />}
              {verdict.done && (
                <span className="font-mono font-bold" style={{ fontSize: 8, padding: "2px 8px", borderRadius: 5, background: "rgba(46,204,138,0.12)", border: "1px solid rgba(46,204,138,0.28)", color: "#2ECC8A", letterSpacing: "0.1em" }}>
                  DELIVERED
                </span>
              )}
            </div>

            <div style={{ padding: "14px 16px" }}>
              {verdict.loading && verdictWords.length === 0 && (
                <div className="space-y-2">
                  {[90, 78, 95, 72, 85, 68].map((w, i) => (
                    <div key={i} className="skeleton" style={{ height: 10, width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              )}

              {verdictWords.length > 0 && (() => {
                const paras = verdictWords.join(" ").split("\n\n").map(p => p.trim()).filter(Boolean);
                const LABELS = [
                  { label: "HAPPENING NOW",   color: "#60A5FA" },
                  { label: "WHAT'S NEXT",     color: "#F59E0B" },
                  { label: "CREATOR DIRECTIVE",color: "#34D399" },
                  { label: "SCRIPT HOOK",     color: "#FBBF24" },
                ];
                return (
                  <div className="space-y-3">
                    {paras.map((para, i) => {
                      const L = LABELS[i];
                      const isLast = i === paras.length - 1;
                      return (
                        <div key={i} style={{
                          padding: "10px 12px", borderRadius: 8,
                          background: L ? `${L.color}07` : "rgba(255,255,255,0.02)",
                          borderLeft: `2px solid ${L ? L.color : "rgba(255,255,255,0.12)"}`,
                        }}>
                          {L && <div className="font-mono font-bold mb-1.5" style={{ fontSize: 7, color: L.color, letterSpacing: "0.14em" }}>{L.label}</div>}
                          <p style={{ fontSize: 12.5, color: verdict.done ? "#C8C6C1" : "#B8B6B1", lineHeight: 1.78, margin: 0, fontWeight: i === 0 ? 500 : 400, fontFamily: "var(--font-sans)" }}>
                            {para}
                            {!verdict.done && isLast && (
                              <span style={{ display: "inline-block", width: 8, height: 13, verticalAlign: "middle", background: "#FF4D6A", marginLeft: 3, opacity: 0.85, animation: "glowPulse 0.7s ease-in-out infinite" }} />
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── IDLE STATE — round table ── */}
        {phase === "idle" && (
          <RoundTable
            experts={EXPERTS}
            opinions={{}}
            activeExpert={null}
            phase="idle"
            currentRound={0}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUND TABLE — 9 experts arranged in a circle, visual deliberation
// ═══════════════════════════════════════════════════════════════════════════
//
// Each expert is positioned on a circle using trig (angle = i/9 × 2π, starting
// at 12 o'clock). States:
//
//   queued   — dim, no color, small label
//   speaking — glowing ring, pulsing animation, streaming bubble points to center
//   done     — colored ring, click to expand the transcript below
//
// The center shows context-dependent status:
//   idle    — "Round table of 9" emblem
//   experts — current expert name + round indicator
//   verdict — synthesising loader
//   done    — brief completion marker

interface RoundTableProps {
  experts: typeof EXPERTS;
  opinions: Record<string, ExpertOpinion>;
  activeExpert: string | null;
  phase: "idle" | "experts" | "verdict" | "done";
  currentRound: number;
  onSeatClick?: (expertId: string) => void;
}

function RoundTable({ experts, opinions, activeExpert, phase, currentRound, onSeatClick }: RoundTableProps) {
  const RADIUS = 42;   // percent of container
  const CENTER = 50;

  const activeIdx = activeExpert ? experts.findIndex((e) => e.id === activeExpert) : -1;
  const activeExp = activeIdx >= 0 ? experts[activeIdx] : null;
  const activeOp  = activeExp ? opinions[activeExp.id] : undefined;

  // Precompute seat positions
  const positions = experts.map((_, i) => {
    const angle = (i / experts.length) * 2 * Math.PI - Math.PI / 2;
    return {
      angle,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
      // Is this seat on the right side of the table? (determines bubble placement)
      onRight: Math.cos(angle) >= 0,
      onTop:   Math.sin(angle) < 0,
    };
  });

  return (
    <div style={{
      position: "relative",
      width: "100%",
      maxWidth: 620,
      margin: "0 auto",
      aspectRatio: "1 / 1",
    }}>
      {/* Ambient concentric rings + center disc */}
      <svg
        viewBox="0 0 100 100"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <radialGradient id="rt-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="rgba(255,77,106,0.08)" />
            <stop offset="70%" stopColor="rgba(255,77,106,0)" />
          </radialGradient>
        </defs>

        {/* Outer ring */}
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)"  strokeWidth="0.3" strokeDasharray="0.4 0.8" />
        <circle cx="50" cy="50" r="30" fill="url(#rt-center-glow)" />
        <circle cx="50" cy="50" r="22" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />

        {/* Connection line from active speaker to center */}
        {activeExp && activeIdx >= 0 && (() => {
          const p = positions[activeIdx];
          return (
            <g>
              <line
                x1={p.x} y1={p.y} x2="50" y2="50"
                stroke={activeExp.color} strokeWidth="0.35"
                strokeDasharray="0.8 1.2" opacity="0.6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-4" dur="1.2s" repeatCount="indefinite" />
              </line>
            </g>
          );
        })()}

        {/* Faint chord lines between completed experts — shows "conversation" */}
        {phase !== "idle" && experts.map((e, i) => {
          const op = opinions[e.id];
          if (!op?.done || op.error) return null;
          const prev = experts[i - 1];
          if (!prev || !opinions[prev.id]?.done) return null;
          const p1 = positions[i - 1];
          const p2 = positions[i];
          return (
            <line
              key={`chord-${e.id}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={e.color} strokeWidth="0.2" opacity="0.25"
            />
          );
        })}
      </svg>

      {/* 9 expert seats */}
      {experts.map((expert, i) => {
        const op = opinions[expert.id];
        const isActive = activeExpert === expert.id && !op?.done;
        const isDone = op?.done && !op?.error;
        const isError = op?.done && op?.error;
        const isQueued = !isDone && !isActive && !isError;
        const pos = positions[i];

        return (
          <div
            key={expert.id}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isActive ? 20 : isDone ? 5 : 2,
              transition: "all 0.3s",
            }}
          >
            {/* Seat avatar */}
            <button
              onClick={() => isDone && onSeatClick?.(expert.id)}
              style={{
                width: 52, height: 52, borderRadius: 14,
                background: isActive
                  ? `radial-gradient(circle, ${expert.color}35, ${expert.color}08)`
                  : isDone
                    ? `linear-gradient(135deg, ${expert.color}22, ${expert.color}06)`
                    : isError
                      ? "rgba(255,77,122,0.08)"
                      : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  isActive ? `${expert.color}90`
                  : isDone ? `${expert.color}55`
                  : isError ? "rgba(255,77,122,0.4)"
                  : "rgba(255,255,255,0.1)"
                }`,
                boxShadow: isActive
                  ? `0 0 26px ${expert.glow}, 0 0 10px ${expert.color}40`
                  : isDone
                    ? `0 0 8px ${expert.color}18`
                    : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, lineHeight: 1,
                cursor: isDone ? "pointer" : "default",
                padding: 0,
                animation: isActive ? "seatPulse 1.8s ease-in-out infinite" : "none",
                opacity: isQueued ? 0.4 : 1,
                transition: "all 0.25s",
              }}
              title={`${expert.name} — ${expert.role}`}
            >
              {expert.icon}
            </button>

            {/* Label — name + role */}
            <div style={{
              position: "absolute",
              top: 58,
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              textAlign: "center",
              pointerEvents: "none",
              opacity: isQueued ? 0.5 : 1,
              transition: "opacity 0.25s",
            }}>
              <div style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: isActive ? expert.color : isDone ? "#E8E6E1" : "#6B6964",
                fontFamily: "IBM Plex Mono, monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 1,
              }}>
                {expert.name.split(" ")[0]}
              </div>
              <div style={{
                fontSize: 8.5,
                color: "#5E5A57",
                fontFamily: "IBM Plex Mono, monospace",
                letterSpacing: "0.02em",
              }}>
                {expert.name.split(" ").slice(1).join(" ") || ""}
              </div>
            </div>

            {/* Turn number badge — above the seat */}
            <div style={{
              position: "absolute",
              top: -8,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8,
              fontFamily: "IBM Plex Mono, monospace",
              color: isActive ? expert.color : isDone ? "#8A8883" : "#3A3835",
              fontWeight: 600,
              letterSpacing: "0.06em",
              background: "rgba(0,0,0,0.6)",
              padding: "1px 5px",
              borderRadius: 999,
              border: `1px solid ${isActive ? expert.color + "80" : "rgba(255,255,255,0.06)"}`,
            }}>
              {i + 1}
            </div>

            {/* Speech bubble for active speaker */}
            {isActive && activeOp && (
              <div style={{
                position: "absolute",
                top: "50%",
                ...(pos.onRight
                  ? { right: "calc(100% + 14px)" }
                  : { left:  "calc(100% + 14px)" }),
                transform: "translateY(-50%)",
                minWidth: 180,
                maxWidth: 260,
                background: "rgba(10,10,8,0.96)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${expert.color}70`,
                borderRadius: 10,
                padding: "10px 12px",
                boxShadow: `0 6px 28px rgba(0,0,0,0.5), 0 0 14px ${expert.glow}`,
                zIndex: 30,
              }}>
                {/* Little pointer arrow */}
                <div style={{
                  position: "absolute",
                  top: "50%",
                  ...(pos.onRight ? { right: -5 } : { left: -5 }),
                  transform: `translateY(-50%) rotate(${pos.onRight ? 45 : -135}deg)`,
                  width: 8, height: 8,
                  background: "rgba(10,10,8,0.96)",
                  borderTop: `1px solid ${expert.color}70`,
                  borderRight: `1px solid ${expert.color}70`,
                }} />

                <div style={{
                  fontSize: 9, color: expert.color,
                  fontFamily: "IBM Plex Mono, monospace",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  fontWeight: 600, marginBottom: 4,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: 99,
                    background: expert.color,
                    boxShadow: `0 0 6px ${expert.color}`,
                    animation: "seatPulse 0.9s ease-in-out infinite",
                  }} />
                  speaking
                </div>
                <div style={{
                  fontSize: 11, color: "#E8E6E1", lineHeight: 1.5,
                  maxHeight: 90, overflow: "hidden",
                }}>
                  {activeOp.words?.length
                    ? "…" + activeOp.words.slice(-28).join(" ")
                    : "thinking…"}
                </div>
              </div>
            )}

            {/* Done — brief stance peek on hover */}
            {isDone && op?.words?.length ? (
              <div style={{
                position: "absolute",
                top: "50%",
                ...(pos.onRight
                  ? { right: "calc(100% + 10px)" }
                  : { left:  "calc(100% + 10px)" }),
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                fontSize: 8.5,
                color: "#6B6964",
                fontFamily: "IBM Plex Mono, monospace",
                letterSpacing: "0.02em",
                opacity: 0.7,
                pointerEvents: "none",
              }}>
                ✓ {op.words.length}w
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Center content */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        width: "32%",
      }}>
        {phase === "idle" && (
          <>
            <div style={{
              fontSize: 28, marginBottom: 6,
              filter: "grayscale(0.3)",
            }}>⚔</div>
            <div style={{
              fontSize: 9, color: "#5E5A57",
              fontFamily: "IBM Plex Mono, monospace",
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 3,
            }}>
              Round table · 9 seats
            </div>
            <div style={{ fontSize: 8.5, color: "#3A3835", lineHeight: 1.5 }}>
              Press <em>Run Analysis</em><br />to convene
            </div>
          </>
        )}

        {phase === "experts" && (
          <>
            <div style={{
              fontSize: 9, color: "#E879F9",
              fontFamily: "IBM Plex Mono, monospace",
              letterSpacing: "0.08em", marginBottom: 4,
            }}>
              ROUND {currentRound} OF 9
            </div>
            {activeExp ? (
              <>
                <div style={{ fontSize: 11, color: activeExp.color, fontWeight: 600, marginBottom: 3, lineHeight: 1.2 }}>
                  {activeExp.name}
                </div>
                <div style={{
                  fontSize: 8.5, color: "#8A8883", lineHeight: 1.4,
                  fontStyle: "italic",
                }}>
                  "{activeExp.stance}"
                </div>
              </>
            ) : (
              <div style={{ fontSize: 9, color: "#8A8883" }}>next expert preparing…</div>
            )}
          </>
        )}

        {phase === "verdict" && (
          <>
            <div className="orbital-loader" style={{
              width: 18, height: 18, margin: "0 auto 8px",
              borderTopColor: "#FF4D6A", borderWidth: 2,
            }} />
            <div style={{
              fontSize: 9, color: "#FF4D6A",
              fontFamily: "IBM Plex Mono, monospace",
              letterSpacing: "0.08em",
            }}>
              synthesising
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✓</div>
            <div style={{
              fontSize: 9, color: "#2ECC8A",
              fontFamily: "IBM Plex Mono, monospace",
              letterSpacing: "0.08em",
            }}>
              deliberation complete
            </div>
            <div style={{ fontSize: 8.5, color: "#5E5A57", marginTop: 4 }}>
              click any seat to read
            </div>
          </>
        )}
      </div>

      {/* Scoped keyframes */}
      <style jsx>{`
        @keyframes seatPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   }
          50%      { transform: translate(-50%, -50%) scale(1.06);}
        }
      `}</style>
    </div>
  );
}
