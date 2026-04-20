"use client";

// ═══════════════════════════════════════════════════════════════════════════
// REVERSE ENGINEER PAGE (Mode D)
// ═══════════════════════════════════════════════════════════════════════════
//
// Hero card + URL input + source-platform selector + algorithm signals
// expandable (CTR, AVD, Session, Engagement for YouTube; equivalents for
// other platforms). Rest of page: collapsible sections (Script Formula,
// Title Formulas, Thumbnail Rules, Replication Blueprint, Common Mistakes).
// Ported from `page-reverse.jsx`.

import React, { useMemo, useState } from "react";
import { T, PLATFORMS } from "@/lib/design-tokens";
import StarField from "./StarField";
import type { Platform } from "@/lib/forecast";

interface AlgoSignal {
  name:   string;
  target: string;
  weight: number;
  plain:  string;
  howTo:  string;
  fix:    string;
  bad:    string;
  good:   string;
}

// Data from `app-data.jsx::ALGO_SIGNALS.ytl` plus quick TikTok/IG/X/Shorts
// parallels. Enough to make the page meaningful without wiring the full
// algorithm-intel library.
const ALGO_SIGNALS: Record<Platform, AlgoSignal[]> = {
  youtube: [
    {
      name: "Click-Through Rate (CTR)",
      target: ">4% in first 48h", weight: 30,
      plain: "Out of every 100 people who SEE your thumbnail, at least 4 need to click. YouTube gives a +25% distribution boost to thumbnails with high emotional resonance. Below 4% CTR in the first 48 hours and the algorithm slows distribution.",
      howTo: "The thumbnail and title must create a curiosity gap. High emotional resonance — surprise, shock, \"I need to know\" — consistently outperforms information-heavy thumbnails.",
      fix:   "Check YouTube Studio → Analytics → Reach. If below 4%, A/B test thumbnails. Change one element at a time.",
      bad:   "Text-only thumbnail with neutral colour → 1.8% CTR → algorithm slows distribution",
      good:  "Shocked face + \"$8,400 payout\" bold text + bright background → 7.2% CTR → algorithm amplifies",
    },
    {
      name: "Average Watch Duration (AVD)",
      target: ">50% of runtime", weight: 50,
      plain: "The single most important signal on YouTube Long-Form. If your video is 10 minutes, the average viewer needs to watch at least 5 minutes. YouTube uses this to decide whether people actually wanted the video — not just clicked on it.",
      howTo: "Every section should earn the next one. At each 2-minute mark, give the viewer a reason to keep going: 'But the thing that actually surprised me about this is coming up…'. Re-hook before they drop.",
      fix:   "YouTube Studio → Analytics → Audience retention. Find every sharp drop. Each drop is a specific moment that doesn't deliver on a promise.",
      bad:   "Long intro talking about yourself and the channel → viewers leave at 0:45 → AVD crashes",
      good:  "Start with the payoff/result, then work backwards → viewers stay for the full breakdown",
    },
    {
      name: "Session Time Contribution",
      target: "positive net session", weight: 15,
      plain: "YouTube measures whether people keep watching YouTube after your video, or leave the app entirely. If they keep watching — even other channels — your video is rewarded.",
      howTo: "End screens and cards that link to a follow-up video. Reference your own other videos mid-content. Playlists help massively here.",
      fix:   "Create 2-3 video playlists around a theme. Link from end screens. YouTube Studio → Engagement → Suggested videos.",
      bad:   "\"Thanks for watching, subscribe!\" cold ending → session terminates → negative signal",
      good:  "Teaser for next video + end screen + autoplay-friendly ending → session continues → positive signal",
    },
    {
      name: "Engagement Rate",
      target: ">5% (like+comment/views)", weight: 5,
      plain: "Likes and comments aren't weighted as heavily as watch time, but they're tiebreakers. Two videos with identical watch time — the one with more engagement wins distribution.",
      howTo: "Ask a specific question in the video that demands a comment. Pinned comment with your own answer seeds the section.",
      fix:   "Always pin a comment within the first hour. Reply to the first 20 comments. Comment depth matters more than count.",
      bad:   "\"Like and subscribe\" generic CTA → 0.4% engagement → tiebreaker lost",
      good:  "Specific debate question pinned + creator replies → 6.8% engagement → distribution edge",
    },
  ],
  youtube_short: [
    {
      name: "3-second retention", target: ">75%", weight: 40,
      plain: "Shorts have no click — the feed auto-plays. The first 3 seconds decide whether a viewer swipes or stays. Below 75% 3-sec retention, the algorithm stops pushing.",
      howTo: "Open with motion, a bold text hook, or a surprising visual. No logos, no intros.",
      fix:   "Shorts → first frame must contain stakes. Rewrite the opening, not the middle.",
      bad:   "\"Hey guys, today we're going to talk about…\" → viewers swipe → dead",
      good:  "Stacks of cash on screen + \"This is what $50k in a day looks like\" → 84% 3-sec hold → viral",
    },
    {
      name: "Completion rate", target: ">50%", weight: 30,
      plain: "Whether viewers watch to the end of the Short is the second-strongest signal. Long-tail completion (>50%) = algorithmic push.",
      howTo: "Keep duration tight. Under 30s beats 60s for most niches. Finish with a loop-ready ending so completion and replay both count.",
      fix:   "Cut dead time. Every pause between sentences is a swipe risk.",
      bad:   "58s Short with 22s of setup → 31% completion",
      good:  "22s Short with payoff in first 4s + loop ending → 68% completion",
    },
    {
      name: "Replay rate", target: ">15%", weight: 20,
      plain: "Replays are YouTube's truth meter for Shorts — if people watch twice, the content is genuinely good.",
      howTo: "End with an unresolved beat or a sneak-peek frame that makes the loop satisfying.",
      fix:   "Test first and last frame → do they match? Loop-friendly endings get replayed.",
      bad:   "Clear ending with fade-to-black → replay rate 4%",
      good:  "First and last frame are identical → replay rate 19%",
    },
    {
      name: "Shares", target: ">2% of views", weight: 10,
      plain: "Shares are amplification. A Short with >2% share rate reaches non-followers faster than one with 0.5%.",
      howTo: "Make the Short sendable — relatable, funny, or useful enough that someone would forward it.",
      fix:   "Ask yourself: would someone text this to a friend? If not, it won't share.",
      bad:   "Generic tutorial → 0.3% share rate",
      good:  "Specific moment that triggers \"this is so [friend]\" → 3.1% share rate",
    },
  ],
  tiktok: [
    {
      name: "Completion rate", target: ">70% (2026 viral gate)", weight: 40,
      plain: "TikTok's single biggest 2026 signal. Below 70% completion, you stay in the 200-view jail. Above, the algorithm graduates you to Tier 2.",
      howTo: "Tight edit. Payoff in the first 3 seconds. Every second of the rest must earn the next.",
      fix:   "Creator Center → Analytics → Completion %. If below 70%, cut 20% of the length.",
      bad:   "60s TikTok with 18s of setup → 42% completion → stuck",
      good:  "22s TikTok with immediate payoff → 78% completion → viral",
    },
    {
      name: "Rewatch rate", target: ">15%", weight: 25,
      plain: "Rewatches outrank follower count in TikTok's 2026 ranking. If viewers watch twice, the algorithm treats you as a real creator.",
      howTo: "Loop-ready ending. Surprise at the end that makes them restart.",
      fix:   "Check rewatch %. If below 10%, the ending isn't loop-worthy.",
      bad:   "Clean ending with closing graphic → 4% rewatch",
      good:  "Payoff at 22s that references the hook at 0s → 18% rewatch",
    },
    {
      name: "Shares", target: ">2% of views", weight: 20,
      plain: "Shares drive Tier 3 viral scaling. Share rate above 2% is a direct ticket to millions.",
      howTo: "Relatable / controversial / useful → people forward to friends.",
      fix:   "Ask: is this a \"send to group chat\" video? If not, viral ceiling is low.",
      bad:   "Talking-head explainer → 0.4% share rate",
      good:  "Specific POV that hits a tribe → 3.2% share rate",
    },
    {
      name: "For You Page delivery", target: "<5% following / >95% FYP", weight: 15,
      plain: "Interest-graph driven — TikTok is about the content, not the follower base. If most of your traffic is from followers, you haven't escaped your existing audience.",
      howTo: "Hook must work for cold viewers. No inside references.",
      fix:   "Creator Center → Traffic sources. FYP share below 80% = content doesn't generalise.",
      bad:   "In-joke with your 12 followers → 62% following, stuck",
      good:  "Cold hook that anyone understands → 94% FYP, viral",
    },
  ],
  instagram: [
    {
      name: "DM sends", target: ">3× likes", weight: 35,
      plain: "Mosseri's #1 signal for Reels in 2026. Sends (DM shares) are worth 3-5× a like algorithmically because they signal real quality.",
      howTo: "Reach-sendable content — funny, relatable, useful. The kind of thing someone texts their friend immediately.",
      fix:   "Instagram Insights → Shares. Shares per reach above 1% = algorithm expansion.",
      bad:   "Generic motivational quote → 0.1% shares per reach",
      good:  "Specific niche hit → 2.4% shares per reach",
    },
    {
      name: "3-second hold", target: ">60%", weight: 25,
      plain: "IG's audition gate. Below 60% 3-sec hold, Explore distribution dies.",
      howTo: "First frame = entire hook. Text overlay with stakes, motion, or surprise.",
      fix:   "Insights → Audience retention. Below 60% = rewrite the cover frame and first beat.",
      bad:   "Talking head intro → 42% hold",
      good:  "Bold text + motion + stakes → 74% hold",
    },
    {
      name: "Saves", target: ">2% of reach", weight: 20,
      plain: "Saves signal reference value — content people bookmark for later. Explore pushes save-heavy content.",
      howTo: "Educational / tutorial / framework content saves best.",
      fix:   "Insights → Saves per reach. Under 1% = content is consumed, not kept.",
      bad:   "Entertainment clip → 0.3% save rate",
      good:  "10-step framework carousel → 2.9% save rate",
    },
    {
      name: "Reach velocity", target: "1hr reach = 10× followers", weight: 20,
      plain: "Early reach velocity determines whether Reels escape your follower base into Explore.",
      howTo: "Post when your audience is active. First 60 min engagement is the key window.",
      fix:   "Insights → Reach → First-hour. If 1hr reach < 2× followers, content doesn't travel.",
      bad:   "Posted at 3am local → 0.3× followers first hour",
      good:  "Posted at audience peak with hook that travels → 14× followers first hour, viral",
    },
  ],
  x: [
    {
      name: "Reply chains", target: "author replies that get replies", weight: 40,
      plain: "150× a like in X's open-source algorithm. A reply chain where the author engages and their reply gets a reply back is the single strongest signal.",
      howTo: "Post with a hook that invites disagreement. Reply to every substantive comment. Reply threads that get replies back = explosion.",
      fix:   "Check reply count vs like count. Reply-rich posts outperform like-rich ones by 20×.",
      bad:   "\"Great post!\" + 2 likes, no replies → flat",
      good:  "Contrarian take with author engagement in 10 reply chains → viral",
    },
    {
      name: "Reposts (20× like)", target: ">5% of views", weight: 25,
      plain: "Each repost is worth 20× a like. Repost rate above 5% means the tweet is traveling across networks.",
      howTo: "Strong take, useful data, or emotional resonance. Shareable opinion > information.",
      fix:   "Repost rate below 1% = tweet doesn't cross networks. Rewrite the hook.",
      bad:   "Dry fact → 0.2% repost rate",
      good:  "Sharp opinion with social proof → 6.8% repost rate",
    },
    {
      name: "Bookmarks (10× like)", target: ">3% of views", weight: 20,
      plain: "Bookmarks are the silent like — 10× a like algorithmically and signal lasting value.",
      howTo: "Threads, frameworks, reference material bookmark best.",
      fix:   "Bookmark-to-like ratio >30% = quality signal.",
      bad:   "One-liner joke → 0.1% bookmark rate",
      good:  "8-step framework thread → 4.2% bookmark rate",
    },
    {
      name: "First-hour velocity", target: "half-life 6h", weight: 15,
      plain: "X halves visibility every 6 hours. If you don't hit velocity in hour 1, the tweet is effectively dead by hour 6.",
      howTo: "Time the post for peak audience activity. Reply to first comments within minutes.",
      fix:   "Check engagement in first 60 min vs first 6 hours. If first-hour < 20% of 6-hour total, timing is wrong.",
      bad:   "Post at 3am, 12 likes in first hour → dead",
      good:  "Post at audience peak, 200 likes in first hour → amplification",
    },
  ],
};

