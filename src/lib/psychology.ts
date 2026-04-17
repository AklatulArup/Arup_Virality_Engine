/**
 * Psychology + Sentiment Intelligence Engine
 * 
 * The algorithm measures what humans do. This module explains WHY they do it,
 * and scores content against the psychological mechanisms that drive each signal.
 * 
 * Sources: Berger & Milkman (2012) arousal-action chain, Zeigarnik effect,
 *          peak-end rule, social currency theory, platform-specific behavioural research.
 */

import { analyzeSentiment } from "./sentiment";
import type { VideoData } from "./types";

// ─── EMOTION TYPES ────────────────────────────────────────────────────────

export type EmotionType =
  | "awe"         // "I need to show someone this" — expands perceived world
  | "outrage"     // "This needs to be seen" — moral elevation, virtue signal
  | "anxiety"     // "This could affect me" — threat detection, urgency
  | "amusement"   // "This will make them laugh" — social bonding
  | "validation"  // "This is exactly how I feel" — identity affirmation
  | "curiosity"   // "I need to know how this ends" — Zeigarnik tension
  | "inspiration" // "This makes me want to act" — self-efficacy boost
  | "neutral";

export type PsychArchetype =
  | "challenge_doc"    // Day N series — creates investment, identity, FOMO
  | "proof_reveal"     // Payout/cert shown upfront — authority + aspiration
  | "rule_breakdown"   // Educational with specific rule — save-worthy utility
  | "mistake_reveal"   // "I failed and here's why" — highest completion archetype
  | "market_reaction"  // Timely event-driven — recency × spread
  | "identity_mirror"  // "Me as a trader" — tribal belonging, validation
  | "myth_bust"        // Challenges existing belief — outrage/curiosity hybrid
  | "comparison"       // A vs B — controversy + save (reference utility)
  | "unknown";

export interface EmotionScore {
  dominant: EmotionType;
  secondary: EmotionType | null;
  scores: Record<EmotionType, number>; // 0-1
  shareabilityDriver: string;          // what psychological mechanism drives sharing
  retentionDriver: string;             // what keeps viewers watching
  completionRisk: string;             // what might cause early exits
}

export interface PsychologyScore {
  // 0-100 overall psychological readiness score
  score: number;

  // Primary archetype detected
  archetype: PsychArchetype;
  archetypeLabel: string;
  archetypeRationale: string;

  // Emotion analysis
  emotion: EmotionScore;

  // Platform-specific psychological fit (0-1)
  platformFit: {
    tiktok: number;       // completion + loop + DM send drivers
    instagram: number;    // DM send + save drivers
    youtube_short: number; // V_vs + external share drivers
    youtube: number;      // AVD + satisfaction drivers
  };

  // Signal predictions from psychology
  predictedSignals: {
    completionLikely: boolean;
    saveLikely: boolean;
    shareLikely: boolean;
    dmSendLikely: boolean;
    commentLikely: boolean;
    followLikely: boolean;
  };

  // Actionable fixes
  psychGaps: string[];
  emotionalArcScore: number; // 0-100 — how well the content follows the 3-beat arc
}

export interface CommentPsychologyAnalysis {
  // Seven archetype distribution from social-sentiment-intelligence.md
  archetypes: {
    validating: number;     // "This is exactly what I needed"
    challenging: number;    // "This worked for me but..."
    skeptical: number;      // "This seems too good to be true"
    painAmplifying: number; // "I've tried this and it never works"
    statusDriven: number;   // Showing off knowledge, correcting details
    tribal: number;         // Inside jokes, community references
    conversion: number;     // "Just signed up", "where do I start?"
  };
  dominant: string;
  sentimentTrajectory: "improving" | "stable" | "declining";
  volumeQualitySignal: "volume_and_quality" | "volume_only" | "quality_only" | "neither";
  trustSignal: "building" | "stable" | "eroding";
  viralReadinessFromComments: number; // 0-100
  actionableInsight: string;
}

