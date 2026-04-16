"use client";

import { useState } from "react";
import { puterAIChat } from "@/lib/puter-ai";
import type { EnrichedVideo, ChannelData, ReferenceStore, KeywordBank } from "@/lib/types";

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
  loading: boolean;
  done: boolean;
  error?: string;
}

const EXPERTS = [
  {
    id: "algorithm",
    name: "Algorithm Analyst",
    role: "Distribution & Signal Intelligence",
    icon: "⚡",
    color: "#60A5FA",
    stance: "Platform signals drive everything",
  },
  {
    id: "strategist",
    name: "Content Strategist",
    role: "Format, Hook & Title Engineering",
    icon: "◆",
    color: "#2ECC8A",
    stance: "Content quality determines ceiling",
  },
  {
    id: "psychologist",
    name: "Audience Psychologist",
    role: "Comment & Behaviour Analysis",
    icon: "◎",
    color: "#A78BFA",
    stance: "Human motivation is the real driver",
  },
  {
    id: "competitor",
    name: "Competitive Intelligence",
    role: "Niche & Benchmark Analysis",
    icon: "🎯",
    color: "#F59E0B",
    stance: "Relative performance vs niche",
  },
];

const PERSONA_PROMPTS: Record<string, string> = {
  algorithm:   "You are an Algorithm Analyst. ONLY care about platform distribution signals: VRS, velocity, retention, algorithmic amplification. Be opinionated and specific. 2 paragraphs.",
  strategist:  "You are a Content Strategist focused on format, hook quality, title, thumbnail. Often DISAGREE with algorithm analysts. Believe content quality drives everything. 2 paragraphs.",
  psychologist:"You are an Audience Psychologist reading comment patterns and engagement ratios. Contradict algorithmic and content-first analysts. Focus on human motivation. 2 paragraphs.",
  competitor:  "You are a Competitive Intelligence Analyst benchmarking against competing channels. Be brutal about where this content loses ground. Data-driven and comparative. 2 paragraphs.",
  verdict:     "You are a Chief Intelligence Officer synthesising 4 expert analyses. Acknowledge the strongest disagreement, resolve it, give a decisive recommendation. 3 paragraphs.",
};

