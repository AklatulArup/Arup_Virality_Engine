// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — FundedNext Intel shell (from Dashboard.html bundle)
// ═══════════════════════════════════════════════════════════════════════════
//
// Exported centrally so the shell + every page + ForecastPanel share one
// palette. Matches `app-data.jsx` from the Claude Design handoff:
// darker near-black base, desaturated accents, IBM Plex Mono labels, IBM
// Plex Sans prose.

import type { Platform } from "./forecast";

export const T = {
  // Base
  bg:        "#0B0C0E",
  bgDeep:    "#07080A",
  bgPanel:   "#101216",
  bgPanelHi: "#14171C",
  bgRow:     "rgba(255,255,255,0.02)",
  bgRowHi:   "rgba(255,255,255,0.04)",

  // Lines
  line:       "rgba(255,255,255,0.06)",
  lineMid:    "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.16)",

  // Ink
  ink:      "#E8E6E1",
  inkDim:   "#B5B2AB",
  inkMuted: "#7E7B75",
  inkFaint: "#55534E",
  inkGhost: "#34332F",

  // Accents (desaturated) — each has a solid + `Dim` background (14% alpha).
  red:     "#E4574E", redDim:    "rgba(228,87,78,0.14)",
  pink:    "#D96AA5", pinkDim:   "rgba(217,106,165,0.14)",
  cyan:    "#2ECFD9", cyanDim:   "rgba(46,207,217,0.14)",
  purple:  "#9B87E8", purpleDim: "rgba(155,135,232,0.14)",
  gray:    "#9E9C97", grayDim:   "rgba(158,156,151,0.14)",
  green:   "#2ECC8A", greenDim:  "rgba(46,204,138,0.14)",
  amber:   "#F0B35A", amberDim:  "rgba(240,179,90,0.14)",
  blue:    "#60A5FA", blueDim:   "rgba(96,165,250,0.14)",
  white:   "#E8E6E1",
} as const;

// Platform branding — matches Dashboard.html design bundle.
export interface PlatformBrand {
  id:    string;
  code:  string;
  label: string;
  short: string;
  color: string;
  bg:    string;
  icon:  string;
}

export const PLATFORMS: Record<Platform, PlatformBrand> = {
  youtube:       { id: "youtube",       code: "YTL", label: "YouTube Long-form", short: "YouTube", color: T.red,    bg: T.redDim,    icon: "▶" },
  youtube_short: { id: "youtube_short", code: "YTS", label: "YouTube Shorts",    short: "Shorts",  color: T.pink,   bg: T.pinkDim,   icon: "⚡" },
  tiktok:        { id: "tiktok",        code: "TTK", label: "TikTok",            short: "TikTok",  color: T.cyan,   bg: T.cyanDim,   icon: "♪" },
  instagram:     { id: "instagram",     code: "IGR", label: "Instagram Reels",   short: "Reels",   color: T.purple, bg: T.purpleDim, icon: "◈" },
  x:             { id: "x",             code: "X",   label: "X (Twitter)",       short: "X",       color: T.gray,   bg: T.grayDim,   icon: "𝕏" },
};

// Analysis Modes A-H + OLR — mirrors the sidebar mode grid.
export interface AnalysisMode {
  id:    string;
  label: string;
  color: string;
  desc:  string;
}

export const MODES: AnalysisMode[] = [
  { id: "A",   label: "Platform Education", color: T.blue,   desc: "How algorithms work" },
  { id: "B",   label: "Continuous Update",  color: T.green,  desc: "Latest algorithm changes" },
  { id: "C",   label: "Outlier Detection",  color: T.purple, desc: "Why content outperformed" },
  { id: "D",   label: "Reverse Engineer",   color: T.red,    desc: "Break down virality" },
  { id: "E",   label: "Competitor Intel",   color: T.amber,  desc: "Competitor strategies" },
  { id: "F",   label: "URL Analysis",       color: T.cyan,   desc: "Full viral breakdown" },
  { id: "G",   label: "VRS Score",          color: T.pink,   desc: "Viral readiness 0-100%" },
  { id: "H",   label: "Intel Update",       color: T.gray,   desc: "Update knowledge base" },
  { id: "OLR", label: "Outlier",            color: T.green,  desc: "Cross-check outliers" },
];

// Route tokens — localStorage-persisted string.
export type ShellRoute =
  | "landing"
  | "reverse"
  | "bulk"
  | "calendar"
  | "libraries"
  | "reference"
  | "forecast"
  | "history"
  | "calibration";
