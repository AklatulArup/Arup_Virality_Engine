// Playbooks miner — "what do this niche's breakouts have in common?"
// Pure compute over pool entries. For each platform: build per-channel
// medians (channels with ≥5 video entries), mark breakouts (≥3× their own
// channel's median), then compare trait prevalence in breakouts vs the whole
// population. A trait makes the playbook when breakouts use it ≥1.3× more
// often than the base rate AND at least 4 breakouts carry it — small-sample
// flukes stay out. No AI, no fitting: counting, honestly labeled.

import type { Platform } from "./forecast";
import type { ReferenceEntry, ArchetypeId } from "./types";

export const BREAKOUT_MIN_X = 3;
const MIN_CHANNEL_VIDEOS = 5;
const MIN_PLATFORM_VIDEOS = 30;
const MIN_TRAIT_BREAKOUTS = 4;
const MIN_LIFT = 1.3;

export interface PlaybookFinding {
  dimension: string;     // "Format" | "Length" | "Sound" | "Posting window" | "Title" | "Topic tag"
  trait: string;         // plain-English trait
  lift: number;          // how much more often breakouts carry it vs everyone
  breakoutShare: number; // 0-1 among breakouts
  baseShare: number;     // 0-1 among all videos
  n: number;             // breakouts carrying the trait
}

export interface PlaybookExample {
  title: string;
  channel: string;
  multiple: number;      // ×N vs their channel median
  views: number;
}

export interface PlatformPlaybook {
  platform: Platform;
  videos: number;        // videos with a usable channel baseline
  channels: number;
  breakouts: number;
  findings: PlaybookFinding[];
  examples: PlaybookExample[];   // top breakouts by multiple
  thin: boolean;         // true → render "still collecting"
}

const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  "challenge": "Challenge format",
  "educational": "Teach-something format",
  "controversy": "Hot-take / controversy angle",
  "data-proof": "Numbers-on-screen proof",
  "emotional": "Emotional story",
  "reaction": "Reaction format",
  "trend-riding": "Rides a current trend",
  "comparison": "X-vs-Y comparison",
  "myth-busting": "Myth-busting angle",
  "behind-scenes": "Behind-the-scenes",
  "list-ranking": "List / ranking",
  "utility": "Practical how-to",
};