// ─── ARCHETYPE DETECTION ──────────────────────────────────────────────────

function detectArchetype(d: VideoData): PsychArchetype {
  const title = (d.title ?? "").toLowerCase();
  const tags  = (d.tags ?? []).join(" ").toLowerCase();
  const text  = `${title} ${tags}`;

  // Day N challenge documentation
  if (/day \d+|week \d+|challenge (day|update|progress)|passed|failed the/.test(text)) return "challenge_doc";
  // Proof/payout reveal
  if (/\$[\d,]+|payout|funded|passed|certificate|made money|profit/.test(text) && /reveal|show|got|earned|made/.test(text)) return "proof_reveal";
  // Mistake/failure content
  if (/mistake|fail|wrong|blew|lost|error|broke|destroyed|ruined/.test(text)) return "mistake_reveal";
  // Rule breakdown
  if (/rule|tip|how to|guide|strategy|drawdown|risk|limit|avoid|never|always/.test(text)) return "rule_breakdown";
  // Market reaction
  if (/crash|dump|pump|breaking|news|today|market|nfp|cpi|fed|rate|fomc/.test(text)) return "market_reaction";
  // Myth bust
  if (/actually|truth|reality|wrong about|stop|myth|lie|honest|real talk/.test(text)) return "myth_bust";
  // Comparison
  if (/vs|versus|or|compare|best|worst|which|between/.test(text)) return "comparison";
  // Identity mirror
  if (/trader life|day in the life|my routine|being a|life as|becoming/.test(text)) return "identity_mirror";
  return "unknown";
}

const ARCHETYPE_LABELS: Record<PsychArchetype, string> = {
  challenge_doc:  "Challenge Documentation (Day N series)",
  proof_reveal:   "Proof / Payout Reveal",
  rule_breakdown: "Rule Breakdown (Educational/Save-worthy)",
  mistake_reveal: "Mistake / Failure Reveal",
  market_reaction:"Market Event Reaction",
  identity_mirror:"Identity Mirror (Trader Life)",
  myth_bust:      "Myth Bust / Contrarian",
  comparison:     "Comparison / A vs B",
  unknown:        "Unclassified",
};

// ─── EMOTION SCORING ──────────────────────────────────────────────────────
// Scores 0-1 per emotion based on content signals
// Source: Berger & Milkman (2012) + platform-specific emotional research