interface ReverseEnginePageProps {
  platform:  Platform;
  onAnalyze: (url: string) => void;
}

export default function ReverseEnginePage({ platform, onAnalyze }: ReverseEnginePageProps) {
  const p = PLATFORMS[platform];
  const [url, setUrl] = useState("");
  const [src, setSrc] = useState<Platform>(platform);
  const [openSig, setOpenSig] = useState<number>(0);

  const signals = useMemo(() => ALGO_SIGNALS[platform] ?? [], [platform]);

  const submit = () => {
    const t = url.trim();
    if (t) onAnalyze(t);
  };

  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <StarField />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

        <section style={{
          background: T.bgPanel, border: `1px solid ${p.color}55`,
          borderRadius: 4, padding: "18px 20px", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at top left, ${p.bg}, transparent 60%)`,
            pointerEvents: "none",
          }} />
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", position: "relative" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 5,
              background: p.bg, border: `1px solid ${p.color}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: p.color, fontSize: 18,
            }}>⚙</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.2, lineHeight: 1.15 }}>
                  Reverse Engineer
                </h2>
                <span style={{
                  marginLeft: "auto", padding: "3px 9px", borderRadius: 3,
                  background: p.bg, border: `1px solid ${p.color}55`, color: p.color,
                  fontFamily: "IBM Plex Mono, monospace", fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
                }}>MODE D</span>
              </div>
              <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3 }}>
                Analyze content FROM <span style={{ color: p.color }}>{p.label}</span>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={`Paste a ${p.label} URL to break it down completely…`}
            style={{
              flex: 1, padding: "10px 12px",
              background: T.bgPanel, border: `1px solid ${T.line}`,
              borderRadius: 4, color: T.ink,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 12, outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            style={{
              padding: "10px 18px", borderRadius: 4,
              background: url.trim() ? p.bg : T.bgPanel,
              border: `1px solid ${p.color}66`,
              color: url.trim() ? p.color : T.inkDim,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 600,
              cursor: url.trim() ? "pointer" : "default",
            }}
          >Analyze →</button>
        </form>

        <div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>
            I want to recreate this content for →
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.values(PLATFORMS).map(pl => {
              const active = src === (pl.id as Platform);
              return (
                <button
                  key={pl.id}
                  onClick={() => setSrc(pl.id as Platform)}
                  style={{
                    padding: "8px 14px", display: "flex", alignItems: "center", gap: 7,
                    borderRadius: 4,
                    background: active ? pl.bg : T.bgPanel,
                    border: `1px solid ${active ? pl.color + "66" : T.line}`,
                    color: active ? pl.color : T.inkDim,
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <span>{pl.icon}</span>{pl.label}
                  {active && (
                    <span style={{
                      padding: "2px 5px", marginLeft: 3, borderRadius: 2,
                      background: pl.color, color: T.bgDeep,
                      fontSize: 8, fontWeight: 700, letterSpacing: 1,
                    }}>SOURCE</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <section style={{
          background: T.bgPanel, border: `1px solid ${p.color}33`, borderRadius: 4, overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${T.line}`,
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(228,87,78,0.04)",
          }}>
            <span style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
              {p.label} Algorithm — What Actually Matters
            </span>
            <span style={{
              padding: "2px 7px", borderRadius: 2,
              border: `1px solid ${p.color}44`, color: p.color,
              fontFamily: "IBM Plex Mono, monospace", fontSize: 9,
            }}>2026</span>
            <span style={{ marginLeft: "auto", color: p.color, fontSize: 14 }}>▴</span>
          </div>
          <div style={{
            padding: "12px 16px", fontSize: 12, color: T.inkMuted, lineHeight: 1.6,
            borderBottom: `1px solid ${T.line}`,
          }}>
            These are the signals the {p.label} algorithm uses to decide whether to push or bury content. Each one has a target threshold — hit it and the algorithm amplifies. Miss it and you stay invisible.
          </div>
          {signals.map((s, i) => (
            <SignalBlock
              key={i} signal={s} color={p.color}
              open={openSig === i}
              onToggle={() => setOpenSig(openSig === i ? -1 : i)}
            />
          ))}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Script Formula — Step by Step",
            "Title Formulas That Actually Get Clicked",
            "Thumbnail / Cover — Rules That Drive Clicks",
            "Replication Blueprint — Exact Steps to Copy Any Video",
            "Common Mistakes — Things to Stop Doing Immediately",
          ].map((t, i) => (
            <button
              key={i}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 4,
                background: T.bgPanel, border: `1px solid ${p.color}22`,
                color: T.ink, fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", cursor: "pointer", textAlign: "left",
              }}
            >
              {t}
              <span style={{ marginLeft: "auto", color: p.color, fontSize: 12 }}>▾</span>
            </button>
          ))}
        </section>

      </div>
    </div>
  );
}

function SignalBlock({ signal, color, open, onToggle }: { signal: AlgoSignal; color: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.line}` }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "14px 16px", border: "none",
          background: "transparent", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "flex-start", gap: 14, color: "inherit",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color, fontWeight: 600 }}>{signal.name}</div>
          <div style={{
            fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
            color: T.inkMuted, marginTop: 3,
          }}>
            Target: <span style={{ color }}>{signal.target}</span> · Algorithm weight: <span style={{ color }}>{signal.weight}%</span>
          </div>
        </div>
        <div style={{ fontSize: 24, fontFamily: "IBM Plex Mono, monospace", color, fontWeight: 300 }}>
          {signal.weight}%
        </div>
      </button>
      <div style={{ height: 2, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ width: `${signal.weight}%`, height: "100%", background: color }} />
      </div>
      {open && (
        <div style={{ padding: "12px 16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div><Label>In Plain English</Label>
            <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.6 }}>{signal.plain}</div>
          </div>
          <div><Label>How to Hit This Target</Label>
            <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.6 }}>{signal.howTo}</div>
          </div>
          <div style={{
            padding: "10px 12px", borderRadius: 3,
            background: "rgba(255,255,255,0.02)", border: `1px solid ${T.line}`,
            fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
          }}>
            <Label>Specific Fix</Label>
            <div style={{ color: T.inkDim, marginBottom: 6, lineHeight: 1.55 }}>{signal.fix}</div>
            <div style={{ color: T.red, lineHeight: 1.55 }}>✗ {signal.bad}</div>
            <div style={{ color: T.green, lineHeight: 1.55 }}>✓ {signal.good}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "IBM Plex Mono, monospace", fontSize: 9, letterSpacing: 1.4,
      textTransform: "uppercase", color: T.inkFaint, marginBottom: 5,
    }}>{children}</div>
  );
}
