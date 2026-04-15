"use client";

import { useState, useEffect } from "react";
import type { EnrichedVideo, ChannelData, ReferenceStore, KeywordBank } from "@/lib/types";

interface VerdictProps {
  video: EnrichedVideo;
  channel: ChannelData | null;
  channelMedian: number;
  recentVideos: EnrichedVideo[];
  referenceStore?: ReferenceStore | null;
  keywordBank?: KeywordBank | null;
}

// ── Virality phase engine ──────────────────────────────────────────────────
function detectPhase(video: EnrichedVideo, channelMedian: number) {
  const { days, velocity, vsBaseline, vrs } = video;
  const vrsScore = vrs.estimatedFullScore;

  // Velocity relative to channel average
  const isAccelerating = velocity > 0;

  if (vsBaseline >= 5 || (vrsScore >= 82 && vsBaseline >= 3.5)) {
    return {
      phase: "viral" as const,
      label: "VIRAL PHASE",
      color: "#FF4D6A",
      glow: "rgba(255,77,106,0.35)",
      icon: "🔥",
      description: "Content has broken past the algorithm ceiling and is being distributed beyond the subscriber base. Platform is actively pushing this into non-subscriber feeds.",
    };
  }
  if (days >= 5 && vsBaseline >= 2.5 && vrsScore >= 65) {
    return {
      phase: "expansion" as const,
      label: "EXPANSION PHASE",
      color: "#F59E0B",
      glow: "rgba(245,158,11,0.30)",
      icon: "⚡",
      description: "Content has cleared the algorithm's quality threshold and is entering broader distribution. Velocity is sustained beyond the initial subscriber push.",
    };
  }
  if (days >= 2 && vsBaseline >= 1.5 && (velocity > channelMedian / 30 || vrsScore >= 60)) {
    return {
      phase: "resonance" as const,
      label: "RESONANCE PHASE",
      color: "#60A5FA",
      glow: "rgba(96,165,250,0.28)",
      icon: "◈",
      description: "Early signals confirm audience connection. The algorithm is testing broader distribution. Engagement quality is above baseline — the content is resonating.",
    };
  }
  return {
    phase: "seed" as const,
    label: "SEED PHASE",
    color: "#A78BFA",
    glow: "rgba(167,139,250,0.25)",
    icon: "◆",
    description: days <= 2
      ? "Content is in its initial 48-hour test window. The algorithm is sampling it to gauge early engagement quality before making distribution decisions."
      : "Content is in early distribution. Velocity and engagement signals are being established relative to the channel baseline.",
  };
}

// ── Content format ──────────────────────────────────────────────────────────
function getFormat(video: EnrichedVideo) {
  const secs = video.durationSeconds ?? 0;
  if (secs === 0) return { label: "Unknown Format", short: false };
  if (secs <= 60)  return { label: "Short-form (≤60s)", short: true };
  if (secs <= 600) return { label: "Mid-form (1–10 min)", short: false };
  return { label: `Long-form (${Math.round(secs / 60)} min)`, short: false };
}

// ── Niche detection ─────────────────────────────────────────────────────────
function detectNiche(video: EnrichedVideo, kb: KeywordBank | null | undefined): string {
  if (!kb) return "General";
  const text = (video.title + " " + (video.tags ?? []).join(" ")).toLowerCase();
  const catMap: Record<string, string[]> = {
    "Trading / Finance":    ["trading", "forex", "stocks", "crypto", "bitcoin", "funded", "prop", "scalping", "ichimoku", "nfp", "earnings"],
    "Marketing / Growth":  ["marketing", "ads", "funnel", "leads", "agency", "seo", "content", "virality", "ugc"],
    "AI / Tech":           ["ai", "claude", "chatgpt", "llm", "automation", "coding", "python", "saas"],
    "Fitness / Health":    ["workout", "gym", "fitness", "diet", "nutrition", "weight"],
    "Gaming":              ["gaming", "gameplay", "fortnite", "minecraft", "roblox", "fps"],
    "Entertainment":       ["prank", "challenge", "vlog", "reaction", "story"],
  };
  for (const [niche, kws] of Object.entries(catMap)) {
    if (kws.some(kw => text.includes(kw))) return niche;
  }
  const nicheKws = kb.categories.niche ?? [];
  const matchedKw = nicheKws.find(kw => text.includes(kw.toLowerCase()));
  return matchedKw ? `${matchedKw} content` : "General";
}