function scoreEmotions(d: VideoData, archetype: PsychArchetype): EmotionScore {
  const title = (d.title ?? "").toLowerCase();
  const likeRate    = (d.likes / Math.max(1, d.views)) * 100;
  const commentRate = (d.comments / Math.max(1, d.views)) * 100;
  const shareRate   = ((d.shares ?? 0) / Math.max(1, d.views)) * 100;

  const scores: Record<EmotionType, number> = {
    awe:        0, outrage:    0, anxiety:     0,
    amusement:  0, validation: 0, curiosity:   0,
    inspiration:0, neutral:    0,
  };

  // Awe: big numbers, surprising results, scale content
  if (/\$[\d,]+|\d{4,}|insane|unbelievable|crazy|mind/.test(title)) scores.awe = 0.8;
  if (archetype === "proof_reveal") scores.awe = Math.max(scores.awe, 0.75);

  // Anxiety: risk, warning, loss content
  if (/mistake|fail|avoid|warning|wrong|lose|blow|risk/.test(title)) scores.anxiety = 0.8;
  if (archetype === "mistake_reveal") scores.anxiety = Math.max(scores.anxiety, 0.75);

  // Curiosity: questions, cliffhangers, "find out why"
  if (/\?|why|how|secret|truth|actually|what happens|you think/.test(title)) scores.curiosity = 0.75;
  if (archetype === "myth_bust") scores.curiosity = Math.max(scores.curiosity, 0.7);

  // Validation: "me too", relatable, identity
  if (/day in the life|trader life|every trader|we all|relatable/.test(title)) scores.validation = 0.75;
  if (archetype === "identity_mirror") scores.validation = Math.max(scores.validation, 0.75);
  if (likeRate >= 5) scores.validation = Math.max(scores.validation, 0.6); // high likes = resonance

  // Outrage: myth bust, controversy, "they don't tell you"
  if (/they don.t|nobody tells|stop|real truth|actually|scam|lie/.test(title)) scores.outrage = 0.7;
  if (archetype === "myth_bust") scores.outrage = Math.max(scores.outrage, 0.65);

  // Inspiration: achievement, transformation, "you can too"
  if (/passed|funded|achieved|made it|finally|quit my|freedom/.test(title)) scores.inspiration = 0.75;
  if (archetype === "proof_reveal") scores.inspiration = Math.max(scores.inspiration, 0.65);

  // Amusement: entertainment signals
  if (commentRate >= 1 && shareRate >= 0.5) scores.amusement = 0.5; // high comment+share = entertainment

  // Neutral fallback
  if (Math.max(...Object.values(scores)) < 0.3) scores.neutral = 0.8;

  // Find dominant and secondary
  const sorted = (Object.entries(scores) as [EmotionType, number][])
    .sort((a, b) => b[1] - a[1]);
  const dominant  = sorted[0][0];
  const secondary = sorted[1][1] >= 0.4 ? sorted[1][0] : null;

  // Shareability and retention drivers based on dominant emotion
  // Source: Berger & Milkman arousal-action chain + platform mechanics
  const shareDrivers: Record<EmotionType, string> = {
    awe:         "Awe creates 'I need to show someone this' impulse — expands perceived world of the viewer. DM sends and external shares.",
    outrage:     "Outrage creates 'this needs to be seen' impulse — moral elevation. Public shares and reply chains (X). Retweets on principle.",
    anxiety:     "Anxiety creates 'this could affect me' threat-detection response — saves and DM sends to warn specific people.",
    amusement:   "Amusement creates social bonding currency — 'this will make them laugh.' Tag-a-friend comments and DM sends.",
    validation:  "Validation creates identity affirmation — 'this is me.' Saves ('I want to keep this') and DMs to tribe members ('this is us').",
    curiosity:   "Curiosity creates Zeigarnik tension — open loops prevent exit. Completion and rewatches. Comments asking for more.",
    inspiration: "Inspiration creates self-efficacy boost — 'I can do this.' Follow/subscribe and link clicks (want to act).",
    neutral:     "Neutral content is consumed and forgotten. No strong sharing impulse. Needs emotional amplification.",
  };

  const retentionDrivers: Record<EmotionType, string> = {
    awe:         "Sustained awe requires escalation — the reveal needs to keep getting bigger or more unexpected. Pattern interrupts every 20-30s.",
    outrage:     "Outrage sustains through evidence stacking — each new piece of evidence deepens the emotional state. Don't resolve early.",
    anxiety:     "Anxiety sustains through unresolved threat — keep the 'this could happen to you' open until near the end. Resolution = relief = stay.",
    amusement:   "Amusement sustains through comedic escalation and subverted expectations. Each beat needs to be funnier than the last.",
    validation:  "Validation sustains through accumulated 'yes, exactly' moments. Each new point that resonates extends stay time.",
    curiosity:   "Curiosity sustains through the Zeigarnik effect — open loops stack. Never close a loop before opening the next.",
    inspiration: "Inspiration sustains through demonstration of possibility. Specificity (real numbers, real timeline) is the retention mechanism.",
    neutral:     "Neutral content retains through pure information density — no emotion, so information must be maximally useful per second.",
  };

  const completionRisks: Record<EmotionType, string> = {
    awe:         "Awe collapses if the reveal is delayed too long. If the 'insane result' isn't shown within 15s, viewers leave before seeing it.",
    outrage:     "Outrage collapses if the creator over-hedges, adds too many caveats, or fails to take a clear position.",
    anxiety:     "Anxiety resolves too early — if viewers feel safe before the content is done, they exit. Keep the threat live longer than feels comfortable.",
    amusement:   "Amusement dies on timing failure. Pacing issues, too much setup, or a flat punchline kills completion.",
    validation:  "Validation fails if the content pivots to selling too early. The moment viewers feel sold to, the identity mirror breaks.",
    curiosity:   "Curiosity collapses if the open loop is too abstract (\"find out why\" without a clear payoff) or if it's resolved too quickly.",
    inspiration: "Inspiration fails if it's vague. 'You can do it' without a specific demonstration of HOW doesn't move people.",
    neutral:     "Neutral content has no emotional anchor to hold viewers. Every dull moment = permanent exit risk.",
  };

  return {
    dominant, secondary, scores,
    shareabilityDriver: shareDrivers[dominant],
    retentionDriver:    retentionDrivers[dominant],
    completionRisk:     completionRisks[dominant],
  };
}

