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
  algorithm:    "You are an Algorithm Analyst. State what the platform algorithm is doing to this video RIGHT NOW based on the exact signals in the data. Use the numbers. Name the mechanism. Say what breaks it or accelerates it. 2 paragraphs. No hedging. No bullet points.",
  strategist:   "You are a Content Strategist. State whether the hook, title, and format are working or failing — and why the numbers prove it. Say what one change would move the needle most. 2 paragraphs. Disagree with algorithm-only thinking where the data justifies it. No bullet points.",
  psychologist: "You are an Audience Psychologist. State what emotional need this content is meeting and how the comment and engagement pattern confirms it. Say what the audience will do next as a result. 2 paragraphs. No bullet points.",
  competitor:   "You are a Competitive Intelligence Analyst. State where this video is winning and losing against comparable creators in this niche — use the pool data. Say what the channel is leaving on the table. 2 paragraphs. Be blunt. No bullet points.",
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
  const intervals                   = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(()=>()=>{ intervals.current.forEach(clearInterval); },[]);

  async function runWarRoom() {
    intervals.current.forEach(clearInterval); intervals.current = [];
    setRunning(true); setPhase("experts"); setOpinions({}); setVerdict(null); setVW([]);
    const secs = video.durationSeconds??0;
    updateSessionMemory(video, channel, secs<=60?"youtube_short":"youtube", "WAR_ROOM");
    const init: Record<string,ExpertOpinion> = {};
    EXPERTS.forEach(e=>{ init[e.id]={ persona:e.id, text:"", words:[], loading:true, done:false }; });
    setOpinions({...init});
    const results: Record<string,string> = {};
    await Promise.all(EXPERTS.map(async(expert)=>{
      setActive(expert.id);
      try {
        const prompt = buildDeepPrompt(video,channel,channelMedian,recentVideos,referenceStore,keywordBank,expert.id,forecastDays,{});
        const rawText = await callExpert(prompt, expert.id);
        const text = stripMd(rawText);
        results[expert.id] = text;
        const iv = streamWords(
          text,
          (w)=>setOpinions(p=>({...p,[expert.id]:{...p[expert.id],words:w,loading:false}})),
          ()=>setOpinions(p=>({...p,[expert.id]:{...p[expert.id],text,words:text.split(" "),loading:false,done:true}}))
        );
        intervals.current.push(iv);
      } catch(err) {
        const msg=err instanceof Error?err.message:"Analysis failed";
        setOpinions(p=>({...p,[expert.id]:{persona:expert.id,text:msg,words:msg.split(" "),loading:false,done:true,error:msg}}));
      }
    }));
    setPhase("verdict"); setActive("verdict");
    setVerdict({ persona:"verdict", text:"", words:[], loading:true, done:false });
    try {
      // Build verdict prompt — strip debate recap, focus on operational brief
      const verdictContext = Object.entries(results)
        .map(([persona, text]) => {
          // Take only first 200 chars of each expert — their core signal, not their full essay
          const signal = text.replace(/\n/g, " ").slice(0, 220).trim();
          return `[${persona.toUpperCase()} SIGNAL]: ${signal}…`;
        })
        .join("\n\n");

      const vp = buildDeepPrompt(video,channel,channelMedian,recentVideos,referenceStore,keywordBank,"verdict",forecastDays,{}) +
        `\n\n═══ EXPERT SIGNALS (summarised) ═══\n${verdictContext}\n\n` +
        `YOUR BRIEF: Ignore who said what. Write the 3-section operational brief as instructed. What is happening. What will happen next. What to do.`;

      const vtRaw = await callExpert(vp,"verdict");
      const vt = stripMd(vtRaw);
      const iv = streamWords(
        vt,
        (w)=>{ setVW([...w]); setVerdict(p=>p?{...p,words:w,loading:false}:p); },
        ()=>{ setVW(vt.split(" ")); setVerdict(p=>p?{...p,text:vt,words:vt.split(" "),loading:false,done:true}:p); setPhase("done"); setActive(null); }
      );
      intervals.current.push(iv);
    } catch {
      setVerdict({ persona:"verdict", text:"Verdict failed.", words:["Verdict","failed."], loading:false, done:true, error:"failed" });
      setPhase("done");
    }
    setRunning(false);
  }

  const decayRate = 0.95; let fv=video.views; let fvel=video.velocity;
  for(let d=0;d<forecastDays;d++){fvel*=decayRate;fv+=fvel;}
  const fTotal=Math.round(fv); const fAdd=Math.round(fv-video.views);

  return (
    <div className="glass-card" style={{ overflow:"hidden" }}>
      <div style={{ height:2, background:"linear-gradient(90deg,transparent,#60A5FA,#2ECC8A,#A78BFA,#F59E0B,transparent)", backgroundSize:"200% 100%", animation:"cosmicShimmer 4s linear infinite" }} />
      {/* Subtle grid overlay */}
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.015) 39px,rgba(255,255,255,0.015) 40px),repeating-linear-gradient(90deg,transparent,transparent 79px,rgba(255,255,255,0.015) 79px,rgba(255,255,255,0.015) 80px)",pointerEvents:"none",zIndex:0}} />
      <div style={{ padding:"20px 24px" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div style={{
                width:32,height:32,borderRadius:8,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
                background:"linear-gradient(135deg,rgba(255,77,106,0.2),rgba(245,158,11,0.12))",
                border:"1px solid rgba(255,77,106,0.35)",
                boxShadow:phase!=="idle"?"0 0 24px rgba(255,77,106,0.35)":"0 0 10px rgba(255,77,106,0.12)",
                transition:"box-shadow 0.4s",
              }}>⚔</div>
              <div>
                <h3 style={{fontSize:15,fontWeight:700,color:"#E8E6E1",letterSpacing:"-0.01em",lineHeight:1}}>Expert War Room</h3>
                <div className="font-mono flex items-center gap-1.5" style={{fontSize:8,color:"#5E5A57",letterSpacing:"0.1em",marginTop:2}}>
                  {["ALGORITHM","STRATEGY","PSYCHOLOGY","COMPETITION"].map((l,i)=>(
                    <span key={i} style={{color:["#60A5FA","#2ECC8A","#A78BFA","#F59E0B"][i],opacity:phase!=="idle"?1:0.4,transition:"opacity 0.3s",transitionDelay:`${i*0.1}s`}}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="font-mono" style={{fontSize:9,color:"#5E5A57",letterSpacing:"0.08em"}}>FORECAST</span>
              <div className="flex gap-1">
                {TIMEFRAME_OPTIONS.map(opt=>(
                  <button key={opt.days} onClick={()=>setForecast(opt.days)} className="font-mono font-semibold" style={{
                    padding:"3px 8px",borderRadius:5,fontSize:9,cursor:"pointer",transition:"all 0.15s",
                    background:forecastDays===opt.days?"rgba(96,165,250,0.15)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${forecastDays===opt.days?"rgba(96,165,250,0.4)":"rgba(255,255,255,0.08)"}`,
                    color:forecastDays===opt.days?"#60A5FA":"#5E5A57",
                    boxShadow:forecastDays===opt.days?"0 0 8px rgba(96,165,250,0.2)":"none",
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
            {phase==="idle"&&(
              <button onClick={runWarRoom} className="flex items-center gap-2 font-semibold rounded-xl" style={{
                height:38,padding:"0 18px",fontSize:12,cursor:"pointer",
                background:"linear-gradient(135deg,rgba(255,77,106,0.15),rgba(245,158,11,0.08))",
                border:"1px solid rgba(255,77,106,0.35)",color:"#E8E6E1",
                boxShadow:"0 0 20px rgba(255,77,106,0.15),inset 0 1px 0 rgba(255,255,255,0.10)",transition:"all 0.2s",
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 32px rgba(255,77,106,0.35),inset 0 1px 0 rgba(255,255,255,0.15)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 20px rgba(255,77,106,0.15),inset 0 1px 0 rgba(255,255,255,0.10)";}}
              ><span>⚡</span> Run Analysis</button>
            )}
            {(running||phase==="experts"||phase==="verdict")&&(
              <div className="flex items-center gap-2">
                <span className="orbital-loader" style={{borderTopColor:phase==="verdict"?"#FF4D6A":"#60A5FA"}} />
                <span className="font-mono" style={{fontSize:9,color:"#6B6860",letterSpacing:"0.08em"}}>
                  {phase==="experts"?"EXPERTS DELIBERATING…":"CHIEF VERDICT…"}
                </span>
              </div>
            )}
            {phase==="done"&&(
              <button onClick={runWarRoom} className="font-mono" style={{
                fontSize:9,color:"#5E5A57",background:"none",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:6,padding:"4px 10px",cursor:"pointer",letterSpacing:"0.08em"
              }}>↻ RE-RUN</button>
            )}
          </div>
        </div>

        {/* Forecast strip + VRS tiers */}
        {phase!=="idle"&&(()=>{
          const currentTier = getVRSTier(video.vrs.estimatedFullScore);
          const predicted   = getPredictedTier(video, forecastDays);
          return (
            <div className="space-y-2 mb-5">
              {/* Forecast numbers */}
              <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.08)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(96,165,250,0.3),transparent)"}} />
                <span className="font-mono" style={{fontSize:9,color:"#5E5A57",letterSpacing:"0.1em"}}>{forecastDays}D FORECAST</span>
                <div className="flex items-center gap-1.5">
                  <CircuitNode color="#2ECC8A" />
                  <span className="font-mono font-bold" style={{fontSize:14,color:"#2ECC8A",textShadow:"0 0 12px #2ECC8A88"}}>{formatNumber(fTotal)}</span>
                  <span className="font-mono" style={{fontSize:10,color:"#5E5A57"}}>projected total</span>
                </div>
                <div style={{width:1,height:16,background:"rgba(255,255,255,0.08)"}} />
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold" style={{fontSize:13,color:"#60A5FA",textShadow:"0 0 10px #60A5FA77"}}>+{formatNumber(fAdd)}</span>
                  <span className="font-mono" style={{fontSize:10,color:"#5E5A57"}}>additional views</span>
                </div>
                <div style={{width:1,height:16,background:"rgba(255,255,255,0.08)"}} />
                <span className="font-mono" style={{fontSize:9,color:video.days<3?"#F59E0B":video.days<7?"#60A5FA":"#2ECC8A"}}>
                  ◆ {video.days<3?"LOW CONFIDENCE":video.days<7?"MEDIUM CONFIDENCE":"HIGH CONFIDENCE"}
                </span>
              </div>
              {/* VRS Tier row */}
              <div className="flex items-stretch gap-2">
                {/* Current tier */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg" style={{background:"rgba(0,0,0,0.25)",border:`1px solid ${currentTier.color}30`,boxShadow:`0 0 20px ${currentTier.glow.replace("0.4","0.08")}`}}>
                  <div style={{width:2,alignSelf:"stretch",borderRadius:99,background:currentTier.color,boxShadow:`0 0 8px ${currentTier.color}`,flexShrink:0}} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono" style={{fontSize:8,color:"#5E5A57",letterSpacing:"0.12em",marginBottom:3}}>CURRENT VRS TIER</div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold" style={{fontSize:11,color:currentTier.color,textShadow:`0 0 10px ${currentTier.color}88`,letterSpacing:"0.08em"}}>{currentTier.label}</span>
                      <span className="font-mono font-bold" style={{fontSize:13,color:currentTier.color}}>{video.vrs.estimatedFullScore}/100</span>
                    </div>
                    <div className="font-mono" style={{fontSize:9,color:"#6B6860",lineHeight:1.5}}>{currentTier.desc}</div>
                  </div>
                </div>
                {/* Arrow */}
                <div className="flex items-center justify-center shrink-0" style={{color:predicted.delta>0?"#2ECC8A":predicted.delta<0?"#FF4D6A":"#5E5A57",fontSize:18}}>
                  {predicted.delta>0?"→":predicted.delta<0?"↘":"→"}
                </div>
                {/* Predicted tier */}
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg" style={{background:"rgba(0,0,0,0.25)",border:`1px solid ${predicted.tier.color}25`,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 0% 50%, ${predicted.tier.color}06, transparent 70%)`,pointerEvents:"none"}} />
                  <div style={{width:2,alignSelf:"stretch",borderRadius:99,background:`${predicted.tier.color}66`,flexShrink:0}} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono" style={{fontSize:8,color:"#5E5A57",letterSpacing:"0.12em",marginBottom:3}}>PREDICTED IN {forecastDays}D</div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold" style={{fontSize:11,color:predicted.tier.color,letterSpacing:"0.08em"}}>{predicted.tier.label}</span>
                      <span className="font-mono font-bold" style={{fontSize:13,color:predicted.tier.color}}>{predicted.score}/100</span>
                      {predicted.delta!==0&&<span className="font-mono" style={{fontSize:10,color:predicted.delta>0?"#2ECC8A":"#FF4D6A"}}>({predicted.delta>0?"+":""}{predicted.delta})</span>}
                    </div>
                    <div className="font-mono" style={{fontSize:9,color:"#6B6860",lineHeight:1.5}}>{predicted.tier.desc}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Expert cards */}
        {Object.keys(opinions).length>0&&(
          <div className="grid gap-3 mb-5" style={{gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))"}}>
            {EXPERTS.map(expert=>{
              const op=opinions[expert.id];
              const isActive=activeExpert===expert.id&&!op?.done;
              return (
                <div key={expert.id} style={{
                  position:"relative",
                  background:"rgba(0,0,0,0.3)",
                  border:`1px solid ${op?.done&&!op?.error?`${expert.color}28`:isActive?`${expert.color}55`:"rgba(255,255,255,0.07)"}`,
                  borderRadius:12,overflow:"hidden",transition:"border-color 0.3s,box-shadow 0.3s",
                  boxShadow:isActive?`0 0 28px ${expert.glow}`:"none",
                }}>
                  {isActive&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${expert.color},transparent)`,animation:"cosmicShimmer 1.5s linear infinite",backgroundSize:"200% 100%"}} />}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:`linear-gradient(135deg, ${expert.color}10, ${expert.color}04)`,borderBottom:`1px solid ${expert.color}22`,position:"relative"}}>
                    {/* Corner circuit decoration */}
                    <div style={{position:"absolute",top:6,right:6,width:20,height:20,opacity:0.3}}>
                      <div style={{position:"absolute",top:0,right:0,width:8,height:1,background:expert.color}} />
                      <div style={{position:"absolute",top:0,right:0,width:1,height:8,background:expert.color}} />
                      <div style={{position:"absolute",bottom:0,left:0,width:8,height:1,background:expert.color}} />
                      <div style={{position:"absolute",bottom:0,left:0,width:1,height:8,background:expert.color}} />
                    </div>
                    <div style={{
                      width:36,height:36,borderRadius:10,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      background:`linear-gradient(135deg, ${expert.color}22, ${expert.color}08)`,
                      border:`1px solid ${expert.color}40`,fontSize:15,color:expert.color,
                      boxShadow:isActive?`0 0 20px ${expert.color}80, inset 0 1px 0 rgba(255,255,255,0.15)`:`0 0 8px ${expert.color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                      transition:"box-shadow 0.3s",
                    }}>{expert.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div style={{fontSize:12,fontWeight:700,color:"#E8E6E1",letterSpacing:"-0.01em"}}>{expert.name}</div>
                      <div className="font-mono" style={{fontSize:8,color:expert.color,opacity:0.7,letterSpacing:"0.1em"}}>{expert.role.toUpperCase()}</div>
                    </div>
                    {op?.loading&&!op?.done&&<ThinkingDots color={expert.color} />}
                    {op?.done&&!op?.error&&<CircuitNode color={expert.color} size={7} />}
                  </div>
                  <div style={{padding:"5px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <span className="font-mono" style={{fontSize:8,color:"#5E5A57",fontStyle:"italic"}}>"{expert.stance}"</span>
                  </div>
                  <div style={{padding:"12px 14px",minHeight:80,position:"relative",overflow:"visible"}}>
                    {/* Floating keyword particles during streaming */}
                    {isActive&&!op?.done&&(EXPERT_KEYWORDS[expert.id]??[]).map((kw,ki)=>(
                      <FloatingKeyword key={ki+Date.now()} word={kw} color={expert.color} delay={ki*280+Math.random()*200} />
                    ))}
                    {op?.loading&&(op?.words??[]).length===0&&(
                      <div>
                        {/* Deliberating animation */}
                        <div className="flex items-center gap-2 mb-3">
                          <ThinkingDots color={expert.color} />
                          <span className="font-mono" style={{fontSize:9,color:expert.color,letterSpacing:"0.08em",animation:"glowPulse 2s infinite"}}>DELIBERATING…</span>
                        </div>
                        <div className="space-y-2">
                          {[85,95,72,88].map((w,i)=><div key={i} className="skeleton" style={{height:9,width:`${w}%`,animationDelay:`${i*0.15}s`}} />)}
                        </div>
                      </div>
                    )}
                    {(op?.words??[]).length>0&&(
                      <p style={{fontSize:12,color:op?.done?"#B8B6B1":"#D0CEC9",lineHeight:1.75}}>
                        {(op?.words??[]).join(" ")}
                        {!op?.done&&<span style={{display:"inline-block",width:8,height:13,verticalAlign:"middle",background:expert.color,marginLeft:2,opacity:0.8,animation:"glowPulse 0.7s ease-in-out infinite"}} />}
                      </p>
                    )}
                    {op?.error&&!(op?.words??[]).length&&<p style={{fontSize:11,color:"#FF4D6A"}}>⚠ {op.error}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chief Verdict */}
        {verdict&&(
          <div style={{
            background:"rgba(0,0,0,0.35)",
            border:`1px solid ${verdict.done?"rgba(255,255,255,0.14)":"rgba(255,77,106,0.4)"}`,
            borderRadius:14,overflow:"hidden",
            boxShadow:verdict.done?"none":"0 0 36px rgba(255,77,106,0.12)",
            transition:"border-color 0.4s,box-shadow 0.4s",
          }}>
            {!verdict.done&&<div style={{height:2,background:"linear-gradient(90deg,#FF4D6A,#F59E0B,#2ECC8A,#60A5FA,#FF4D6A)",backgroundSize:"300% 100%",animation:"cosmicShimmer 2s linear infinite"}} />}
            {verdict.done&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#FF4D6A,#F59E0B,#2ECC8A,transparent)"}} />}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",background:"linear-gradient(135deg,rgba(255,77,106,0.06),rgba(245,158,11,0.04),rgba(46,204,138,0.03))",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{width:36,height:36,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,rgba(255,77,106,0.2),rgba(245,158,11,0.15))",border:"1px solid rgba(255,77,106,0.3)",fontSize:18,boxShadow:verdict.loading?"0 0 22px rgba(255,77,106,0.4)":"0 0 10px rgba(255,77,106,0.15)",transition:"box-shadow 0.4s"}}>⚖</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#E8E6E1"}}>Chief Intelligence Verdict</div>
                <div className="font-mono" style={{fontSize:8,color:"#5E5A57",letterSpacing:"0.1em"}}>OPERATIONAL BRIEF · {forecastDays}D HORIZON · WHAT IS HAPPENING → WHAT WILL HAPPEN → WHAT TO DO</div>
              </div>
              {verdict.loading&&<div className="ml-auto flex items-center gap-2"><span className="orbital-loader" style={{borderTopColor:"#FF4D6A"}} /><ThinkingDots color="#FF4D6A" /></div>}
              {verdict.done&&<span className="ml-auto font-mono font-bold" style={{fontSize:9,letterSpacing:"0.1em",padding:"3px 9px",borderRadius:6,background:"rgba(46,204,138,0.12)",border:"1px solid rgba(46,204,138,0.3)",color:"#2ECC8A",boxShadow:"0 0 8px rgba(46,204,138,0.2)"}}>DELIVERED</span>}
            </div>
            <div style={{padding:"20px 22px"}}>
              {verdict.loading&&verdictWords.length===0&&(
                <div className="space-y-3">
                  {[92,85,96,78,88].map((w,i)=><div key={i} className="skeleton" style={{height:11,width:`${w}%`,animationDelay:`${i*0.1}s`}} />)}
                </div>
              )}
              {verdictWords.length>0&&(()=>{
                const fullText = verdictWords.join(" ");
                const paras = fullText.split("\n\n").map(p=>p.trim()).filter(Boolean);
                const SECTION_LABELS = [
                  { label: "WHAT IS HAPPENING", color: "#60A5FA" },
                  { label: "WHAT WILL HAPPEN NEXT", color: "#F59E0B" },
                  { label: "WHAT TO DO", color: "#2ECC8A" },
                ];
                return (
                  <div className="space-y-4">
                    {paras.map((para, i) => {
                      const section = SECTION_LABELS[i];
                      const isLast = i === paras.length - 1;
                      return (
                        <div key={i} style={{
                          position: "relative",
                          padding: "14px 16px",
                          borderRadius: 10,
                          background: section ? `${section.color}06` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${section ? section.color + "20" : "rgba(255,255,255,0.06)"}`,
                          borderLeft: `3px solid ${section ? section.color : "rgba(255,255,255,0.15)"}`,
                        }}>
                          {section && (
                            <div className="font-mono font-bold mb-2" style={{
                              fontSize: 8, letterSpacing: "0.14em",
                              color: section.color,
                            }}>
                              {section.label}
                            </div>
                          )}
                          <p style={{
                            fontSize: 13.5,
                            color: verdict.done ? "#D8D6D1" : "#D0CEC9",
                            lineHeight: 1.82,
                            fontWeight: i === 0 ? 500 : 400,
                            transition: "color 0.3s",
                            margin: 0,
                          }}>
                            {para}
                            {!verdict.done && isLast && (
                              <span style={{
                                display: "inline-block", width: 10, height: 15,
                                verticalAlign: "middle", background: "#FF4D6A",
                                marginLeft: 3, opacity: 0.85,
                                animation: "glowPulse 0.7s ease-in-out infinite",
                              }} />
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

        {/* Empty state */}
        {phase==="idle"&&(
          <div style={{textAlign:"center",padding:"28px 0 8px"}}>
            <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>⚔</div>
            <p className="font-mono" style={{fontSize:11,color:"#5E5A57",lineHeight:1.8}}>
              Select a forecast window, then run the War Room.<br/>
              4 experts deliberate in parallel, contradict each other,<br/>
              then deliver a verdict rooted in your data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
