"use client";

import { useState } from "react";
import type { AnalysisResult, VideoData, ChannelData, EnrichedVideo } from "@/lib/types";

type Platform = "youtube" | "tiktok" | "instagram";

interface ReverseEngineerPanelProps {
  platform: Platform;
  result: AnalysisResult | null;
  loading: boolean;
  onAnalyze: (input: string) => void;
}

// ── Per-platform algorithm intelligence ──────────────────────────────────────

const PLATFORM_INTEL = {
  youtube: {
    color: "#FF4444",
    label: "YouTube",
    icon: "▶",
    hookWindow: "First 30 seconds",
    algorithmSignals: [
      { signal: "Click-Through Rate (CTR)", target: "6–10%", weight: "30%", tip: "Thumbnail + title must create curiosity gap or promise clear value" },
      { signal: "Average View Duration (AVD)", target: ">50% of runtime", weight: "50%", tip: "Retention curve drop-off at 30s, 2min, and 50% mark are critical" },
      { signal: "Satisfaction / Likes per View", target: ">4%", weight: "20%", tip: "Ask for likes at peak emotional moment, not end of video" },
    ],
    scriptFormula: [
      { step: "1. Hook (0–30s)", desc: "Open with the payoff — show the result/transformation first. Use a pattern interrupt (movement, bold text, or unexpected claim)." },
      { step: "2. Authority Bridge (30–60s)", desc: "Establish why you can deliver on the promise. Keep it under 20 seconds." },
      { step: "3. Body / Value Loop (60s–80%)", desc: "Deliver in digestible chunks. Each chapter should re-hook with 'and the next thing I discovered was…'" },
      { step: "4. Loop CTA (last 20%)", desc: "Tease the next video before the subscribe ask. End on a cliffhanger or unanswered question." },
    ],
    titleFormula: [
      { pattern: "Number + Power Keyword + Benefit", example: '"7 TikTok Scripts That Print Views"' },
      { pattern: "I Did X for Y Days (Results)", example: '"I Posted Every Day for 90 Days (Here\'s What Happened)"' },
      { pattern: "The Truth About [Topic]", example: '"The Truth About YouTube Shorts Nobody Tells You"' },
      { pattern: "Question Format", example: '"Why Is Nobody Talking About This Strategy?"' },
    ],
    thumbnailFormula: [
      "High contrast background (avoid mid-tones)",
      "Face showing strong emotion (shock, joy, or disbelief)",
      "3–5 word text overlay max — huge font, single color",
      "Arrow or circle pointing to key element",
      "A/B test: face vs no-face for your niche",
    ],
    replicationBlueprint: [
      "Identify the top 3 videos in your niche with 10x+ median views",
      "Screenshot their thumbnail — map: emotion, text, contrast, subject",
      "Transcribe the first 60 seconds — extract the hook pattern",
      "Note the exact title formula used",
      "Map the chapter structure: how many segments, what transitions they use",
      "Check the comment section: what are viewers saying they wanted MORE of",
      "Rebuild: same structure, your topic, different angle",
    ],
  },
  tiktok: {
    color: "#00f2ea",
    label: "TikTok",
    icon: "♪",
    hookWindow: "First 3 seconds",
    algorithmSignals: [
      { signal: "Completion Rate", target: ">70%", weight: "45%", tip: "If viewers don't finish, the algo stops pushing. Keep videos under 60s until you have an engaged base." },
      { signal: "Rewatch / Loop Rate", target: ">1.3×", weight: "35%", tip: "Build in a reason to rewatch — a detail they missed, a loop ending, or a callback." },
      { signal: "Shares & DMs", target: ">2% of views", weight: "20%", tip: "Content that makes people say 'this is literally me' or 'sending this to _____' gets DM-shared." },
    ],
    scriptFormula: [
      { step: "1. Visual + Text Hook (0–1s)", desc: "Before anyone hears audio: bold on-screen text or a visually surprising frame must stop the scroll." },
      { step: "2. Verbal Hook (1–3s)", desc: "The spoken hook must create a knowledge gap: 'Most traders don't know this…' or 'Stop doing this one thing.'" },
      { step: "3. Twist / Stakes (3–10s)", desc: "Immediately raise the stakes. Why should they care? What do they stand to gain or lose?" },
      { step: "4. Value Delivery (10s–end)", desc: "Deliver the actual content fast. No filler. Cut every second that doesn't add information or emotion." },
      { step: "5. Loop / CTA (last 2s)", desc: "End mid-sentence OR transition back to the opening frame to force a rewatch." },
    ],
    titleFormula: [
      { pattern: "Statement they disagree with", example: '"Prop firms are not scams"' },
      { pattern: "Relatable struggle", example: '"POV: you just blew your funded account"' },
      { pattern: "Number hack / shortcut", example: '"3 entries that work every single time"' },
      { pattern: "Direct address", example: '"If you trade news events, watch this"' },
    ],
    thumbnailFormula: [
      "First frame IS the thumbnail — make it visually shocking or curiosity-driven",
      "Use text overlay on frame 1 that creates a question the video answers",
      "High contrast — black background with bright subject",
      "Human face with genuine reaction (not posed)",
      "Charts or P&L screenshots perform well in finance niche",
    ],
    replicationBlueprint: [
      "Find the creator's top 5 videos by views in the last 90 days",
      "Note the exact first 3 seconds of each — text + spoken word + visual",
      "Map the emotional arc: where does energy spike? Where do they drop information?",
      "Check which sounds are used — trending audio vs original voice",
      "Look at comment sentiment: what are they reacting to specifically?",
      "Extract the hook formula and apply it to 3 different angles",
      "Post at 6–9am or 7–10pm in your audience's timezone",
    ],
  },
  instagram: {
    color: "#E1306C",
    label: "Instagram",
    icon: "◎",
    hookWindow: "First 1 second",
    algorithmSignals: [
      { signal: "Sends / Reach Ratio", target: ">4%", weight: "40%", tip: "Content people DM to others signals strong relevance — build around 'send this to someone who…'" },
      { signal: "Saves Rate", target: ">3% of reach", weight: "30%", tip: "Tutorial, list, or reference content gets saved. Ask 'save this for later' at the exact moment they see the value." },
      { signal: "3-Second View Rate", target: ">60%", weight: "30%", tip: "If 60% of people who see your reel don't watch 3 seconds, it won't be distributed. First frame is everything." },
    ],
    scriptFormula: [
      { step: "1. Visual Hook (Frame 1)", desc: "No intro, no logo. First frame must be the most interesting moment or a bold text statement." },
      { step: "2. Caption Hook (Line 1)", desc: "First line of caption shows in feed without expanding. Make it a question or incomplete statement." },
      { step: "3. Value Delivery (2s–end)", desc: "Teach, inspire, or entertain immediately. Use text overlays to reinforce audio." },
      { step: "4. Save / Share CTA (mid-reel)", desc: "Place the CTA at the moment of highest value — not the end. 'Save this before you lose it.'" },
    ],
    titleFormula: [
      { pattern: "Statement + proof", example: '"I went from 0 to $50k funded in 60 days (here\'s exactly how)"' },
      { pattern: "Myth bust", example: '"You don\'t need 10K followers to go viral on Instagram"' },
      { pattern: "List / resource", example: '"5 prop firms that actually pay out (2026 list)"' },
      { pattern: "Transformation hook", example: '"This one mindset shift changed everything about how I trade"' },
    ],
    thumbnailFormula: [
      "First frame: bold text on clean background or face with expression",
      "Use native IG aesthetic — over-produced looks like an ad",
      "Carousel cover should tease the value inside",
      "Reels cover thumbnail: choose a mid-action frame, not a static one",
      "Consistent brand colors across all covers builds recognition",
    ],
    replicationBlueprint: [
      "Pull the top 10 reels from the target account in the last 60 days",
      "For each: note the first-frame visual, first spoken word, caption first line",
      "Find which ones have the most saves (check public likes vs comments ratio as proxy)",
      "Map the content format: talking head, text-only, screen recording, b-roll?",
      "Extract the CTA placement — where exactly in the reel do they ask for the save?",
      "Rebuild with your angle: same format, your expertise, your story",
      "Post Tue–Fri 11am–1pm or 7–9pm local time",
    ],
  },
};