// ─── PLATFORM FIT FROM PSYCHOLOGY ────────────────────────────────────────
// Maps emotion + archetype to platform-specific signal likelihood
// Source: Arousal-to-mechanic matching from behavioural-psychology.md section 11

function scorePlatformFit(
  emotion: EmotionScore,
  archetype: PsychArchetype
): PsychologyScore["platformFit"] {
  const e = emotion.scores;

  return {
    // TikTok: completion + loop + DM (anxiety/curiosity drive completion; validation drives DM)
    tiktok: Math.min(1,
      e.curiosity  * 0.30 +
      e.anxiety    * 0.25 +
      e.validation * 0.20 +
      e.amusement  * 0.15 +
      (archetype === "challenge_doc" ? 0.10 : 0) +
      (archetype === "mistake_reveal" ? 0.10 : 0)
    ),

    // Instagram: DM send + save (validation/anxiety drive DM; anxiety/curiosity drive save)
    instagram: Math.min(1,
      e.validation * 0.30 +
      e.anxiety    * 0.25 +
      e.curiosity  * 0.20 +
      e.awe        * 0.15 +
      (archetype === "rule_breakdown" ? 0.10 : 0) +
      (archetype === "proof_reveal"   ? 0.10 : 0)
    ),

    // YouTube Shorts: V_vs + external share (awe/outrage drive external shares; curiosity drives V_vs)
    youtube_short: Math.min(1,
      e.awe        * 0.30 +
      e.outrage    * 0.20 +
      e.curiosity  * 0.25 +
      e.anxiety    * 0.15 +
      (archetype === "market_reaction" ? 0.10 : 0)
    ),

    // YouTube LF: AVD + satisfaction (inspiration/curiosity sustain AVD; validation drives satisfaction)
    youtube: Math.min(1,
      e.inspiration * 0.30 +
      e.curiosity   * 0.25 +
      e.validation  * 0.20 +
      e.awe         * 0.15 +
      (archetype === "rule_breakdown"  ? 0.10 : 0) +
      (archetype === "challenge_doc"   ? 0.05 : 0)
    ),
  };
}

// ─── PREDICTED SIGNALS FROM PSYCHOLOGY ───────────────────────────────────

function predictSignals(
  emotion: EmotionScore,
  archetype: PsychArchetype,
  d: VideoData
): PsychologyScore["predictedSignals"] {
  const e  = emotion.scores;
  const lr = (d.likes / Math.max(1, d.views)) * 100;

  return {
    // Completion: curiosity + anxiety sustain viewing
    completionLikely: (e.curiosity + e.anxiety) > 0.8 || archetype === "mistake_reveal",
    // Save: anxiety + validation + rule_breakdown = reference utility
    saveLikely:       (e.anxiety + e.validation) > 0.9 || archetype === "rule_breakdown",
    // Share: awe + outrage = highest public share drivers
    shareLikely:      (e.awe + e.outrage) > 0.9 || archetype === "market_reaction",
    // DM send: validation + anxiety = personal forward impulse
    dmSendLikely:     (e.validation + e.anxiety) > 0.9 || archetype === "proof_reveal",
    // Comment: outrage + curiosity + myth_bust = opinion expression
    commentLikely:    (e.outrage + e.curiosity) > 0.8 || archetype === "myth_bust",
    // Follow: inspiration + challenge_doc = want more from this creator
    followLikely:     e.inspiration > 0.6 || archetype === "challenge_doc" || lr >= 5,
  };
}

