"use client";

import React, { useState, useEffect, useRef } from "react";
import type { EnrichedVideo, ChannelData, ReferenceStore, KeywordBank } from "@/lib/types";
import { puterAIChat } from "@/lib/puter-ai";
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

const EXPERTS = [
  { id: "algorithm",    name: "Algorithm Analyst",        role: "Distribution & Signal Intel",  icon: "⚡", color: "#60A5FA", glow: "rgba(96,165,250,0.35)",  stance: "Platform signals drive everything"  },
  { id: "strategist",   name: "Content Strategist",       role: "Format, Hook & Title",         icon: "◆",  color: "#2ECC8A", glow: "rgba(46,204,138,0.32)",  stance: "Content quality determines ceiling" },
  { id: "psychologist", name: "Audience Psychologist",    role: "Comment & Behaviour Analysis", icon: "◎",  color: "#A78BFA", glow: "rgba(167,139,250,0.30)", stance: "Human motivation is the real driver"},
  { id: "competitor",   name: "Competitive Intelligence", role: "Niche & Benchmark Analysis",   icon: "🎯", color: "#F59E0B", glow: "rgba(245,158,11,0.30)",  stance: "Relative performance vs niche"      },
];

const PERSONA_SYSTEMS: Record<string, string> = {
  algorithm:    "You are an Algorithm Analyst. Write EXACTLY 3 sentences. Sentence 1: what the algorithm is doing to this video right now and why. Sentence 2: the specific signal that is limiting or driving distribution. Sentence 3: the one thing that would change the algorithm's decision. Numbers only. No fluff.",
  strategist:   "You are a Content Strategist. Write EXACTLY 3 sentences. Sentence 1: whether the hook and title are working — cite the engagement number as proof. Sentence 2: the structural reason the content is succeeding or failing. Sentence 3: the single highest-leverage change. Disagree with algorithm-first thinking where warranted.",
  psychologist: "You are an Audience Psychologist. Write EXACTLY 3 sentences. Sentence 1: the emotional need this content is meeting — cite comment density as proof. Sentence 2: what this audience type does after watching. Sentence 3: the retention risk based on emotional pattern.",
  competitor:   "You are a Competitive Intelligence Analyst. Write EXACTLY 3 sentences. Sentence 1: where this video is outperforming comparable creators — cite pool data. Sentence 2: where it is losing ground and why. Sentence 3: the one thing being left on the table.",
  verdict: `You are a Chief Intelligence Officer delivering a 3-part operational brief. You have received analysis from 4 experts. Ignore the debate. Extract what matters.

Write EXACTLY 3 sections, each 2-3 sentences. No headers. No bullets. No markdown. No expert attribution. Plain prose only.

SECTION 1 — WHAT IS HAPPENING RIGHT NOW: State what the algorithm is doing to this video at this moment and why, based on the specific signals in the data. Be precise about the mechanism.

SECTION 2 — WHAT WILL HAPPEN NEXT BECAUSE OF THIS: State the most likely outcome in the forecast window and the specific condition that will either accelerate or kill it. One sentence on the risk, one on the opportunity.

SECTION 3 — WHAT TO DO WITH THIS INFORMATION: Give one clear directive the creator should act on within 48 hours. Then state the one specific mistake they must not make right now.

No waffle. No hedging. This is a decision brief, not an analysis.`,
};

const TIMEFRAME_OPTIONS = [
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

async function callExpert(prompt: string, persona: string): Promise<string> {
  try {
    const res = await fetch("/api/claude-verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, persona }),
    });
    const data: { text?: string } = await res.json().catch(() => ({}));
    if (data.text && data.text.length > 20) return data.text;
  } catch { /* fall through */ }
  return await puterAIChat(prompt, PERSONA_SYSTEMS[persona] ?? PERSONA_SYSTEMS.algorithm);
}