// ── Section component ─────────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "#f1f1f1" }}>{title}</span>
        <span style={{ color: accent, fontSize: 12, transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReverseEngineerPanel({
  platform,
  result,
  loading,
  onAnalyze,
}: ReverseEngineerPanelProps) {
  const [urlInput, setUrlInput] = useState("");
  const intel = PLATFORM_INTEL[platform];

  // Extract video data from result if available
  const video: EnrichedVideo | null =
    result?.type === "video" ? result.video :
    result?.type === "tiktok-batch" ? (result.videos[0] ?? null) :
    null;

  const channel: ChannelData | null =
    result?.type === "video" ? (result.channel ?? null) : null;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[16px]"
          style={{ background: `color-mix(in srgb, ${intel.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${intel.color} 30%, transparent)` }}>
          ⚙
        </div>
        <div>
          <h2 className="text-[16px] font-bold" style={{ color: "#f1f1f1" }}>Reverse Engineer</h2>
          <p className="text-[12px]" style={{ color: "#717171" }}>
            Mode D active · {intel.label} algorithm · Paste a URL to break down specific content
          </p>
        </div>
        <div className="ml-auto px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${intel.color} 15%, transparent)`, color: intel.color, border: `1px solid color-mix(in srgb, ${intel.color} 25%, transparent)` }}>
          D
        </div>
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder={`Paste a ${intel.label} URL or @handle to reverse engineer…`}
          onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) { onAnalyze(urlInput.trim()); } }}
          className="flex-1 rounded-xl px-4 py-2.5 text-[13px] outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid color-mix(in srgb, ${intel.color} 25%, transparent)`, color: "#f1f1f1" }}
        />
        <button
          onClick={() => { if (urlInput.trim()) onAnalyze(urlInput.trim()); }}
          disabled={loading || !urlInput.trim()}
          className="rounded-xl px-5 py-2.5 text-[13px] font-semibold shrink-0 transition-opacity"
          style={{ background: intel.color, color: platform === "tiktok" ? "#000" : "#fff", opacity: (loading || !urlInput.trim()) ? 0.4 : 1 }}
        >
          {loading ? "Analyzing…" : "Reverse Engineer"}
        </button>
      </div>

      {/* Live result breakdown — shown when content has been analyzed */}
      {video && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: `color-mix(in srgb, ${intel.color} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${intel.color} 20%, transparent)` }}>
          <div className="text-[11px] font-semibold tracking-widest" style={{ color: intel.color }}>CONTENT BREAKDOWN</div>

          {/* Video identity */}
          <div>
            <div className="text-[15px] font-bold mb-1" style={{ color: "#f1f1f1" }}>{video.title || video.channel}</div>
            {channel && <div className="text-[12px]" style={{ color: "#717171" }}>{channel.name} · {(channel.subs / 1000).toFixed(0)}K subs</div>}
          </div>

          {/* Signal scores vs benchmarks */}
          <div className="grid grid-cols-3 gap-3">
            {intel.algorithmSignals.map(({ signal, target, weight }) => {
              const actual =
                signal.toLowerCase().includes("completion") ? `${(video.engagement * 12).toFixed(0)}%` :
                signal.toLowerCase().includes("ctr") ? "—" :
                signal.toLowerCase().includes("avd") ? "—" :
                signal.toLowerCase().includes("saves") ? `${(video.likes / Math.max(video.views, 1) * 100 * 0.8).toFixed(1)}%` :
                signal.toLowerCase().includes("share") || signal.toLowerCase().includes("sends") ? `${(video.shares ? (video.shares / Math.max(video.views, 1) * 100).toFixed(1) : (video.likes / Math.max(video.views, 1) * 100 * 0.4).toFixed(1))}%` :
                `${video.engagement.toFixed(2)}%`;
              return (
                <div key={signal} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="text-[10px] mb-1" style={{ color: "#717171" }}>{signal.split(" ")[0]} {signal.split(" ")[1] || ""}</div>
                  <div className="text-[18px] font-bold" style={{ color: intel.color }}>{actual}</div>
                  <div className="text-[10px]" style={{ color: "#555" }}>target: {target}</div>
                </div>
              );
            })}
          </div>

          {/* Hook extraction from title */}
          <div>
            <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: "#717171" }}>HOOK FORMULA USED</div>
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {(() => {
                const t = (video.title || "").toLowerCase();
                if (/^how to|^how i/i.test(video.title || "")) return <><span style={{ color: intel.color }} className="font-semibold">Tutorial Hook</span> — "How to / How I" frame. Promises a concrete skill or result.</>;
                if (/\d/.test(video.title || "")) return <><span style={{ color: intel.color }} className="font-semibold">Number Hook</span> — Specificity builds trust and sets a completion expectation.</>;
                if (/why|what|when|where|who/i.test(video.title || "")) return <><span style={{ color: intel.color }} className="font-semibold">Question Hook</span> — Opens a knowledge gap the viewer must close.</>;
                if (/stop|don't|never|avoid|mistake/i.test(video.title || "")) return <><span style={{ color: intel.color }} className="font-semibold">Warning / Loss-Aversion Hook</span> — Loss-frame psychology. "You're doing it wrong."</>;
                if (/i made|i earned|i lost|i went/i.test(video.title || "")) return <><span style={{ color: intel.color }} className="font-semibold">Confession / Story Hook</span> — First-person result creates trust and curiosity.</>;
                return <><span style={{ color: intel.color }} className="font-semibold">Direct Statement Hook</span> — Bold assertion designed to confirm or challenge a belief.</>;
              })()}
              <div className="mt-2 text-[12px] italic" style={{ color: "#aaa" }}>"{video.title}"</div>
            </div>
          </div>

          {/* Replication instruction */}
          <div>
            <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: "#717171" }}>REPLICATION BLUEPRINT FOR THIS CONTENT</div>
            <ol className="space-y-1.5">
              {[
                `Mirror the hook type: start with the same emotional trigger (${video.title?.split(" ").slice(0, 3).join(" ")}…) but shift the topic or angle`,
                `Target ${(video.views / 1000).toFixed(0)}K+ views — their baseline. Your content should aim for ${Math.round(video.views * 1.15 / 1000)}K+`,
                `Keep engagement above ${Math.max(video.engagement, 4).toFixed(1)}% — this creator's standard`,
                `Post within ${intel.hookWindow} hook window — if viewer doesn't commit, they leave`,
                ...(platform === "youtube" ? ["Add chapters every 2–3 minutes to boost AVD", "End each chapter with a micro-tease: 'but that's not the craziest part…'"] : []),
                ...(platform === "tiktok" ? ["Loop the ending back to frame 1 to force rewatch", "Use trending audio from the past 7 days for +40% distribution boost"] : []),
                ...(platform === "instagram" ? ["Place a save CTA within the first 50% of the reel", "Add text overlay reinforcing the spoken hook for silent viewers"] : []),
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[12px]" style={{ color: "#ccc" }}>
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ background: `color-mix(in srgb, ${intel.color} 20%, transparent)`, color: intel.color }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Algorithm signals */}
      <Section title={`${intel.label} Algorithm Signals (2026)`} accent={intel.color}>
        <div className="space-y-3">
          {intel.algorithmSignals.map(({ signal, target, weight, tip }) => (
            <div key={signal} className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold" style={{ color: "#f1f1f1" }}>{signal}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#aaa" }}>target: {target}</span>
                  <span className="text-[11px] font-bold" style={{ color: intel.color }}>{weight}</span>
                </div>
              </div>
              <p className="text-[12px] m-0" style={{ color: "#717171" }}>{tip}</p>
              {/* Weight bar */}
              <div className="mt-2 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: weight, background: intel.color, opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Script formula */}
      <Section title="Script Formula" accent={intel.color}>
        <div className="space-y-2.5">
          {intel.scriptFormula.map(({ step, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="rounded-lg px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: `color-mix(in srgb, ${intel.color} 15%, transparent)`, color: intel.color }}>
                  {step.split(".")[0].replace("1", "").replace("2", "").replace("3", "").replace("4", "").replace("5", "")} {step.split(". ")[1]?.split(" (")[0]}
                </div>
              </div>
              <p className="text-[12px] leading-relaxed m-0" style={{ color: "#aaa" }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Title formulas */}
      <Section title="Title Formulas That Win" accent={intel.color}>
        <div className="space-y-2.5">
          {intel.titleFormula.map(({ pattern, example }) => (
            <div key={pattern} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[12px] font-semibold mb-1" style={{ color: "#f1f1f1" }}>{pattern}</div>
              <div className="text-[11px] italic" style={{ color: "#717171" }}>{example}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Thumbnail formula */}
      <Section title="Thumbnail / Cover Formula" accent={intel.color}>
        <ul className="space-y-2">
          {intel.thumbnailFormula.map((rule, i) => (
            <li key={i} className="flex gap-2.5 text-[12px]" style={{ color: "#ccc" }}>
              <span style={{ color: intel.color }} className="shrink-0 mt-0.5">✓</span>
              {rule}
            </li>
          ))}
        </ul>
      </Section>

      {/* Replication blueprint */}
      <Section title="Replication Blueprint" accent={intel.color}>
        <div className="space-y-2">
          {intel.replicationBlueprint.map((step, i) => (
            <div key={i} className="flex gap-3 text-[12px]" style={{ color: "#ccc" }}>
              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{ background: `color-mix(in srgb, ${intel.color} 15%, transparent)`, color: intel.color }}>
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