// ─── EMOTIONAL ARC SCORE ─────────────────────────────────────────────────
// Scores how well the content follows the 3-beat arc for short-form
// Source: emotional-arc-framework from behavioural-psychology.md section 9

function scoreEmotionalArc(d: VideoData, emotion: EmotionScore): number {
  const title  = (d.title ?? "").toLowerCase();
  const dur    = d.durationSeconds;
  const lr     = (d.likes / Math.max(1, d.views)) * 100;
  const cr     = (d.comments / Math.max(1, d.views)) * 100;
  let score    = 0;

  // Beat 1: Hook / Disruption — does the title create unresolved tension?
  const hasOpenLoop = /\?|why|how|truth|actually|secret|never|stop|wrong/.test(title);
  const hasNumber   = /\$[\d,]+|\d+%|\d+ (day|week|month|second|minute)/.test(title);
  const hasPattern  = /\b(i |this |the |my )\w+/.test(title.slice(0, 40));
  if (hasOpenLoop || hasNumber) score += 35;
  else if (hasPattern) score += 20;

  // Beat 2: Delivery — engagement quality signals sustained delivery
  if (lr >= 5 && cr >= 0.5) score += 35; // both signal strong content delivery
  else if (lr >= 3 || cr >= 0.3) score += 20;
  else if (lr >= 1) score += 10;

  // Beat 3: Emotional residue — what do they carry away?
  // High emotion dominant = strong residue
  const maxEmotion = Math.max(...Object.values(emotion.scores));
  score += Math.round(maxEmotion * 30);

  // Duration bonus for short-form: 15-60s optimal for the 3-beat arc
  if (dur > 0 && dur >= 15 && dur <= 60) score = Math.min(100, score + 5);

  return Math.min(100, score);
}

// ─── PSYCHOLOGY GAP ANALYSIS ──────────────────────────────────────────────

function identifyPsychGaps(
  emotion: EmotionScore,
  predicted: PsychologyScore["predictedSignals"],
  archetype: PsychArchetype
): string[] {
  const gaps: string[] = [];

  if (emotion.dominant === "neutral") {
    gaps.push("No dominant emotion detected — content is informational but flat. Add one emotional anchor: a specific dollar amount, a personal failure moment, or a surprising rule that 'nobody talks about.'");
  }

  if (!predicted.completionLikely) {
    gaps.push(`Completion risk: ${emotion.completionRisk} Address this before publishing.`);
  }

  if (!predicted.shareLikely && !predicted.dmSendLikely) {
    gaps.push("Neither share nor DM impulse detected. Add a moment that creates arousal — the physiological state that precedes sharing. Awe (big number), outrage (something wrong), or validation ('this is us') are the three highest-arousal states for prop trading content.");
  }

  if (!predicted.saveLikely && archetype !== "market_reaction" && archetype !== "challenge_doc") {
    gaps.push("Low save likelihood. Add one piece of specific reference information — a specific rule number, a specific percentage, or a specific formula — that viewers will want to bookmark.");
  }

  if (archetype === "unknown") {
    gaps.push("No clear content archetype detected. The most viral prop trading archetypes are: (1) Payout reveal, (2) Mistake reveal, (3) Rule breakdown, (4) Challenge Day N. Align to one before publishing.");
  }

  return gaps;
}

// ─── COMMENT PSYCHOLOGY ANALYSIS ─────────────────────────────────────────
// Source: The Seven Comment Archetypes from social-sentiment-intelligence.md section 2