function buildDeepPrompt(
  video: EnrichedVideo,
  channel: ChannelData | null,
  channelMedian: number,
  recentVideos: EnrichedVideo[],
  referenceStore: ReferenceStore | null | undefined,
  keywordBank: KeywordBank | null | undefined,
  persona: string,
  forecastDays: number,
  otherOpinions: Record<string, string>
): string {
  const secs = video.durationSeconds ?? 0;
  const platform = secs <= 60 ? "youtube_short" : "youtube";

  const base = buildContextualPrompt({ video, channel, channelMedian, platform, phase: "ANALYSIS", recentVideos, referenceStore, keywordBank, persona });

  const poolEntries = referenceStore?.entries ?? [];
  const creatorEntries = poolEntries.filter(e => e.channelName === video.channel);
  const platformEntries = poolEntries.filter(e => e.platform === "youtube");
  const subBand = channel?.subs ?? 0;
  const lookalikeEntries = platformEntries.filter(e => { const s = e.metrics?.subs ?? 0; return s > subBand * 0.5 && s < subBand * 2; });
  const lookalikeAvgViews = lookalikeEntries.length > 0 ? Math.round(lookalikeEntries.reduce((s,e)=>s+(e.metrics?.views??0),0)/lookalikeEntries.length) : 0;
  const creatorViews = creatorEntries.map(e=>e.metrics?.views??0).filter(v=>v>0).sort((a,b)=>b-a);
  const creatorRank = creatorViews.findIndex(v=>v<=video.views)+1;
  const creatorPercentile = creatorViews.length > 0 ? Math.round((1-(creatorRank/creatorViews.length))*100) : null;

  const decayRate = 0.95;
  let forecastViews = video.views; let fVel = video.velocity;
  for (let d=0; d<forecastDays; d++) { fVel *= decayRate; forecastViews += fVel; }
  const forecastTotal = Math.round(forecastViews);
  const forecastAdditional = Math.round(forecastViews - video.views);

  const deepContext = `
\u2550\u2550\u2550 DEEP ANALYTICS \u2014 ${forecastDays}-DAY TIMEFRAME \u2550\u2550\u2550

CREATOR DISCOGRAPHY (${video.channel}):
  Pool entries: ${creatorEntries.length} videos | View range: ${creatorViews.length ? formatNumber(Math.min(...creatorViews))+' – '+formatNumber(Math.max(...creatorViews)) : 'N/A'}
  ${creatorPercentile!==null ? 'Estimated rank: Top '+(100-creatorPercentile)+'% of catalogue' : 'Insufficient pool data'}
  Channel median: ${formatNumber(channelMedian)} | This video: ${video.vsBaseline}x above median

LOOKALIKE AUDIENCE (similar sub count ${formatNumber(subBand*0.5)}–${formatNumber(subBand*2)}):
  ${lookalikeEntries.length} channels tracked | Avg views: ${lookalikeAvgViews>0?formatNumber(lookalikeAvgViews):'N/A'}
  ${lookalikeAvgViews>0?'This video vs lookalike avg: '+Math.round(((video.views-lookalikeAvgViews)/lookalikeAvgViews)*100)+'%':''}

NICHE POOL (${platformEntries.length} videos):
  Pool avg VRS: ${platformEntries.length>0?Math.round(platformEntries.reduce((s,e)=>s+(e.metrics?.vrsScore??0),0)/platformEntries.length):0}/100

${forecastDays}-DAY PROJECTION (5% daily velocity decay):
  Current: ${formatNumber(video.views)} views (day ${video.days})
  Projected total at day ${video.days+forecastDays}: ${formatNumber(forecastTotal)} (+${formatNumber(forecastAdditional)})
  Confidence: ${video.days<3?'LOW (<3 days old)':video.days<7?'MEDIUM':'HIGH (decay curve established)'}`;

  const debateContext = Object.entries(otherOpinions).length > 0
    ? `\n\n\u2550\u2550\u2550 OTHER EXPERT ANALYSES \u2550\u2550\u2550\n${Object.entries(otherOpinions).map(([p,t])=>`[${p.toUpperCase()}]: ${t.slice(0,350)}\u2026`).join("\n\n")}\n\nNow give YOUR analysis. Disagree with others where your expertise differs.`
    : "";

  return base + deepContext + debateContext;
}


// Strip markdown from AI response text
function stripMd(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, "")          // ## headings
    .replace(/\*\*(.+?)\*\*/g, "$1")       // **bold**
    .replace(/\*(.+?)\*/g, "$1")           // *italic*
    .replace(/^[-*]\s+/gm, "")            // bullet points
    .replace(/`(.+?)`/g, "$1")            // `code`
    .replace(/\n{3,}/g, "\n\n")         // triple newlines
    .trim();
}


// Keywords that pop out of chat bubbles during streaming
const EXPERT_KEYWORDS: Record<string, string[]> = {
  algorithm:    ["CTR","VRS","velocity","retention","distribution","signals","AVD","seed","expansion"],
  strategist:   ["hook","format","title","thumbnail","CTA","narrative","structure","engagement"],
  psychologist: ["anxiety","trust","community","identity","emotion","validation","comment","behavior"],
  competitor:   ["niche","benchmark","gap","competitor","market","dominance","share","positioning"],
};

function FloatingKeyword({ word, color, delay }: { word: string; color: string; delay: number }) {
  const [visible, setVisible] = React.useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setVisible(false), delay + 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delay]);
  const x = (Math.random() * 160 - 80).toFixed(0);
  const yEnd = -(40 + Math.random() * 40).toFixed(0);
  return visible ? (
    <span
      className="font-mono font-bold pointer-events-none"
      style={{
        position: "absolute",
        bottom: 12, left: "50%",
        fontSize: 9, color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        padding: "2px 6px", borderRadius: 99,
        whiteSpace: "nowrap",
        transform: `translateX(${x}px)`,
        opacity: 0,
        animation: `floatKw 1.8s ease-out ${delay}ms forwards`,
        zIndex: 10,
      }}
    >
      {word}
    </span>
  ) : null;
}


// VRS tier classification
function getVRSTier(score: number) {
  if (score >= 80) return { label: "TIER 1 — EXCELLENT", color: "#2ECC8A", glow: "rgba(46,204,138,0.4)",  desc: "Algorithm will actively push this into non-subscriber feeds" };
  if (score >= 65) return { label: "TIER 2 — STRONG",   color: "#60A5FA", glow: "rgba(96,165,250,0.35)", desc: "Solid distribution signal — expect steady algorithmic support" };
  if (score >= 50) return { label: "TIER 3 — COMPETITIVE", color: "#F59E0B", glow: "rgba(245,158,11,0.30)", desc: "In the algorithm's consideration set — needs stronger signals to break out" };
  if (score >= 35) return { label: "TIER 4 — NEEDS WORK", color: "#F97316", glow: "rgba(249,115,22,0.28)", desc: "Limited algorithmic push — fix retention and CTR signals first" };
  return        { label: "TIER 5 — REWORK",     color: "#FF4D6A", glow: "rgba(255,77,106,0.35)", desc: "Algorithm is suppressing this content — significant changes needed" };
}