// ── Pool comparison ─────────────────────────────────────────────────────────
function poolComparison(video: EnrichedVideo, store: ReferenceStore | null | undefined) {
  if (!store || store.entries.length < 3) return null;
  const same = store.entries.filter(e => e.platform === "youtube" || !e.platform);
  if (same.length < 2) return null;
  const poolMedian = same.slice().sort((a,b)=>(a.metrics?.views??0)-(b.metrics?.views??0))[Math.floor(same.length/2)]?.metrics?.views ?? 0;
  if (poolMedian === 0) return null;
  const pct = Math.round(((video.views - poolMedian) / poolMedian) * 100);
  return { pct, poolMedian, poolSize: same.length };
}

export default function ViralityVerdictPanel({ video, channel, channelMedian, recentVideos, referenceStore, keywordBank }: VerdictProps) {
  const phase  = detectPhase(video, channelMedian);
  const format = getFormat(video);
  const niche  = detectNiche(video, keywordBank);
  const pool   = poolComparison(video, referenceStore);

  const [aiVerdict, setAiVerdict]   = useState<string>("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiTriggered, setAiTriggered] = useState(false);

  // Channel stats
  const chMedianViews  = channelMedian;
  const perfVsChannel  = chMedianViews > 0 ? Math.round(((video.views - chMedianViews) / chMedianViews) * 100) : 0;
  const velocityRank   = recentVideos.length > 1
    ? recentVideos.filter(v => v.velocity > video.velocity).length
    : 0;
  const velocityPct    = recentVideos.length > 1
    ? Math.round((1 - velocityRank / recentVideos.length) * 100)
    : 0;

  // Comment signal
  const commentRate    = video.views > 0 ? ((video.comments / video.views) * 1000).toFixed(2) : "0";
  const likeRate       = video.views > 0 ? ((video.likes / video.views) * 100).toFixed(2) : "0";
  const commentStrength = parseFloat(commentRate) >= 2 ? "HIGH — audience is actively discussing" : parseFloat(commentRate) >= 0.8 ? "MODERATE — healthy community signal" : "LOW — passive audience or controversy-driven views";

  // Title signals
  const title = video.title;
  const titleLen = title.length;
  const hasPowerWord = /FREE|SECRET|BANNED|NEVER|PROOF|REAL|HIDDEN|EXPOSED|VIRAL|SHOCKING|EARN|MAKE|HOW|WHY|WHAT|BEST|WORST|\$[0-9]|[0-9]+[KM]/i.test(title);
  const hasNumber    = /\d/.test(title);
  const hasQuestion  = title.includes("?");
  const titleScore   = (hasPowerWord ? 30 : 0) + (hasNumber ? 20 : 0) + (hasQuestion ? 15 : 0) + (titleLen >= 40 && titleLen <= 70 ? 20 : titleLen < 40 ? 10 : 5) + (format.short ? 15 : 0);

  function buildComputedVerdict(): string {
    const phaseContext = phase.phase === "viral"
      ? `This video is in full viral distribution. At ${video.vsBaseline}x the channel median and ${video.velocity.toLocaleString()} views/day, the platform algorithm has moved it beyond the subscriber audience and is actively serving it to cold traffic. This is confirmed by the ${likeRate}% like rate against ${video.views.toLocaleString()} views — the ratio holds even with non-subscriber traffic, which is the clearest viral signal.`
      : phase.phase === "expansion"
      ? `This video has cleared the algorithm's initial quality threshold and entered expansion distribution. At ${video.vsBaseline}x the channel median (${chMedianViews.toLocaleString()} views), it's performing well above the creator's baseline. The ${video.velocity.toLocaleString()} views/day velocity on day ${video.days} indicates sustained algorithmic push rather than a spike-and-decay pattern.`
      : phase.phase === "resonance"
      ? `This video is in the resonance phase — the algorithm has detected early quality signals and is beginning to expand distribution. The ${video.vsBaseline}x performance vs channel median (${chMedianViews.toLocaleString()} views) at ${video.days} days old suggests the initial subscriber audience responded well, giving the algorithm confidence to test it on broader audiences.`
      : `This video is in its seed phase. ${video.days <= 2 ? "At under 48 hours old, the algorithm is still sampling engagement quality before making distribution decisions. The first 48 hours set the ceiling." : `At day ${video.days}, early performance signals are being established. The ${video.velocity.toLocaleString()} views/day velocity relative to the channel median will determine whether it enters wider distribution.`}`;

    const compareContext = pool
      ? `Against your ${pool.poolSize}-video reference pool, this sits ${pool.pct > 0 ? `${pool.pct}% above` : `${Math.abs(pool.pct)}% below`} the pool median of ${pool.poolMedian.toLocaleString()} views. ${pool.pct > 50 ? "That's a top-tier result for this niche." : pool.pct > 0 ? "It's beating pool median, which is a solid benchmark." : "It's underperforming the pool benchmark — worth investigating what separates the top pool performers."}`
      : `The channel median is ${chMedianViews.toLocaleString()} views. This video is performing at ${video.vsBaseline}x that — ${perfVsChannel > 0 ? `${perfVsChannel}% above` : `${Math.abs(perfVsChannel)}% below`} the creator's own baseline. ${video.vsBaseline >= 3 ? "That margin is significant and suggests a format or topic hit." : video.vsBaseline >= 1.5 ? "That's above average for the channel." : "There's room to improve — look at top performers in the same niche for format cues."}`;

    const commentContext = parseFloat(commentRate) >= 2
      ? `The ${commentRate} comments per 1,000 views is a strong signal — this rate drives algorithmic retargeting loops, especially on YouTube where comment activity is weighted as a distribution signal. The audience isn't just watching; they're invested enough to respond.`
      : parseFloat(commentRate) >= 0.8
      ? `The ${commentRate} comments per 1,000 views shows the audience is engaged. For ${format.label.toLowerCase()} content, this is a healthy signal. Adding a direct question or opinion prompt in the CTA could push this into the higher engagement tier.`
      : `Comment rate is low at ${commentRate} per 1,000 views. For ${niche} content, driving more comments would improve retargeting signals. The most effective approach is posing a specific question that's easy to answer quickly.`;

    return [phaseContext, compareContext, commentContext].join("\n\n");
  }

  async function generateAIVerdict() {
    setAiLoading(true);
    setAiTriggered(true);
    try {
      const prompt = `Video: "${video.title}"
Channel: ${video.channel} (${channel?.subs ? `${(channel.subs/1000).toFixed(0)}K subs` : "unknown subs"}, ${recentVideos.length} recent videos, channel median ${chMedianViews.toLocaleString()} views)
Platform: YouTube | Format: ${format.label} | Niche: ${niche}
Performance: ${video.views.toLocaleString()} views in ${video.days} days → ${video.velocity.toLocaleString()} views/day velocity
vs Channel Median: ${video.vsBaseline}x (${perfVsChannel > 0 ? "+" : ""}${perfVsChannel}%)
Engagement: ${likeRate}% like rate, ${commentRate} comments per 1000 views
VRS Score: ${video.vrs.estimatedFullScore}/100 | Phase: ${phase.label}
${pool ? `Pool comparison: ${pool.pct > 0 ? "+" : ""}${pool.pct}% vs pool median of ${pool.poolMedian.toLocaleString()} views (${pool.poolSize} tracked videos)` : ""}
${channel ? `Channel trend: ${recentVideos.slice(0,3).map(v => v.views.toLocaleString()).join(" → ")} (recent 3 videos)` : ""}
Comment signal: ${commentStrength}

Write a plain-English performance verdict. 3 paragraphs max. Cover: (1) what the phase means for this specific video and why it's performing this way, (2) how it stacks up against the creator's catalogue and competing channels in this niche, (3) what the comment rate and engagement pattern tells you about the audience relationship and what it means for future growth.`;

      const res = await fetch("/api/claude-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setAiVerdict(data.text || "Unable to generate verdict.");
    } catch {
      setAiVerdict("Analysis unavailable. Check ANTHROPIC_API_KEY is set in Vercel environment variables.");
    }
    setAiLoading(false);
  }

  return (
    <div className="glass-card" style={{ overflow: "hidden", marginBottom: 4 }}>
      {/* ── Accent top bar coloured by phase ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${phase.color}, ${phase.color}88, transparent)` }} />

      <div style={{ padding: "20px 24px" }}>

        {/* ── Row 1: Phase badge + format + niche ── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Phase badge — most prominent */}
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10,
                background: `${phase.color}15`,
                border: `1px solid ${phase.color}40`,
                boxShadow: `0 0 20px ${phase.glow}, 0 0 48px ${phase.glow.replace("0.35","0.12")}`,
              }}
            >
              <span style={{ fontSize: 16 }}>{phase.icon}</span>
              <div>
                <div className="font-mono font-bold" style={{ fontSize: 11, letterSpacing: "0.12em", color: phase.color }}>{phase.label}</div>
                <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", marginTop: 1 }}>Day {video.days} · {video.days <= 2 ? "First 48h" : video.days <= 7 ? "First week" : video.days <= 30 ? "First month" : "Evergreen"}</div>
              </div>
            </div>

            {/* Format pill */}
            <span className="font-mono font-semibold" style={{ fontSize: 9, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 99, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.25)", color: "#A78BFA" }}>
              {format.label.toUpperCase()}
            </span>

            {/* Niche pill */}
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 99, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60A5FA" }}>
              {niche.toUpperCase()}
            </span>
          </div>

          {/* VRS score ring */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
              <circle cx="26" cy="26" r="22" fill="none" stroke={phase.color} strokeWidth="4"
                strokeDasharray={`${(video.vrs.estimatedFullScore / 100) * 138} 138`}
                strokeDashoffset="34.5" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${phase.color})`, transition: "stroke-dasharray 1s" }}
              />
              <text x="26" y="29" textAnchor="middle" fill={phase.color} fontSize="11" fontWeight="700" fontFamily="monospace">{video.vrs.estimatedFullScore}</text>
            </svg>
            <div className="font-mono" style={{ fontSize: 8, color: "#5E5A57", marginTop: 2, letterSpacing: "0.08em" }}>VRS</div>
          </div>
        </div>

        {/* ── Phase description ── */}
        <p style={{ fontSize: 12.5, color: "#B8B6B1", lineHeight: 1.7, marginBottom: 20 }}>
          {phase.description}
        </p>

        {/* ── Row 2: Key performance metrics grid ── */}
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>

          {/* vs Channel */}
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px" }}>
            <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 4 }}>VS CHANNEL MEDIAN</div>
            <div className="font-mono font-bold" style={{ fontSize: 20, color: perfVsChannel >= 0 ? "#2ECC8A" : "#FF4D6A", textShadow: `0 0 12px ${perfVsChannel >= 0 ? "#2ECC8A88" : "#FF4D6A88"}` }}>
              {video.vsBaseline}x
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "#8A8885", marginTop: 2 }}>
              {perfVsChannel > 0 ? "+" : ""}{perfVsChannel}% above {chMedianViews.toLocaleString()} median
            </div>
          </div>

          {/* Velocity rank */}
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px" }}>
            <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 4 }}>VELOCITY RANK</div>
            <div className="font-mono font-bold" style={{ fontSize: 20, color: "#60A5FA", textShadow: "0 0 12px #60A5FA88" }}>
              {velocityPct > 0 ? `Top ${100 - velocityPct}%` : `${video.velocity.toLocaleString()}/d`}
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "#8A8885", marginTop: 2 }}>
              {video.velocity.toLocaleString()} views/day on this channel
            </div>
          </div>

          {/* Comment signal */}
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px" }}>
            <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 4 }}>COMMENT SIGNAL</div>
            <div className="font-mono font-bold" style={{ fontSize: 20, color: "#F59E0B", textShadow: "0 0 12px #F59E0B88" }}>
              {commentRate}/1K
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: "#8A8885", marginTop: 2 }}>
              {video.comments.toLocaleString()} total · {likeRate}% like rate
            </div>
          </div>

          {/* Pool comparison */}
          {pool && (
            <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px" }}>
              <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 4 }}>VS POOL MEDIAN</div>
              <div className="font-mono font-bold" style={{ fontSize: 20, color: pool.pct >= 0 ? "#2ECC8A" : "#FF4D6A", textShadow: `0 0 12px ${pool.pct >= 0 ? "#2ECC8A88" : "#FF4D6A88"}` }}>
                {pool.pct > 0 ? "+" : ""}{pool.pct}%
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: "#8A8885", marginTop: 2 }}>
                vs {pool.poolMedian.toLocaleString()} median · {pool.poolSize} videos tracked
              </div>
            </div>
          )}
        </div>

        {/* ── Title analysis ── */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
          <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 8 }}>
            {format.short ? "HOOK SIGNAL (no title/thumbnail for short-form)" : "TITLE & THUMBNAIL SIGNAL"}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Power words",    pass: hasPowerWord, note: hasPowerWord ? "detected" : "none found"       },
              { label: "Number hook",    pass: hasNumber,    note: hasNumber    ? "in title" : "missing"          },
              { label: "Question format",pass: hasQuestion,  note: hasQuestion  ? "used" : "not used"             },
              { label: "Title length",   pass: titleLen >= 40 && titleLen <= 70,
                note: titleLen < 40 ? `${titleLen} chars (too short)` : titleLen > 70 ? `${titleLen} chars (too long)` : `${titleLen} chars (optimal)` },
              { label: "Comment signal", pass: parseFloat(commentRate) >= 0.8,
                note: commentStrength.split("—")[0].trim() },
            ].map(({ label, pass, note }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: pass ? "#2ECC8A" : "#FF4D6A66", display: "inline-block", boxShadow: pass ? "0 0 6px #2ECC8A" : "none", flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: 9, color: "#8A8885" }}>{label}:</span>
                <span className="font-mono" style={{ fontSize: 9, color: pass ? "#2ECC8A" : "#9E9C97" }}>{note}</span>
              </div>
            ))}
            <div className="ml-auto">
              <span className="font-mono font-bold" style={{ fontSize: 10, color: titleScore >= 70 ? "#2ECC8A" : titleScore >= 45 ? "#F59E0B" : "#FF4D6A" }}>
                Signal: {titleScore >= 70 ? "STRONG" : titleScore >= 45 ? "MODERATE" : "WEAK"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Comment section intelligence ── */}
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
          <div className="font-mono" style={{ fontSize: 9, color: "#5E5A57", letterSpacing: "0.1em", marginBottom: 6 }}>COMMENT SECTION INTELLIGENCE</div>
          <p style={{ fontSize: 12, color: "#B8B6B1", lineHeight: 1.6 }}>
            {parseFloat(commentRate) >= 2
              ? `Strong comment signal at ${commentRate} per 1,000 views (${video.comments.toLocaleString()} total). This rate indicates the content is generating genuine conversation, not passive consumption. For ${format.short ? "short-form content" : "long-form content"} in the ${niche} niche, this comment density is a strong algorithm retargeting signal — YouTube and Instagram weight this heavily for re-distribution.`
              : parseFloat(commentRate) >= 0.8
              ? `Moderate comment engagement at ${commentRate} per 1,000 views (${video.comments.toLocaleString()} total). Audience is engaged but not compelled to discuss. The ${likeRate}% like rate suggests the content resonates but may not be triggering the emotional response needed for viral comment loops.`
              : `Low comment rate at ${commentRate} per 1,000 views despite ${video.views.toLocaleString()} views. This pattern typically means the content is either very passive (background watching) or the audience isn't invested enough to engage verbally. For ${niche} content, stronger opinion-framing or direct questions in the CTA would improve comment signal.`
            }
          </p>
        </div>

        {/* ── AI Verdict ── */}
        <div>
          {!aiTriggered ? (
            <div>
              <div className="panel-label mb-3">PERFORMANCE VERDICT</div>
              <div style={{
                background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)",
                borderRadius: 10, padding: "16px 18px",
              }}>
                {buildComputedVerdict().split("\n\n").map((para, i, arr) => (
                  <p key={i} style={{ fontSize: 13, color: "#C8C6C1", lineHeight: 1.75, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                    {para}
                  </p>
                ))}
              </div>
              <button
                onClick={generateAIVerdict}
                className="mt-3 w-full flex items-center justify-center gap-2 font-semibold rounded-xl"
                style={{
                  height: 40, fontSize: 12,
                  background: "linear-gradient(135deg, rgba(96,165,250,0.10), rgba(46,204,138,0.06))",
                  border: "1px solid rgba(96,165,250,0.25)",
                  color: "#60A5FA", cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(96,165,250,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Upgrade with AI Analysis
              </button>
            </div>
          ) : aiLoading ? (
            <div className="flex items-center gap-3" style={{ padding: "14px 0" }}>
              <span className="orbital-loader" />
              <span className="font-mono" style={{ fontSize: 11, color: "#6B6860" }}>Generating analysis…</span>
            </div>
          ) : (
            <div>
              <div className="panel-label mb-3">AI PERFORMANCE VERDICT</div>
              <div style={{
                background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.14)",
                borderRadius: 10, padding: "16px 18px",
                boxShadow: "inset 0 1px 0 rgba(96,165,250,0.06)",
              }}>
                {aiVerdict.split("\n\n").map((para, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#C8C6C1", lineHeight: 1.75, marginBottom: i < aiVerdict.split("\n\n").length - 1 ? 14 : 0 }}>
                    {para}
                  </p>
                ))}
              </div>
              <button
                onClick={generateAIVerdict}
                className="mt-2 font-mono"
                style={{ fontSize: 9, color: "#5E5A57", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}
              >
                ↻ REGENERATE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