function classifyCommentArchetypes(text: string): keyof CommentPsychologyAnalysis["archetypes"] {
  const t = text.toLowerCase();

  // Conversion signals (highest value — action taken)
  if (/signed up|joining|just tried|how do i|where.s the link|link|start/.test(t)) return "conversion";
  // Pain amplification
  if (/never works|always fail|keep losing|can.t|struggling|desperate|help|stuck/.test(t)) return "painAmplifying";
  // Tribal markers
  if (/we|us|our|lol|bro|ngl|fr|same|same bro|relatable/.test(t)) return "tribal";
  // Skeptical
  if (/really|sure|legit|believe|proof|suspicious|too good|scam|seems/.test(t)) return "skeptical";
  // Status / correction
  if (/actually|technically|wrong|should be|you mean|correction|clarify/.test(t)) return "statusDriven";
  // Challenging
  if (/but|however|what about|tried this|worked for me but|alternative/.test(t)) return "challenging";
  // Default: validating
  return "validating";
}

export function analyzeCommentPsychology(
  descriptions: string[],
  commentCount: number,
  views: number
): CommentPsychologyAnalysis {
  const counts = {
    validating: 0, challenging: 0, skeptical: 0,
    painAmplifying: 0, statusDriven: 0, tribal: 0, conversion: 0,
  };

  for (const text of descriptions) {
    const archetype = classifyCommentArchetypes(text);
    counts[archetype]++;
  }

  const total = Math.max(1, descriptions.length);
  const archetypes = {
    validating:     Math.round(counts.validating     / total * 100),
    challenging:    Math.round(counts.challenging    / total * 100),
    skeptical:      Math.round(counts.skeptical      / total * 100),
    painAmplifying: Math.round(counts.painAmplifying / total * 100),
    statusDriven:   Math.round(counts.statusDriven   / total * 100),
    tribal:         Math.round(counts.tribal         / total * 100),
    conversion:     Math.round(counts.conversion     / total * 100),
  };

  // Dominant archetype
  const dominant = (Object.entries(counts) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  // Volume × quality signal
  const commentRate = (commentCount / Math.max(1, views)) * 100;
  const hasVolume   = commentRate >= 0.5;
  const hasQuality  = (counts.challenging + counts.painAmplifying + counts.conversion) > total * 0.15;
  const volumeQualitySignal: CommentPsychologyAnalysis["volumeQualitySignal"] =
    (hasVolume && hasQuality) ? "volume_and_quality" :
    hasVolume  ? "volume_only" :
    hasQuality ? "quality_only" : "neither";

  // Trust signal from skeptical + conversion ratio
  const trustSignal: CommentPsychologyAnalysis["trustSignal"] =
    counts.conversion > counts.skeptical * 2 ? "building" :
    counts.skeptical  > counts.validating * 0.3 ? "eroding" : "stable";

  // Viral readiness from comment psychology
  let viralReadiness = 0;
  if (counts.conversion > 0)     viralReadiness += 25; // Direct action = highest signal
  if (counts.painAmplifying > 0) viralReadiness += 20; // Suffering audience = shareable pain
  if (counts.tribal > 0)         viralReadiness += 20; // Tribal identity = DM send fodder
  if (counts.challenging > 0)    viralReadiness += 15; // Debate = reply chains
  if (counts.validating > total * 0.5) viralReadiness += 10; // Majority validation = safety
  if (counts.skeptical > total * 0.3)  viralReadiness -= 15; // High skepticism = trust gap

  // Sentiment trajectory (use title sentiment as proxy for comment trajectory)
  const sentimentTrajectory: CommentPsychologyAnalysis["sentimentTrajectory"] = 
    trustSignal === "building" ? "improving" :
    trustSignal === "eroding"  ? "declining" : "stable";

  const insightMap: Record<string, string> = {
    conversion:     "Conversion comments present — viewers are acting. This is the highest possible signal. DM the most specific conversion comments directly for testimonials.",
    painAmplifying: "Pain amplification comments dominate — audience is suffering and seeking solutions. This is prime content for a follow-up video addressing the specific pain expressed.",
    tribal:         "Strong tribal marker presence — community coherence is high. This content hit the identity layer. Replicate the relatable framing in the next video.",
    skeptical:      "Skeptical comments are dominant — trust gap exists. Address objections directly in a follow-up video. Specific proof (account screenshots, rule citations) closes this gap.",
    challenging:    "Challenge comments are dominant — intellectual engagement is high. This is the ideal comment type for algorithm (reply chains). Reply to every challenge with a specific counter-point.",
    statusDriven:   "Status-driven comments dominate — audience wants to demonstrate knowledge. Create more technically precise content that invites expert correction — status competition = engagement.",
    validating:     "Validation comments dominate — content resonated strongly with existing beliefs. To grow beyond the core audience, add one element of surprise or challenge to the next video.",
  };

  return {
    archetypes,
    dominant,
    sentimentTrajectory,
    volumeQualitySignal,
    trustSignal,
    viralReadinessFromComments: Math.min(100, Math.max(0, viralReadiness)),
    actionableInsight: insightMap[dominant] ?? "Continue current content strategy.",
  };
}

// ─── MAIN EXPORT: FULL PSYCHOLOGY SCORE ───────────────────────────────────

export function scorePsychology(d: VideoData): PsychologyScore {
  const archetype  = detectArchetype(d);
  const emotion    = scoreEmotions(d, archetype);
  const platformFit= scorePlatformFit(emotion, archetype);
  const predicted  = predictSignals(emotion, archetype, d);
  const psychGaps  = identifyPsychGaps(emotion, predicted, archetype);
  const emotionalArcScore = scoreEmotionalArc(d, emotion);

  // Overall psychology score: weighted combination
  const maxEmotion  = Math.max(...Object.values(emotion.scores).filter(v => v < 0.99));
  const predictedCount = Object.values(predicted).filter(Boolean).length;
  const score = Math.round(
    maxEmotion * 35 +           // emotional intensity
    (predictedCount / 6) * 35 + // signal prediction breadth
    (emotionalArcScore / 100) * 30
  );

  const archetypeRationales: Record<PsychArchetype, string> = {
    challenge_doc:   "Series psychology: investment builds over episodes. Viewers become personally invested in the outcome — they follow to see if YOU pass. FOMO on outcomes is the retention mechanism.",
    proof_reveal:    "Authority + aspiration psychology: showing the result first bypasses skepticism. The viewer's brain shifts from 'is this real?' to 'how did they do that?' — a much more engaged state.",
    rule_breakdown:  "Utility psychology: specific rules with specific numbers create save-worthy reference material. The save impulse is 'I can't memorise this — I'll need it later.' Anxiety reduction through information.",
    mistake_reveal:  "Vulnerability psychology: failure content is the highest-completion archetype across all platforms. Schadenfreude + 'this could happen to me' creates near-100% watch-through. Never cut the emotion short.",
    market_reaction: "Recency psychology: time-sensitive content activates urgency. The brain prioritises current threats and opportunities. First-mover advantage is massive — post within 2 hours of the event.",
    identity_mirror: "Tribal psychology: 'a day in the life of a trader' content lets viewers see themselves in the creator. High validation (like) rate and tribal comment markers. Best for community building.",
    myth_bust:       "Contrarian psychology: challenging existing beliefs creates cognitive dissonance that demands resolution. The viewer must watch to resolve the tension. Outrage if creator is wrong; relief if creator is right.",
    comparison:      "Decision psychology: comparison content is inherently reference-worthy (saves) and debate-worthy (comments). The 'I disagree with your ranking' comment type is algorithmically gold.",
    unknown:         "Archetype not detected. Content lacks clear psychological framing — review title and hook structure against the eight proven archetypes.",
  };

  return {
    score: Math.min(100, score),
    archetype,
    archetypeLabel:    ARCHETYPE_LABELS[archetype],
    archetypeRationale: archetypeRationales[archetype],
    emotion,
    platformFit,
    predictedSignals: predicted,
    psychGaps,
    emotionalArcScore,
  };
}

// Export sentiment for backwards compat
export { analyzeSentiment };