async function callExpert(prompt: string, persona: string): Promise<string> {
  // Try server route first
  try {
    const res = await fetch("/api/claude-verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, persona }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.text && data.text.length > 10) return data.text;
  } catch { /* fall through */ }

  // Puter.js fallback — free, no API key
  const systemPrompt = PERSONA_PROMPTS[persona] ?? PERSONA_PROMPTS.algorithm;
  return await puterAIChat(prompt, systemPrompt);
}

function buildPrompt(
  video: EnrichedVideo,
  channel: ChannelData | null,
  channelMedian: number,
  recentVideos: EnrichedVideo[],
  referenceStore: ReferenceStore | null | undefined,
  keywordBank: KeywordBank | null | undefined,
  persona: string,
  otherOpinions: Record<string, string>
): string {
  const secs = video.durationSeconds ?? 0;
  const format = secs <= 60 ? "Short-form (≤60s)" : secs <= 600 ? "Mid-form (1–10 min)" : `Long-form (${Math.round(secs / 60)} min)`;
  const likeRate = video.views > 0 ? ((video.likes / video.views) * 100).toFixed(2) : "0";
  const commentRate = video.views > 0 ? ((video.comments / video.views) * 1000).toFixed(2) : "0";

  const poolEntries = referenceStore?.entries ?? [];
  const poolMedian = poolEntries.length > 2
    ? [...poolEntries].sort((a,b)=>(a.metrics?.views??0)-(b.metrics?.views??0))[Math.floor(poolEntries.length/2)]?.metrics?.views ?? 0
    : 0;

  const base = `VIDEO DATA:
Title: "${video.title}"
Channel: ${video.channel} | ${channel?.subs ? `${channel.subs >= 1000000 ? (channel.subs/1000000).toFixed(1).replace(/\.0$/,"")+"M" : (channel.subs/1000).toFixed(0)+"K"} subscribers` : "unknown subs"}
Format: ${format} | Views: ${video.views.toLocaleString()} in ${video.days} days
Velocity: ${video.velocity.toLocaleString()} views/day | VRS Score: ${video.vrs.estimatedFullScore}/100
vs Channel Median: ${video.vsBaseline}x (median: ${channelMedian.toLocaleString()})
Engagement: ${likeRate}% like rate | ${commentRate} comments/1K views | ${video.comments.toLocaleString()} total comments
${poolMedian > 0 ? `Pool comparison: ${Math.round(((video.views - poolMedian) / poolMedian) * 100)}% vs pool median (${poolEntries.length} videos tracked)` : ""}
Recent channel videos (views): ${recentVideos.slice(0,5).map(v => v.views.toLocaleString()).join(", ")}`;

  const debateContext = Object.entries(otherOpinions).length > 0
    ? `\n\nOTHER ANALYSTS HAVE SAID:\n${Object.entries(otherOpinions).map(([p, t]) => `[${p.toUpperCase()}]: ${t.slice(0,300)}...`).join("\n\n")}\n\nNow give YOUR analysis from your specific perspective. Disagree with others where your expertise leads you to a different conclusion.`
    : "\nGive your expert analysis from your specific perspective.";

  return base + debateContext;
}

export default function ExpertWarRoomPanel({
  video, channel, channelMedian, recentVideos, referenceStore, keywordBank
}: ExpertWarRoomProps) {
  const [opinions, setOpinions] = useState<Record<string, ExpertOpinion>>({});
  const [verdict, setVerdict] = useState<ExpertOpinion | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "experts" | "verdict" | "done">("idle");

  async function runWarRoom() {
    setRunning(true);
    setPhase("experts");
    setOpinions({});
    setVerdict(null);

    // Init all as loading
    const init: Record<string, ExpertOpinion> = {};
    EXPERTS.forEach(e => { init[e.id] = { persona: e.id, text: "", loading: true, done: false }; });
    setOpinions({ ...init });

    // Run all 4 experts in parallel
    const results: Record<string, string> = {};
    await Promise.all(
      EXPERTS.map(async (expert) => {
        try {
          const prompt = buildPrompt(video, channel, channelMedian, recentVideos, referenceStore, keywordBank, expert.id, {});
          const text = await callExpert(prompt, expert.id);
          results[expert.id] = text;
          setOpinions(prev => ({
            ...prev,
            [expert.id]: { persona: expert.id, text, loading: false, done: true },
          }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Failed";
          setOpinions(prev => ({
            ...prev,
            [expert.id]: { persona: expert.id, text: "", loading: false, done: true, error: errMsg },
          }));
        }
      })
    );

    // Now generate the final verdict using all 4 opinions
    setPhase("verdict");
    setVerdict({ persona: "verdict", text: "", loading: true, done: false });

    try {
      const verdictPrompt = buildPrompt(video, channel, channelMedian, recentVideos, referenceStore, keywordBank, "verdict", results)
        + "\n\nBased on all 4 expert analyses above, deliver the final verdict. Explicitly name the KEY disagreement between experts and resolve it. Be decisive.";
      const verdictText = await callExpert(verdictPrompt, "verdict");
      setVerdict({ persona: "verdict", text: verdictText, loading: false, done: true });
    } catch (err) {
      setVerdict({ persona: "verdict", text: "", loading: false, done: true, error: err instanceof Error ? err.message : "Failed" });
    }

    setPhase("done");
    setRunning(false);
  }

  const allExpertsDone = EXPERTS.every(e => opinions[e.id]?.done);

  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      {/* Top accent bar */}
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #FF4D6A, #F59E0B, #2ECC8A, #60A5FA, transparent)" }} />

      <div style={{ padding: "20px 24px" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 16 }}>⚔</span>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#E8E6E1", letterSpacing: "-0.01em" }}>
                Expert War Room
              </h3>
            </div>
            <p className="font-mono" style={{ fontSize: 10, color: "#5E5A57", letterSpacing: "0.06em" }}>
              4 INDUSTRY EXPERTS · DELIBERATE · CONTRADICT · VERDICT
            </p>
          </div>

          {phase === "idle" && (
            <button
              onClick={runWarRoom}
              className="flex items-center gap-2 font-semibold rounded-xl"
              style={{
                height: 42, padding: "0 20px", fontSize: 13,
                background: "linear-gradient(135deg, #1D3461, #FF4D6A22)",
                border: "1px solid rgba(255,77,106,0.35)",
                color: "#E8E6E1", cursor: "pointer",
                boxShadow: "0 0 20px rgba(255,77,106,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 32px rgba(255,77,106,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(255,77,106,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
            >
              <span>⚡</span> Run Analysis
            </button>
          )}

          {running && (
            <div className="flex items-center gap-2">
              <span className="orbital-loader" />
              <span className="font-mono" style={{ fontSize: 10, color: "#6B6860" }}>
                {phase === "experts" ? `Consulting experts…` : "Generating verdict…"}
              </span>
            </div>
          )}

          {phase === "done" && (
            <button
              onClick={runWarRoom}
              className="font-mono"
              style={{ fontSize: 9, color: "#5E5A57", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.08em" }}
            >
              ↻ RE-RUN
            </button>
          )}
        </div>

        {/* ── Expert cards ── */}
        {Object.keys(opinions).length > 0 && (
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {EXPERTS.map(expert => {
              const op = opinions[expert.id];
              return (
                <div
                  key={expert.id}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${op?.done && !op?.error ? `${expert.color}28` : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 10, overflow: "hidden",
                    transition: "border-color 0.3s",
                  }}
                >
                  {/* Expert header */}
                  <div
                    className="flex items-center gap-2.5"
                    style={{
                      padding: "10px 14px",
                      background: `${expert.color}08`,
                      borderBottom: `1px solid ${expert.color}15`,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${expert.color}18`, border: `1px solid ${expert.color}35`,
                      fontSize: 12, color: expert.color,
                      boxShadow: `0 0 8px ${expert.color}30`,
                    }}>
                      {expert.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E6E1" }}>{expert.name}</div>
                      <div className="font-mono" style={{ fontSize: 8, color: "#5E5A57", letterSpacing: "0.08em" }}>{expert.role}</div>
                    </div>
                    {op?.loading && <span className="orbital-loader" style={{ width: 14, height: 14, borderTopColor: expert.color }} />}
                    {op?.done && !op?.error && (
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: expert.color, boxShadow: `0 0 6px ${expert.color}`, display: "inline-block" }} />
                    )}
                  </div>

                  {/* Expert stance label */}
                  <div style={{ padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="font-mono" style={{ fontSize: 8, color: "#5E5A57", letterSpacing: "0.08em", fontStyle: "italic" }}>
                      "{expert.stance}"
                    </span>
                  </div>

                  {/* Opinion content */}
                  <div style={{ padding: "12px 14px", minHeight: 80 }}>
                    {op?.loading && (
                      <div className="space-y-2">
                        {[80, 95, 70].map((w, i) => (
                          <div key={i} className="skeleton" style={{ height: 10, width: `${w}%` }} />
                        ))}
                      </div>
                    )}
                    {op?.error && (
                      <p style={{ fontSize: 11, color: "#FF4D6A", lineHeight: 1.5 }}>⚠ {op.error}</p>
                    )}
                    {op?.done && !op?.error && op?.text && (
                      <p style={{ fontSize: 12, color: "#B8B6B1", lineHeight: 1.7 }}>{op.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Final Verdict ── */}
        {verdict && (
          <div style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, overflow: "hidden",
          }}>
            {/* Verdict header */}
            <div
              className="flex items-center gap-3"
              style={{
                padding: "14px 20px",
                background: "linear-gradient(135deg, rgba(255,77,106,0.08), rgba(245,158,11,0.05), rgba(46,204,138,0.04))",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, rgba(255,77,106,0.2), rgba(245,158,11,0.15))",
                border: "1px solid rgba(255,77,106,0.3)",
                fontSize: 16,
                boxShadow: "0 0 14px rgba(255,77,106,0.2)",
              }}>
                ⚖
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E6E1" }}>Chief Intelligence Verdict</div>
                <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.08em" }}>FINAL DELIBERATION · EXPERT SYNTHESIS</div>
              </div>
              {verdict.loading && <span className="orbital-loader ml-auto" style={{ borderTopColor: "#FF4D6A" }} />}
              {verdict.done && !verdict.error && (
                <span className="ml-auto font-mono font-bold" style={{ fontSize: 9, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 6, background: "rgba(46,204,138,0.12)", border: "1px solid rgba(46,204,138,0.3)", color: "#2ECC8A" }}>
                  DELIVERED
                </span>
              )}
            </div>

            <div style={{ padding: "18px 20px" }}>
              {verdict.loading && (
                <div className="space-y-3">
                  {[95, 88, 92, 75].map((w, i) => (
                    <div key={i} className="skeleton" style={{ height: 12, width: `${w}%` }} />
                  ))}
                </div>
              )}
              {verdict.error && (
                <p style={{ fontSize: 12, color: "#FF4D6A" }}>⚠ {verdict.error}</p>
              )}
              {verdict.done && !verdict.error && verdict.text && (
                <div>
                  {verdict.text.split("\n\n").map((para, i, arr) => (
                    <p key={i} style={{ fontSize: 13.5, color: "#D8D6D1", lineHeight: 1.8, marginBottom: i < arr.length - 1 ? 16 : 0, fontWeight: i === 0 ? 500 : 400 }}>
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {phase === "idle" && (
          <div style={{ textAlign: "center", padding: "20px 0 4px" }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>⚔</div>
            <p className="font-mono" style={{ fontSize: 11, color: "#5E5A57", lineHeight: 1.7 }}>
              Four expert personas will analyse this video from competing angles,<br/>
              deliberately contradict each other, then deliver a final verdict.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