// Predicted tier based on momentum
function getPredictedTier(video: EnrichedVideo, forecastDays: number) {
  const current = video.vrs.estimatedFullScore;
  const momentumBoost = video.isOutlier ? Math.min(15, forecastDays * 0.3) : video.vsBaseline > 1.5 ? Math.min(8, forecastDays * 0.15) : 0;
  const decayPenalty  = video.days > 30 ? Math.min(10, (video.days - 30) * 0.2) : 0;
  const predicted = Math.max(0, Math.min(100, Math.round(current + momentumBoost - decayPenalty)));
  return { score: predicted, tier: getVRSTier(predicted), delta: predicted - current };
}


// Futuristic scan line component
function ScanLine({ color }: { color: string }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${color}88 30%, ${color} 50%, ${color}88 70%, transparent 100%)`,
      backgroundSize: "200% 100%",
      animation: "cosmicShimmer 1.2s linear infinite",
      opacity: 0.9,
      zIndex: 3,
    }} />
  );
}

// Circuit node decoration
function CircuitNode({ color, size = 4 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, boxShadow: `0 0 ${size*2}px ${color}, 0 0 ${size*4}px ${color}55`,
      flexShrink: 0,
      animation: "pulseDot 2s ease-in-out infinite",
    }} />
  );
}


// ── Lifecycle stage per platform ──────────────────────────────────────────────
function getLifecycleStage(video: EnrichedVideo, platform: string) {
  const { days, velocity, vsBaseline } = video;
  const secs = video.durationSeconds ?? 0;
  const isShort = secs <= 60 || platform === "youtube_short" || platform === "tiktok" || platform === "instagram";

  if (isShort) {
    // Short-form lifecycle is compressed
    if (days <= 1)  return { stage: "LAUNCH WINDOW",    color: "#E879F9", icon: "◈", desc: "First 24h — algorithm sampling" };
    if (days <= 3)  return { stage: "PEAK WINDOW",      color: "#FF4D6A", icon: "▲", desc: "Days 2–3 — max distribution" };
    if (days <= 7)  return { stage: "RESIDUAL PUSH",    color: "#F59E0B", icon: "◆", desc: "Days 4–7 — tail distribution" };
    if (days <= 14) return { stage: "SEARCH PHASE",     color: "#60A5FA", icon: "◎", desc: "Week 2 — search-dependent reach" };
    return           { stage: "EVERGREEN",              color: "#2ECC8A", icon: "✦", desc: "14d+ — passive discovery only" };
  } else {
    // Long-form lifecycle
    if (days <= 2)  return { stage: "48H SEED PHASE",   color: "#E879F9", icon: "◈", desc: "Algorithm sampling initial engagement" };
    if (days <= 7)  {
      if (vsBaseline >= 3) return { stage: "VIRAL EXPANSION",  color: "#FF4D6A", icon: "🔥", desc: "Breaking out of subscriber base" };
      if (vsBaseline >= 1.5) return { stage: "RESONANCE PHASE", color: "#F59E0B", icon: "⚡", desc: "Algorithm testing broader distribution" };
      return { stage: "EARLY PLATEAU",   color: "#6B6860", icon: "—",  desc: "Limited expansion signal" };
    }
    if (days <= 30) {
      if (velocity > 5000) return { stage: "SUSTAINED PUSH",   color: "#60A5FA", icon: "▶", desc: "Algorithm maintaining distribution" };
      return { stage: "DECAY PHASE",     color: "#F97316", icon: "↘", desc: "Velocity declining toward baseline" };
    }
    if (days <= 90) return { stage: "REFERENCE CONTENT", color: "#A78BFA", icon: "◉", desc: "Search-driven, not recommended" };
    return           { stage: "ARCHIVE",                 color: "#4A4845", icon: "⊟", desc: "Historical value only" };
  }
}

// ── Virality tier ─────────────────────────────────────────────────────────────
function getViralityTier(video: EnrichedVideo) {
  const { vsBaseline, vrs, engagement, days, velocity } = video;
  const vrsScore = vrs.estimatedFullScore;
  const commentRate = video.views > 0 ? (video.comments / video.views) * 1000 : 0;

  // Composite virality score
  const score =
    (vsBaseline >= 5 ? 40 : vsBaseline >= 3 ? 30 : vsBaseline >= 2 ? 20 : vsBaseline >= 1.5 ? 12 : 5) +
    (vrsScore >= 80 ? 25 : vrsScore >= 65 ? 18 : vrsScore >= 50 ? 10 : 4) +
    (engagement >= 10 ? 20 : engagement >= 6 ? 14 : engagement >= 3 ? 8 : 3) +
    (commentRate >= 5 ? 15 : commentRate >= 2 ? 10 : commentRate >= 0.8 ? 5 : 1);

  if (score >= 85) return { tier: "VIRAL",        level: 1, color: "#FF4D6A", glow: "rgba(255,77,106,0.5)",  icon: "🔥", desc: "Breaking out of niche — algorithm actively amplifying" };
  if (score >= 65) return { tier: "BREAKOUT",     level: 2, color: "#F59E0B", glow: "rgba(245,158,11,0.4)", icon: "⚡", desc: "Strong signals — nearing broader distribution" };
  if (score >= 45) return { tier: "RESONANT",     level: 3, color: "#60A5FA", glow: "rgba(96,165,250,0.35)",icon: "◈", desc: "Performing above baseline — algorithm interested" };
  if (score >= 28) return { tier: "CIRCULATING",  level: 4, color: "#A78BFA", glow: "rgba(167,139,250,0.3)",icon: "◆", desc: "Steady distribution within existing audience" };
  if (score >= 15) return { tier: "CONTAINED",    level: 5, color: "#6B6860", glow: "rgba(107,104,96,0.2)", icon: "○", desc: "Limited to subscriber base — no expansion signal" };
  return             { tier: "SUPPRESSED",        level: 6, color: "#FF4D6A33" as string, glow: "rgba(255,77,106,0.15)", icon: "✗", desc: "Algorithm not distributing — signals too weak" };
}

// ── Content type tier ─────────────────────────────────────────────────────────
function getContentTypeTier(video: EnrichedVideo, platform: string) {
  const secs = video.durationSeconds ?? 0;
  const title = video.title.toLowerCase();
  const eng = video.engagement;

  // Format
  const format = secs <= 60 ? "SHORT-FORM" : secs <= 600 ? "MID-FORM" : secs <= 1800 ? "LONG-FORM" : "DEEP-DIVE";

  // Content archetype from title signals
  const isControversy  = /banned|exposed|scam|fraud|worst|never|secret|hiding/i.test(title);
  const isProof        = /proof|payout|result|made|earned|\$/i.test(title);
  const isTutorial     = /how to|guide|step|beginner|learn|strategy/i.test(title);
  const isReview       = /review|test|tried|honest|vs/i.test(title);
  const isPersonal     = /my |i |story|journey|day|week|month/i.test(title);

  const archetype = isControversy ? "CONTROVERSY" : isProof ? "PROOF/RESULT" : isTutorial ? "TUTORIAL" : isReview ? "REVIEW" : isPersonal ? "PERSONAL" : "INFORMATIONAL";

  // Algorithm fit score for this format on this platform
  const platformFit: Record<string, Record<string, number>> = {
    youtube:        { "SHORT-FORM": 45, "MID-FORM": 85, "LONG-FORM": 78, "DEEP-DIVE": 52 },
    youtube_short:  { "SHORT-FORM": 95, "MID-FORM": 30, "LONG-FORM": 15, "DEEP-DIVE": 10 },
    tiktok:         { "SHORT-FORM": 95, "MID-FORM": 55, "LONG-FORM": 25, "DEEP-DIVE": 10 },
    instagram:      { "SHORT-FORM": 90, "MID-FORM": 60, "LONG-FORM": 20, "DEEP-DIVE": 8  },
  };
  const fit = platformFit[platform]?.[format] ?? 50;
  const fitLabel = fit >= 80 ? "OPTIMAL FIT" : fit >= 60 ? "GOOD FIT" : fit >= 40 ? "MODERATE FIT" : "POOR FIT";
  const fitColor = fit >= 80 ? "#2ECC8A" : fit >= 60 ? "#60A5FA" : fit >= 40 ? "#F59E0B" : "#FF4D6A";

  return { format, archetype, fit, fitLabel, fitColor };
}

function streamWords(text: string, onWord: (w:string[])=>void, onDone: ()=>void) {
  const words = text.split(" "); let i = 0; const cur: string[] = [];
  return setInterval(() => {
    if (i >= words.length) { onDone(); return; }
    const chunk = Math.min(words.length-i, Math.floor(Math.random()*3)+1);
    for (let j=0;j<chunk;j++) cur.push(words[i++]);
    onWord([...cur]);
  }, 30);
}

function ThinkingDots({ color }: { color: string }) {
  const [f, setF] = useState(0);
  useEffect(()=>{ const t=setInterval(()=>setF(x=>(x+1)%4),350); return()=>clearInterval(t); },[]);
  return <span className="font-mono" style={{ color, fontSize: 13, letterSpacing: 2 }}>{"●".repeat(f)}{"○".repeat(3-f)}</span>;
}

export default function ExpertWarRoomPanel({ video, channel, channelMedian, recentVideos, referenceStore, keywordBank }: ExpertWarRoomProps) {
  const [opinions, setOpinions]     = useState<Record<string, ExpertOpinion>>({});
  const [verdict, setVerdict]       = useState<ExpertOpinion|null>(null);
  const [verdictWords, setVW]       = useState<string[]>([]);
  const [running, setRunning]       = useState(false);
  const [phase, setPhase]           = useState<"idle"|"experts"|"verdict"|"done">("idle");
  const [forecastDays, setForecast] = useState(30);
  const [activeExpert, setActive]   = useState<string|null>(null);
  const [expanded, setExpanded]     = useState<string|null>(null);
  const [speakOrder, setSpeakOrder] = useState<string[]>([]);
  const [crossTalk, setCrossTalk]   = useState<{from:string;to:string;word:string}|null>(null);
  const intervals                   = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(()=>()=>{ intervals.current.forEach(clearInterval); },[]);

  // Computed values
  const secs = video.durationSeconds ?? 0;
  const plt  = secs <= 60 ? "youtube_short" : "youtube";
  const lifecycle   = getLifecycleStage(video, plt);
  const viralTier   = getViralityTier(video);
  const contentType = getContentTypeTier(video, plt);
  const currentTier = getVRSTier(video.vrs.estimatedFullScore);
  const predicted   = getPredictedTier(video, forecastDays);
  const decayRate   = 0.95;
  let fv = video.views; let fvel = video.velocity;
  for(let d=0;d<forecastDays;d++){fvel*=decayRate;fv+=fvel;}
  const fTotal = Math.round(fv);
  const fAdd   = Math.round(fv - video.views);

  async function runWarRoom() {
    intervals.current.forEach(clearInterval); intervals.current = [];
    setRunning(true); setPhase("experts"); setOpinions({}); setVerdict(null); setVW([]); setExpanded(null);
    setSpeakOrder([]); setCrossTalk(null);
    updateSessionMemory(video, channel, plt, "WAR_ROOM");

    // Init all as queued
    const init: Record<string,ExpertOpinion> = {};
    EXPERTS.forEach(e=>{ init[e.id]={ persona:e.id, text:"", words:[], loading:true, done:false }; });
    setOpinions({...init});

    // Fire all API calls in parallel (fast) but stream results sequentially (visual drama)
    const results: Record<string,string> = {};
    const fetched: Record<string,string> = {};

    // Start all fetches simultaneously
    await Promise.all(EXPERTS.map(async(expert)=>{
      try {
        const prompt = buildDeepPrompt(video,channel,channelMedian,recentVideos,referenceStore,keywordBank,expert.id,forecastDays,{});
        fetched[expert.id] = await callExpert(prompt, expert.id);
      } catch(err) {
        fetched[expert.id] = "__error__" + (err instanceof Error ? err.message : "failed");
      }
    }));

    // Stream results one at a time — sequential deliberation feel
    const order = [...EXPERTS];
    setSpeakOrder([]);

    for(let i=0; i<order.length; i++){
      const expert = order[i];
      setActive(expert.id);
      setSpeakOrder(prev=>[...prev, expert.id]);

      const raw = fetched[expert.id] ?? "";
      if(raw.startsWith("__error__")){
        const msg = raw.replace("__error__","");
        setOpinions(p=>({...p,[expert.id]:{persona:expert.id,text:msg,words:msg.split(" "),loading:false,done:true,error:msg}}));
        continue;
      }

      results[expert.id] = raw;

      // Trigger cross-talk pulse to previous expert (they're reacting)
      if(i>0){
        const prev = order[i-1];
        const triggerWord = raw.split(" ").slice(0,3).join(" ");
        setCrossTalk({from:expert.id, to:prev.id, word:triggerWord});
        await new Promise(r=>setTimeout(r, 600));
        setCrossTalk(null);
      }

      // Stream this expert's words
      await new Promise<void>(resolve=>{
        const iv = streamWords(
          raw,
          (w)=>setOpinions(p=>({...p,[expert.id]:{...p[expert.id],words:w,loading:false}})),
          ()=>{
            setOpinions(p=>({...p,[expert.id]:{...p[expert.id],text:raw,words:raw.split(" "),loading:false,done:true}}));
            resolve();
          }
        );
        intervals.current.push(iv);
      });

      // Brief pause between experts — feels like they're considering each other
      if(i < order.length-1) await new Promise(r=>setTimeout(r,400));
    }

    setActive(null);

    setPhase("verdict"); setActive("verdict");
    setVerdict({ persona:"verdict", text:"", words:[], loading:true, done:false });
    try {
      const verdictContext = Object.entries(results)
        .map(([p,t])=>`[${p.toUpperCase()}]: ${t.replace(/\n/g," ").slice(0,200)}…`)
        .join("\n\n");
      const vp = buildDeepPrompt(video,channel,channelMedian,recentVideos,referenceStore,keywordBank,"verdict",forecastDays,{}) +
        `\n\n═══ EXPERT SIGNALS ═══\n${verdictContext}\n\nYOUR BRIEF: Write the 3-section operational brief. What is happening. What will happen next. What to do.`;
      const vtRaw = await callExpert(vp,"verdict");
      const vt = stripMd(vtRaw);
      const iv = streamWords(
        vt,
        (w)=>{ setVW([...w]); setVerdict(p=>p?{...p,words:w,loading:false}:p); },
        ()=>{ setVW(vt.split(" ")); setVerdict(p=>p?{...p,text:vt,words:vt.split(" "),loading:false,done:true}:p); setPhase("done"); setActive(null); }
      );
      intervals.current.push(iv);
    } catch {
      setVerdict({ persona:"verdict", text:"Verdict unavailable.", words:["Verdict","unavailable."], loading:false, done:true, error:"failed" });
      setPhase("done");
    }
    setRunning(false);
  }

  const allDone = EXPERTS.every(e => opinions[e.id]?.done);

  return (
    <div className="glass-card" style={{ overflow:"hidden", position:"relative" }}>
      {/* Animated top border */}
      <div style={{ height:2, background:"linear-gradient(90deg,transparent,#60A5FA,#2ECC8A,#A78BFA,#F59E0B,transparent)", backgroundSize:"300% 100%", animation: phase!=="idle" ? "cosmicShimmer 3s linear infinite" : "none" }} />

      <div style={{ padding:"18px 20px" }}>

        {/* ── HEADER ROW ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div style={{
              width:34,height:34,borderRadius:9,flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"linear-gradient(135deg,rgba(255,77,106,0.18),rgba(245,158,11,0.10))",
              border:"1px solid rgba(255,77,106,0.3)",fontSize:15,
              boxShadow: phase!=="idle" ? "0 0 22px rgba(255,77,106,0.4)" : "0 0 8px rgba(255,77,106,0.15)",
              transition:"box-shadow 0.4s",
            }}>⚔</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#E8E6E1",letterSpacing:"-0.02em"}}>Expert War Room</div>
              <div className="flex items-center gap-1.5" style={{marginTop:2}}>
                {["ALGO","STRATEGY","PSYCH","INTEL"].map((l,i)=>(
                  <span key={i} className="font-mono" style={{
                    fontSize:7,letterSpacing:"0.1em",padding:"1px 5px",borderRadius:3,
                    background:`${["#60A5FA","#2ECC8A","#A78BFA","#F59E0B"][i]}15`,
                    border:`1px solid ${["#60A5FA","#2ECC8A","#A78BFA","#F59E0B"][i]}30`,
                    color:["#60A5FA","#2ECC8A","#A78BFA","#F59E0B"][i],
                    opacity: phase!=="idle" ? 1 : 0.35,
                    transition:"opacity 0.4s", transitionDelay:`${i*80}ms`,
                  }}>{l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Forecast selector */}
            <div className="flex items-center gap-1 rounded-lg p-1" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)"}}>
              {TIMEFRAME_OPTIONS.map(opt=>(
                <button key={opt.days} onClick={()=>setForecast(opt.days)}
                  className="font-mono font-bold rounded-md"
                  style={{
                    padding:"3px 7px",fontSize:9,cursor:"pointer",transition:"all 0.15s",
                    background:forecastDays===opt.days?"rgba(96,165,250,0.15)":"transparent",
                    border:`1px solid ${forecastDays===opt.days?"rgba(96,165,250,0.4)":"transparent"}`,
                    color:forecastDays===opt.days?"#60A5FA":"#5E5A57",
                    boxShadow:forecastDays===opt.days?"0 0 8px rgba(96,165,250,0.2)":"none",
                  }}>{opt.label}</button>
              ))}
            </div>

            {/* Action button — changes per state */}
            {phase==="idle" && (
              <button onClick={runWarRoom} className="flex items-center gap-1.5 font-semibold rounded-lg"
                style={{
                  height:32,padding:"0 14px",fontSize:11,cursor:"pointer",
                  background:"linear-gradient(135deg,rgba(255,77,106,0.18),rgba(245,158,11,0.10))",
                  border:"1px solid rgba(255,77,106,0.4)",color:"#E8E6E1",
                  boxShadow:"0 0 16px rgba(255,77,106,0.18),inset 0 1px 0 rgba(255,255,255,0.10)",
                  transition:"all 0.2s",
                }}
                onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 28px rgba(255,77,106,0.38),inset 0 1px 0 rgba(255,255,255,0.15)"}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 16px rgba(255,77,106,0.18),inset 0 1px 0 rgba(255,255,255,0.10)"}
              >
                <span style={{fontSize:12}}>⚡</span> Run Analysis
              </button>
            )}
            {(phase==="experts"||phase==="verdict") && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <span className="orbital-loader" style={{width:12,height:12,borderTopColor:phase==="verdict"?"#FF4D6A":"#60A5FA",borderWidth:1.5}} />
                <span className="font-mono" style={{fontSize:9,color:phase==="verdict"?"#FF4D6A":"#60A5FA",letterSpacing:"0.08em"}}>
                  {phase==="experts" ? "DELIBERATING" : "VERDICT"}
                </span>
              </div>
            )}
            {phase==="done" && (
              <button onClick={runWarRoom} className="font-mono rounded-md"
                style={{padding:"4px 10px",fontSize:9,color:"#5E5A57",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",cursor:"pointer",letterSpacing:"0.08em"}}
                onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color="#E8E6E1"}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color="#5E5A57"}
              >↻ RE-RUN</button>
            )}
          </div>
        </div>

        {/* ── INTELLIGENCE CHIPS (always visible once phase starts) ── */}
        {phase!=="idle" && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {/* Lifecycle */}
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{background:`${lifecycle.color}10`,border:`1px solid ${lifecycle.color}28`}}>
              <span style={{fontSize:10}}>{lifecycle.icon}</span>
              <div>
                <div className="font-mono" style={{fontSize:7,color:lifecycle.color,letterSpacing:"0.1em"}}>{lifecycle.stage}</div>
                <div className="font-mono" style={{fontSize:8,color:"#9E9C97"}}>Day {video.days}</div>
              </div>
            </div>
            {/* Virality Tier */}
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{background:`${viralTier.color}10`,border:`1px solid ${viralTier.color}28`,boxShadow:viralTier.level<=2?`0 0 10px ${viralTier.glow}`:"none"}}>
              <span style={{fontSize:11}}>{viralTier.icon}</span>
              <div>
                <div className="font-mono" style={{fontSize:7,color:viralTier.color,letterSpacing:"0.1em"}}>TIER {viralTier.level}</div>
                <div className="font-mono font-bold" style={{fontSize:8,color:"#E8E6E1"}}>{viralTier.tier}</div>
              </div>
            </div>
            {/* Content format */}
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{background:`${contentType.fitColor}08`,border:`1px solid ${contentType.fitColor}22`}}>
              <div style={{width:2,height:20,borderRadius:99,background:contentType.fitColor,flexShrink:0}} />
              <div>
                <div className="font-mono" style={{fontSize:7,color:contentType.fitColor,letterSpacing:"0.08em"}}>{contentType.format}</div>
                <div className="font-mono font-bold" style={{fontSize:8,color:"#E8E6E1"}}>{contentType.archetype} · {contentType.fit}%</div>
              </div>
            </div>
            {/* VRS tier */}
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{background:`${currentTier.color}08`,border:`1px solid ${currentTier.color}22`}}>
              <div>
                <div className="font-mono" style={{fontSize:7,color:currentTier.color,letterSpacing:"0.08em"}}>VRS NOW</div>
                <div className="font-mono font-bold" style={{fontSize:8,color:"#E8E6E1"}}>{video.vrs.estimatedFullScore} → {predicted.score} <span style={{color:predicted.delta>0?"#2ECC8A":predicted.delta<0?"#FF4D6A":"#6B6860"}}>{predicted.delta>0?"+":""}{predicted.delta}</span></div>
              </div>
            </div>
            {/* Forecast */}
            <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{background:"rgba(46,204,138,0.06)",border:"1px solid rgba(46,204,138,0.18)"}}>
              <div>
                <div className="font-mono" style={{fontSize:7,color:"#2ECC8A",letterSpacing:"0.08em"}}>{forecastDays}D PROJECTED</div>
                <div className="font-mono font-bold" style={{fontSize:8,color:"#E8E6E1"}}>{formatNumber(fTotal)} <span style={{color:"#5E5A57"}}>+{formatNumber(fAdd)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── EXPERT DELIBERATION ── 4 compact horizontal strips */}
        {Object.keys(opinions).length>0 && (
          <div className="space-y-2 mb-4">
            {EXPERTS.map(expert=>{
              const op       = opinions[expert.id];
              const isActive = activeExpert===expert.id && !op?.done;
              const isExp    = expanded===expert.id;
              const preview  = op?.words?.slice(0,20).join(" ") ?? "";

              const isSpeaking = activeExpert === expert.id && !op?.done;
              const isQueued   = !op?.done && !isSpeaking && speakOrder.indexOf(expert.id) === -1 && phase === "experts";
              const isCrossTalkFrom = crossTalk?.from === expert.id;
              const isCrossTalkTo   = crossTalk?.to   === expert.id;
              const borderColor = isSpeaking ? `${expert.color}55` : isCrossTalkTo ? `${expert.color}80` : op?.done && !op?.error ? `${expert.color}22` : "rgba(255,255,255,0.06)";
              return (
                <div key={expert.id}
                  style={{
                    background: isSpeaking ? `rgba(0,0,0,0.35)` : "rgba(0,0,0,0.22)",
                    border:`1px solid ${borderColor}`,
                    borderRadius:10,overflow:"hidden",
                    boxShadow: isSpeaking ? `0 0 22px ${expert.glow}` : isCrossTalkTo ? `0 0 10px ${expert.color}44` : "none",
                    opacity: isQueued ? 0.45 : 1,
                    transform: isCrossTalkTo ? "translateX(2px)" : "none",
                    transition:"border-color 0.2s,box-shadow 0.2s,opacity 0.3s,transform 0.15s",
                  }}
                >
                  {/* Speaking scan line */}
                  {isSpeaking && <div style={{height:1,background:`linear-gradient(90deg,transparent,${expert.color},transparent)`,backgroundSize:"200% 100%",animation:"cosmicShimmer 1.0s linear infinite"}} />}
                  {/* Cross-talk reaction pulse */}
                  {isCrossTalkTo && <div style={{height:1,background:`linear-gradient(90deg,transparent,${expert.color}88,transparent)`,backgroundSize:"200% 100%",animation:"cosmicShimmer 0.5s linear infinite"}} />}

                  {/* Header row — always visible, clickable to expand */}
                  <button
                    onClick={()=>op?.done ? setExpanded(isExp ? null : expert.id) : undefined}
                    className="w-full flex items-center gap-2.5"
                    style={{padding:"9px 12px",background:"transparent",border:"none",cursor:op?.done?"pointer":"default",textAlign:"left"}}
                  >
                    {/* Icon */}
                    <div style={{
                      width:28,height:28,borderRadius:7,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      background:`linear-gradient(135deg,${expert.color}20,${expert.color}08)`,
                      border:`1px solid ${expert.color}35`,fontSize:13,
                      boxShadow:isActive?`0 0 14px ${expert.color}70`:"none",
                      transition:"box-shadow 0.3s",
                    }}>{expert.icon}</div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{fontSize:11,fontWeight:700,color:"#E8E6E1"}}>{expert.name}</span>
                        <span className="font-mono" style={{fontSize:7,color:expert.color,opacity:0.65,letterSpacing:"0.08em"}}>{expert.role.toUpperCase()}</span>
                      </div>
                      {/* Preview text — 1 line when collapsed */}
                      {op?.done && !isExp && (
                        <div style={{fontSize:11,color:"#6B6860",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                          {preview}{preview.length > 0 ? "…" : ""}
                        </div>
                      )}
                      {isSpeaking && (
                        <div className="flex items-center gap-1.5" style={{marginTop:2}}>
                          <ThinkingDots color={expert.color} />
                          <span className="font-mono" style={{fontSize:8,color:expert.color,letterSpacing:"0.08em"}}>SPEAKING</span>
                        </div>
                      )
                      }
                      {!isSpeaking && !op?.done && phase==="experts" && speakOrder.indexOf(expert.id)===-1 && (
                        <div style={{fontSize:8,color:"#4A4845",marginTop:2,fontFamily:"var(--font-mono)",letterSpacing:"0.08em"}}>QUEUED…</div>
                      )
                      }
                      {isCrossTalkTo && (
                        <div className="flex items-center gap-1.5" style={{marginTop:2}}>
                          <span style={{fontSize:9,color:expert.color,animation:"glowPulse 0.4s ease-in-out infinite"}}>↩</span>
                          <span className="font-mono" style={{fontSize:8,color:expert.color,letterSpacing:"0.08em"}}>REACTING…</span>
                        </div>
                      )}
                    </div>

                    {/* Right state indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {op?.done && !op?.error && <CircuitNode color={expert.color} size={6} />}
                      {isSpeaking && !op?.done && <CircuitNode color={expert.color} size={5} />}
                      {op?.done && (
                        <span className="font-mono" style={{fontSize:9,color:isExp?"#E8E6E1":"#4A4845",transition:"color 0.15s"}}>
                          {isExp?"▲":"▼"}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded full analysis — collapsible */}
                  {op?.done && isExp && (
                    <div style={{padding:"0 12px 12px",borderTop:`1px solid ${expert.color}15`}}>
                      <p style={{fontSize:12,color:"#B8B6B1",lineHeight:1.72,paddingTop:10,margin:0}}>
                        {op.text}
                      </p>
                    </div>
                  )}

                  {/* Streaming text — visible while loading */}
                  {!op?.done && (op?.words??[]).length>0 && (
                    <div style={{padding:"0 12px 10px"}}>
                      <p style={{fontSize:11.5,color:"#9E9C97",lineHeight:1.65,margin:0}}>
                        {(op?.words??[]).join(" ")}
                        <span style={{display:"inline-block",width:7,height:12,verticalAlign:"middle",background:expert.color,marginLeft:2,opacity:0.8,animation:"glowPulse 0.7s ease-in-out infinite"}} />
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
            borderRadius:12,overflow:"hidden",
            border:`1px solid ${verdict.done?"rgba(255,255,255,0.12)":"rgba(255,77,106,0.35)"}`,
            background:"rgba(0,0,0,0.3)",
            boxShadow:verdict.done?"none":"0 0 28px rgba(255,77,106,0.10)",
            transition:"border-color 0.4s,box-shadow 0.4s",
          }}>
            {/* Top border */}
            {!verdict.done && <div style={{height:2,background:"linear-gradient(90deg,#FF4D6A,#F59E0B,#2ECC8A,#60A5FA,#FF4D6A)",backgroundSize:"300% 100%",animation:"cosmicShimmer 2s linear infinite"}} />}
            {verdict.done  && <div style={{height:2,background:"linear-gradient(90deg,transparent,#FF4D6A88,#F59E0B88,#2ECC8A88,transparent)"}} />}

            {/* Verdict header */}
            <div className="flex items-center gap-2.5" style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{
                width:28,height:28,borderRadius:7,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:"linear-gradient(135deg,rgba(255,77,106,0.2),rgba(245,158,11,0.12))",
                border:"1px solid rgba(255,77,106,0.3)",fontSize:13,
                boxShadow:verdict.loading?"0 0 16px rgba(255,77,106,0.4)":"0 0 6px rgba(255,77,106,0.15)",
                transition:"box-shadow 0.4s",
              }}>⚖</div>
              <div className="flex-1">
                <div style={{fontSize:11,fontWeight:700,color:"#E8E6E1"}}>Chief Intelligence Verdict</div>
                <div className="font-mono" style={{fontSize:7,color:"#5E5A57",letterSpacing:"0.1em"}}>
                  {forecastDays}D HORIZON · WHAT IS HAPPENING → WHAT WILL HAPPEN → WHAT TO DO
                </div>
              </div>
              {verdict.loading && <span className="orbital-loader" style={{width:14,height:14,borderTopColor:"#FF4D6A",borderWidth:1.5}} />}
              {verdict.done   && (
                <span className="font-mono font-bold" style={{fontSize:8,padding:"2px 8px",borderRadius:5,background:"rgba(46,204,138,0.12)",border:"1px solid rgba(46,204,138,0.28)",color:"#2ECC8A",letterSpacing:"0.1em"}}>
                  DELIVERED
                </span>
              )}
            </div>

            {/* Verdict body */}
            <div style={{padding:"14px 16px"}}>
              {/* Loading skeletons */}
              {verdict.loading && verdictWords.length===0 && (
                <div className="space-y-2">
                  {[90,78,95,72,85].map((w,i)=><div key={i} className="skeleton" style={{height:10,width:`${w}%`,animationDelay:`${i*0.08}s`}} />)}
                </div>
              )}

              {/* Streaming / done verdict in 3 labelled blocks */}
              {verdictWords.length>0 && (()=>{
                const paras = verdictWords.join(" ").split("\n\n").map(p=>p.trim()).filter(Boolean);
                const LABELS = [
                  { label:"HAPPENING NOW", color:"#60A5FA" },
                  { label:"WHAT'S NEXT",   color:"#F59E0B" },
                  { label:"YOUR MOVE",     color:"#2ECC8A" },
                ];
                return (
                  <div className="space-y-3">
                    {paras.map((para,i)=>{
                      const L = LABELS[i];
                      const isLast = i===paras.length-1;
                      return (
                        <div key={i} style={{
                          padding:"10px 12px",borderRadius:8,
                          background: L ? `${L.color}07` : "rgba(255,255,255,0.02)",
                          borderLeft:`2px solid ${L ? L.color : "rgba(255,255,255,0.12)"}`,
                        }}>
                          {L && <div className="font-mono font-bold mb-1.5" style={{fontSize:7,color:L.color,letterSpacing:"0.14em"}}>{L.label}</div>}
                          <p style={{fontSize:12.5,color:verdict.done?"#C8C6C1":"#B8B6B1",lineHeight:1.75,margin:0,fontWeight:i===0?500:400}}>
                            {para}
                            {!verdict.done&&isLast&&<span style={{display:"inline-block",width:8,height:13,verticalAlign:"middle",background:"#FF4D6A",marginLeft:3,opacity:0.85,animation:"glowPulse 0.7s ease-in-out infinite"}} />}
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

        {/* ── IDLE EMPTY STATE ── */}
        {phase==="idle" && (
          <div style={{padding:"24px 0 6px",textAlign:"center"}}>
            <div style={{
              width:48,height:48,borderRadius:14,margin:"0 auto 14px",
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"linear-gradient(135deg,rgba(255,77,106,0.08),rgba(96,165,250,0.05))",
              border:"1px solid rgba(255,255,255,0.07)",fontSize:22,
            }}>⚔</div>
            <p style={{fontSize:12,color:"#4A4845",lineHeight:1.7,margin:0}}>
              Select a forecast window · Click Run Analysis
            </p>
            <p className="font-mono" style={{fontSize:9,color:"#3A3835",letterSpacing:"0.06em",marginTop:4}}>
              4 EXPERTS · DELIBERATE IN PARALLEL · OPERATIONAL VERDICT
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