interface Tagged {
  entry: ReferenceEntry;
  breakout: boolean;
  multiple: number;
  traits: Array<[string, string]>; // [dimension, trait]
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function durationTrait(platform: Platform, secs: number | undefined): string | null {
  if (!secs || secs <= 0) return null;
  if (platform === "youtube") {
    if (secs < 300) return "Under 5 minutes";
    if (secs < 900) return "5–15 minutes";
    return "Over 15 minutes";
  }
  if (secs <= 15) return "Ultra-short (≤15s)";
  if (secs <= 30) return "15–30s";
  if (secs <= 60) return "30–60s";
  return "Over 60s";
}

function hourTrait(publishedAt: string | undefined): string | null {
  if (!publishedAt) return null;
  const t = new Date(publishedAt);
  if (!Number.isFinite(t.getTime())) return null;
  const h = t.getUTCHours();
  if (h < 6) return "Posted 00–06 UTC";
  if (h < 12) return "Posted 06–12 UTC";
  if (h < 18) return "Posted 12–18 UTC";
  return "Posted 18–24 UTC";
}

function titleTraits(title: string): string[] {
  const out: string[] = [];
  if (/\d/.test(title)) out.push("Number in the title");
  if (/[?¿]/.test(title)) out.push("Question title");
  if (/[$€£]\s?\d|\d+\s?(k|K)\b/.test(title)) out.push("Money amount in the title");
  if (/\p{Extended_Pictographic}/u.test(title)) out.push("Emoji in the title");
  if (/\b[A-Z]{3,}\b/.test(title)) out.push("ALL-CAPS word");
  return out;
}

function traitsFor(platform: Platform, e: ReferenceEntry): Array<[string, string]> {
  const traits: Array<[string, string]> = [];
  for (const a of e.archetypes ?? []) {
    const label = ARCHETYPE_LABELS[a];
    if (label) traits.push(["Format", label]);
  }
  const dur = durationTrait(platform, e.durationSeconds);
  if (dur) traits.push(["Length", dur]);
  const hour = hourTrait(e.publishedAt);
  if (hour) traits.push(["Posting window", hour]);
  if (platform === "tiktok" && typeof e.soundOriginal === "boolean") {
    traits.push(["Sound", e.soundOriginal ? "Original sound" : "Trending / licensed audio"]);
  }
  for (const t of titleTraits(e.name ?? "")) traits.push(["Title", t]);
  for (const tag of (e.tags ?? []).slice(0, 6)) {
    if (tag.length >= 3) traits.push(["Topic tag", `#${tag.toLowerCase()}`]);
  }
  return traits;
}

export function minePlaybook(entries: ReferenceEntry[], platform: Platform): PlatformPlaybook {
  const vids = entries.filter(
    (e) => e.type === "video" && e.platform === platform && typeof e.metrics.views === "number" && e.metrics.views! > 0,
  );
  const byChannel = new Map<string, ReferenceEntry[]>();
  for (const e of vids) {
    const arr = byChannel.get(e.channelId) ?? [];
    arr.push(e);
    byChannel.set(e.channelId, arr);
  }

  const tagged: Tagged[] = [];
  let channels = 0;
  for (const channelVids of byChannel.values()) {
    if (channelVids.length < MIN_CHANNEL_VIDEOS) continue;
    const med = median(channelVids.map((e) => e.metrics.views!));
    if (med <= 0) continue;
    channels++;
    for (const e of channelVids) {
      const multiple = e.metrics.views! / med;
      tagged.push({ entry: e, breakout: multiple >= BREAKOUT_MIN_X, multiple, traits: traitsFor(platform, e) });
    }
  }

  const breakouts = tagged.filter((t) => t.breakout);
  const thin = tagged.length < MIN_PLATFORM_VIDEOS || breakouts.length < MIN_TRAIT_BREAKOUTS;

  // Trait prevalence: breakouts vs everyone (same channels, so channel-size
  // bias cancels at first order).
  const findings: PlaybookFinding[] = [];
  if (!thin) {
    const key = (d: string, t: string) => `${d}\u001F${t}`;
    const inBreakouts = new Map<string, number>();
    const inAll = new Map<string, number>();
    for (const t of tagged) {
      const seen = new Set<string>();
      for (const [d, tr] of t.traits) {
        const k = key(d, tr);
        if (seen.has(k)) continue; // count each trait once per video
        seen.add(k);
        inAll.set(k, (inAll.get(k) ?? 0) + 1);
        if (t.breakout) inBreakouts.set(k, (inBreakouts.get(k) ?? 0) + 1);
      }
    }
    for (const [k, nB] of inBreakouts.entries()) {
      if (nB < MIN_TRAIT_BREAKOUTS) continue;
      const nA = inAll.get(k) ?? 0;
      const breakoutShare = nB / breakouts.length;
      const baseShare = nA / tagged.length;
      if (baseShare <= 0 || baseShare > 0.9) continue; // universal traits teach nothing
      const lift = breakoutShare / baseShare;
      if (lift < MIN_LIFT) continue;
      const [dimension, trait] = k.split("\u001F");
      findings.push({
        dimension, trait,
        lift: Math.round(lift * 10) / 10,
        breakoutShare: Math.round(breakoutShare * 100) / 100,
        baseShare: Math.round(baseShare * 100) / 100,
        n: nB,
      });
    }
    findings.sort((a, b) => b.lift - a.lift || b.n - a.n);
  }

  const examples: PlaybookExample[] = breakouts
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, 5)
    .map((t) => ({
      title: (t.entry.name ?? "").slice(0, 70),
      channel: t.entry.channelName,
      multiple: Math.round(t.multiple * 10) / 10,
      views: t.entry.metrics.views!,
    }));

  return { platform, videos: tagged.length, channels, breakouts: breakouts.length, findings: findings.slice(0, 12), examples, thin };
}

/** Compose a copy-paste creative brief from a platform's top findings. */
export function composeBrief(pb: PlatformPlaybook, platformLabel: string): string {
  const top = pb.findings.slice(0, 6);
  const lines = [
    `CONTENT BRIEF — what breaks out on ${platformLabel} in this niche`,
    `(mined from ${pb.breakouts} breakout videos across ${pb.channels} creators; lift = how much more often breakouts do it)`,
    "",
    ...top.map((f) => `• ${f.trait} — ${f.lift}× more common in breakouts (${f.n} of them do it)`),
    "",
    "Steal the format, not the video:",
    ...pb.examples.slice(0, 3).map((e) => `• "${e.title}" — ${e.channel}, ×${e.multiple} their normal`),
    "",
    "Non-negotiables: hook in the first 2 seconds · watchable to the end · post it and send us the link the same day.",
  ];
  return lines.join("\n");
}
