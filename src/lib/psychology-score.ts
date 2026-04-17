/**
 * Psychological Trigger Scoring Engine
 * 
 * Maps the 9 viral emotions and 12 algorithm signals to their psychological drivers.
 * The algorithm measures what humans DO. This file scores WHY they do it.
 * 
 * Sources: Berger & Milkman (2012) arousal-sharing research, Heath & Heath (Made to Stick),
 *          Cialdini influence principles, platform psychology research 2023-2026,
 *          behavioural-psychology.md reference file.
 */

export type PsychTrigger =
  | "curiosity_gap"
  | "identity_signal"
  | "anxiety_fear"
  | "awe_wonder"
  | "validation"
  | "social_currency"
  | "utility_hoarding"
  | "tension_release"
  | "open_loop"
  | "pattern_interrupt"
  | "tribal_belonging"
  | "loss_aversion";

export type EmotionalResidueType =
  | "inspiration"    // → save + follow
  | "outrage"        // → public share
  | "validation"     // → DM share
  | "curiosity"      // → rewatch + comment
  | "amusement"      // → share + comment
  | "awe"            // → save + share
  | "anxiety"        // → save + DM share
  | "neutral";

export interface PsychScore {
  overall: number;                    // 0–100
  emotionalResidueType: EmotionalResidueType;
  residueStrength: number;            // 0–1
  triggers: {
    trigger: PsychTrigger;
    label: string;
    score: number;                    // 0–1
    platformWeight: number;           // how much this trigger matters on this platform
    evidence: string;
    algorithmSignal: string;          // which algorithm metric this drives
  }[];
  shareabilityScore: number;          // 0–100, likelihood someone DMs/shares this
  saveabilityScore: number;           // 0–100, likelihood someone saves this
  completionPullScore: number;        // 0–100, likelihood someone watches to end
  watchAgainScore: number;            // 0–100, likelihood someone replays
  topRecommendation: string;
}

// ─── Trigger detection from title + tags + description ───────────────────

const CURIOSITY_PATTERNS = [
  /truth about|nobody tells|won't believe|secret|exposed|what happened|watch till|didn't expect/i,
  /\?$/,
  /^(why|how|what|the reason|turns out|here's what)/i,
  /you don'?t know|most people don'?t|they never tell/i,
];
const IDENTITY_PATTERNS = [
  /funded trader|prop trader|i passed|i made|my payout|real trader|professional/i,
  /day \d+ of|challenge (day|week)|my journey/i,
  /pov:|when you|every trader|if you'?re a trader/i,
];
const ANXIETY_PATTERNS = [
  /you'?re (making|doing) (this )?mistake|stop doing|you'?re losing|danger|warning/i,
  /most fail|fail rate|blow(ing)? (the |your )?account|drawdown|losing streak/i,
  /before it'?s too late|don'?t do this|avoid this|watch before/i,
];
const AWE_PATTERNS = [
  /\$([\d,]+k?)|(\d+)%?\s+(profit|gain|return)|life.changing|incredible|insane results/i,
  /in \d+ days|overnight|just \d+ (trades|days)/i,
];
const VALIDATION_PATTERNS = [
  /relatable|felt this|same|every trader|we all|i feel (like )?this/i,
  /trader problems|this is me|literally|when you finally/i,
];
const UTILITY_PATTERNS = [
  /how to|guide|step.?by.?step|tutorial|tips|strategy|formula|rules|checklist|framework/i,
  /save this|you'?ll need|reference|cheat sheet|exact (strategy|plan|method)/i,
];
const OPEN_LOOP_PATTERNS = [
  /wait for it|plot twist|the ending|you won'?t believe how|what happens next/i,
  /part \d|continued|results in|until the end/i,
];
const SOCIAL_CURRENCY_PATTERNS = [
  /they don'?t want you to know|insider|exclusive|what (the )?(banks|institutions|pros)/i,
  /secret (strategy|formula|method)|only \d+%|most traders don'?t/i,
];

function detectTriggers(title: string, tags: string[], description: string): Record<PsychTrigger, number> {
  const text = `${title} ${tags.join(" ")} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  return {
    curiosity_gap:    CURIOSITY_PATTERNS.some(p => p.test(text)) ? (CURIOSITY_PATTERNS.some(p => p.test(titleLower)) ? 0.85 : 0.55) : 0.15,
    identity_signal:  IDENTITY_PATTERNS.some(p => p.test(text)) ? (IDENTITY_PATTERNS.some(p => p.test(titleLower)) ? 0.80 : 0.50) : 0.20,
    anxiety_fear:     ANXIETY_PATTERNS.some(p => p.test(text)) ? (ANXIETY_PATTERNS.some(p => p.test(titleLower)) ? 0.80 : 0.50) : 0.10,
    awe_wonder:       AWE_PATTERNS.some(p => p.test(text)) ? (AWE_PATTERNS.some(p => p.test(titleLower)) ? 0.85 : 0.55) : 0.10,
    validation:       VALIDATION_PATTERNS.some(p => p.test(text)) ? 0.70 : 0.15,
    social_currency:  SOCIAL_CURRENCY_PATTERNS.some(p => p.test(text)) ? 0.75 : 0.15,
    utility_hoarding: UTILITY_PATTERNS.some(p => p.test(text)) ? (UTILITY_PATTERNS.some(p => p.test(titleLower)) ? 0.85 : 0.60) : 0.20,
    tension_release:  (CURIOSITY_PATTERNS.some(p => p.test(text)) && ANXIETY_PATTERNS.some(p => p.test(text))) ? 0.75 : 0.25,
    open_loop:        OPEN_LOOP_PATTERNS.some(p => p.test(text)) ? 0.70 : 0.20,
    pattern_interrupt: (AWE_PATTERNS.some(p => p.test(text)) || CURIOSITY_PATTERNS.some(p => p.test(titleLower))) ? 0.70 : 0.25,
    tribal_belonging: IDENTITY_PATTERNS.some(p => p.test(text)) && VALIDATION_PATTERNS.some(p => p.test(text)) ? 0.80 : 0.20,
    loss_aversion:    ANXIETY_PATTERNS.some(p => p.test(text)) ? 0.75 : CURIOSITY_PATTERNS.some(p => p.test(text)) ? 0.40 : 0.15,
  };
}

// ─── Platform-specific trigger weights ────────────────────────────────────
//
// Different platforms amplify different psychological signals because of
// their audience's ambient emotional state and distribution mechanics.

const PLATFORM_TRIGGER_WEIGHTS: Record<string, Partial<Record<PsychTrigger, number>>> = {
  tiktok: {
    // TikTok: completion-first. Curiosity gaps + open loops keep people watching.
    // Identity/tribal content gets DM'd to specific people.
    curiosity_gap:     0.90,   // Open loops = rewatch loops = completion
    open_loop:         0.85,   // "Wait for it" endings drive rewatch
    identity_signal:   0.80,   // "This is me" = DM send to trading group
    tribal_belonging:  0.80,   // Trader community identity = DM share
    tension_release:   0.75,   // Anxiety → relief arc = completion pull
    awe_wonder:        0.70,   // Payout reveals = share to group
    validation:        0.70,   // Relatable content = DM to friends who get it
    anxiety_fear:      0.60,   // "You're making this mistake" = saves
    pattern_interrupt: 0.85,   // Frame 1 pattern interrupt = completion gate
    social_currency:   0.60,
    utility_hoarding:  0.55,
    loss_aversion:     0.60,
  },
  instagram: {
    // Instagram: DM-send + save driven. Utility + identity are the primary drivers.
    // People DM content that says something about them or is genuinely useful.
    utility_hoarding:  0.95,   // Saves = utility. Rules, formulas, checklists.
    tribal_belonging:  0.90,   // "Send this to whoever is starting a challenge"
    identity_signal:   0.85,   // "This is who I am as a trader"
    validation:        0.85,   // "This is exactly what I needed" = save + DM
    anxiety_fear:      0.75,   // "Before your next challenge" = save
    awe_wonder:        0.70,   // Payout reveals = save + DM
    social_currency:   0.65,   // Share as status signal
    curiosity_gap:     0.65,   // Drives watch time / 3-sec hold
    tension_release:   0.70,   // Anxiety → relief = save
    loss_aversion:     0.65,
    open_loop:         0.50,   // Less critical than TikTok (DMs not loops)
    pattern_interrupt: 0.80,   // 3-sec hook visual interrupt
  },
  youtube_short: {
    // Shorts: Frame 1 interrupt + loop design. External shares = WhatsApp/Discord.
    // "Send to trading group" = highest signal.
    pattern_interrupt: 0.95,   // Frame 1 IS the thumbnail — must arrest scroll
    open_loop:         0.90,   // Natural loop design = rewatch rate
    curiosity_gap:     0.85,   // Creates "one more watch" impulse
    tribal_belonging:  0.85,   // "Share to your trading group" = external share
    social_currency:   0.75,   // "Only serious traders know this"
    awe_wonder:        0.75,   // Payout reveal = external share
    tension_release:   0.75,   // Completion pull
    identity_signal:   0.70,
    anxiety_fear:      0.65,
    utility_hoarding:  0.70,   // Save for reference = description click
    validation:        0.60,
    loss_aversion:     0.65,
  },
  youtube: {
    // YouTube LF: AVD is 50% of formula. Curiosity gaps + tension keep people watching.
    // Social currency + utility = search + saves.
    tension_release:   0.95,   // The core of 8-20min retention architecture
    curiosity_gap:     0.90,   // Multiple open loops stacked across video
    utility_hoarding:  0.90,   // Save/search = lasting value
    social_currency:   0.80,   // "Only 1% of traders know this" = search intent
    anxiety_fear:      0.80,   // "You're making this mistake" = search + watch
    awe_wonder:        0.75,   // Results/proof drives satisfaction signal
    identity_signal:   0.70,   // Parasocial connection = subscribe + return
    loss_aversion:     0.75,   // Retention: "don't leave without knowing this"
    open_loop:         0.85,   // Chapter previews, "coming up at X:XX"
    pattern_interrupt: 0.70,   // Every 2-3 min retention reset
    validation:        0.65,
    tribal_belonging:  0.60,
  },
};

// ─── Emotional residue detection ────────────────────────────────────────

function detectEmotionalResidue(
  triggers: Record<PsychTrigger, number>
): { type: EmotionalResidueType; strength: number } {
  // The dominant trigger combination determines the residue emotion
  // Residue = what the viewer feels AFTER watching (drives sharing behavior)
  
  const scores = {
    inspiration: (triggers.awe_wonder * 0.5 + triggers.validation * 0.3 + triggers.identity_signal * 0.2),
    outrage:     (triggers.anxiety_fear * 0.6 + triggers.social_currency * 0.4) * 0.6,  // less relevant for trading
    validation:  (triggers.validation * 0.5 + triggers.tribal_belonging * 0.3 + triggers.identity_signal * 0.2),
    curiosity:   (triggers.curiosity_gap * 0.6 + triggers.open_loop * 0.4),
    amusement:   0.10,  // less relevant for serious trading content
    awe:         (triggers.awe_wonder * 0.7 + triggers.pattern_interrupt * 0.3),
    anxiety:     (triggers.anxiety_fear * 0.6 + triggers.loss_aversion * 0.4),
    neutral:     0.15,
  };

  const entries = Object.entries(scores) as [EmotionalResidueType, number][];
  const [type, strength] = entries.reduce((a, b) => b[1] > a[1] ? b : a);
  return { type, strength };
}

// ─── Platform-specific score contribution labels ─────────────────────────

const TRIGGER_LABELS: Record<PsychTrigger, string> = {
  curiosity_gap:     "Curiosity Gap / Open Loop",
  identity_signal:   "Identity Signal",
  anxiety_fear:      "Anxiety / Fear Trigger",
  awe_wonder:        "Awe / Wonder (Payout, Results)",
  validation:        "Validation / Relatability",
  social_currency:   "Social Currency / Exclusivity",
  utility_hoarding:  "Utility / Save-worthy Information",
  tension_release:   "Tension-Release Cycle",
  open_loop:         "Open Loop / Rewatch Design",
  pattern_interrupt: "Pattern Interrupt (Hook/Frame 1)",
  tribal_belonging:  "Tribal Belonging / Community",
  loss_aversion:     "Loss Aversion / Stakes",
};

const TRIGGER_ALGORITHM_SIGNALS: Record<PsychTrigger, string> = {
  curiosity_gap:     "Completion rate, rewatch rate",
  identity_signal:   "DM sends (TikTok/IG), follows, profile clicks",
  anxiety_fear:      "Saves, completion rate, search intent",
  awe_wonder:        "Shares, saves, external shares (Shorts)",
  validation:        "DM sends, saves, comment depth",
  social_currency:   "Public shares, retweets, external shares",
  utility_hoarding:  "Saves (Instagram 3x weight), description clicks",
  tension_release:   "Completion rate, AVD (YouTube LF 50% weight)",
  open_loop:         "Loop/rewatch rate (Shorts 30% weight), TikTok completion",
  pattern_interrupt: "V_vs (Shorts 50% weight), 3-sec hold (IG), Frame 1 (Shorts)",
  tribal_belonging:  "DM sends, group shares, external shares",
  loss_aversion:     "Completion rate, saves, click-through from thumbnail",
};

// ─── Shareability / Saveability score computation ─────────────────────────

function computeShareability(triggers: Record<PsychTrigger, number>, platform: string): number {
  // Sharing is driven by: awe, tribal belonging, social currency, validation
  const weights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  const shareDrivers: PsychTrigger[] = ["awe_wonder", "tribal_belonging", "social_currency", "validation", "anxiety_fear"];
  const score = shareDrivers.reduce((sum, t) => sum + (triggers[t] * (weights[t] ?? 0.5)), 0) / shareDrivers.length;
  return Math.round(Math.min(100, score * 120));
}

function computeSaveability(triggers: Record<PsychTrigger, number>, platform: string): number {
  // Saving is driven by: utility, anxiety, awe, loss aversion
  const weights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  const saveDrivers: PsychTrigger[] = ["utility_hoarding", "anxiety_fear", "loss_aversion", "awe_wonder", "tension_release"];
  const score = saveDrivers.reduce((sum, t) => sum + (triggers[t] * (weights[t] ?? 0.5)), 0) / saveDrivers.length;
  return Math.round(Math.min(100, score * 120));
}

function computeCompletionPull(triggers: Record<PsychTrigger, number>, platform: string): number {
  // Completion is driven by: open loops, tension-release, curiosity, pattern interrupt
  const weights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  const completionDrivers: PsychTrigger[] = ["open_loop", "tension_release", "curiosity_gap", "pattern_interrupt", "loss_aversion"];
  const score = completionDrivers.reduce((sum, t) => sum + (triggers[t] * (weights[t] ?? 0.5)), 0) / completionDrivers.length;
  return Math.round(Math.min(100, score * 115));
}

function computeWatchAgain(triggers: Record<PsychTrigger, number>, platform: string): number {
  // Rewatch driven by: open loops, curiosity gaps, hidden information
  const weights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  const rewatchDrivers: PsychTrigger[] = ["open_loop", "curiosity_gap", "awe_wonder", "social_currency", "validation"];
  const score = rewatchDrivers.reduce((sum, t) => sum + (triggers[t] * (weights[t] ?? 0.5)), 0) / rewatchDrivers.length;
  return Math.round(Math.min(100, score * 115));
}

// ─── Top recommendation ───────────────────────────────────────────────────

function buildRecommendation(
  triggers: Record<PsychTrigger, number>,
  residue: { type: EmotionalResidueType; strength: number },
  platform: string
): string {
  const weights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  
  // Find the biggest gap: high-weight trigger with low score
  const gaps = (Object.entries(triggers) as [PsychTrigger, number][])
    .map(([t, score]) => ({ trigger: t, score, weight: weights[t] ?? 0.3, gap: (weights[t] ?? 0.3) - score }))
    .filter(g => g.gap > 0.3)
    .sort((a, b) => b.gap - a.gap);

  if (gaps.length === 0) return "Psychological triggers are well-optimised for this platform. Focus on distribution mechanics.";

  const top = gaps[0].trigger;
  const recs: Record<PsychTrigger, string> = {
    curiosity_gap:     "Add an unresolved question or statement in the first 2 seconds. The brain physically cannot leave an open loop unresolved.",
    identity_signal:   "Make the viewer see themselves in the content. 'Funded traders know this' or 'If you're serious about passing...' signals tribe membership.",
    anxiety_fear:      "Raise the stakes. 'Most traders don't know this rule — and it cost me my first account' activates loss aversion before you've said anything teachable.",
    awe_wonder:        "Lead with your proof moment. The payout number, the funded certificate, the live trade result — this is your attention arrest device.",
    validation:        "Add a 'this is you' moment. Relatable pain points ('Day 14, one trade from failing') trigger the validation response that drives DM shares.",
    social_currency:   "Position the knowledge as exclusive. 'Only traders who've read the rule book know this' makes sharing feel like giving a gift.",
    utility_hoarding:  "Add a specific reference element — a rule, number, formula, or checklist. Concrete information earns saves; abstract inspiration doesn't.",
    tension_release:   "Build the arc: problem → stakes raised → resolution. Don't resolve too early. The viewer stays for the release, not the buildup.",
    open_loop:         "End the video so the opening makes more sense on rewatch. Plant a detail in the first 5 seconds that only pays off at the end.",
    pattern_interrupt: "The first frame must create visual friction. High-contrast number, unexpected chart shape, or face at an angle — before text is read.",
    tribal_belonging:  "Create a 'this is our thing' moment. Inside vocabulary, shared frustrations, community rituals. Make sharing feel like recognizing a fellow member.",
    loss_aversion:     "Frame the stakes as loss prevention, not gain. 'The one rule that prevents account blowouts' hits 2.5x harder than 'the one rule for growth.'",
  };

  return recs[top] ?? "No recommendation available.";
}

// ─── Main export ──────────────────────────────────────────────────────────

export function computePsychScore(
  title: string,
  tags: string[],
  description: string,
  platform: string
): PsychScore {
  const detectedTriggers = detectTriggers(title, tags, description);
  const platformWeights = PLATFORM_TRIGGER_WEIGHTS[platform] ?? PLATFORM_TRIGGER_WEIGHTS.youtube;
  const residue = detectEmotionalResidue(detectedTriggers);

  // Build scored trigger list (only triggers with meaningful platform weight)
  const scoredTriggers = (Object.entries(detectedTriggers) as [PsychTrigger, number][])
    .map(([trigger, score]) => {
      const platformWeight = platformWeights[trigger] ?? 0.3;
      const weightedScore = score * platformWeight;
      return {
        trigger,
        label: TRIGGER_LABELS[trigger],
        score: Math.round(score * 100) / 100,
        platformWeight,
        evidence: `Detected in ${title.length > 0 ? "title" : "tags/description"} | Algorithm impact: ${TRIGGER_ALGORITHM_SIGNALS[trigger]}`,
        algorithmSignal: TRIGGER_ALGORITHM_SIGNALS[trigger],
        _weighted: weightedScore,
      };
    })
    .filter(t => t.platformWeight >= 0.5)  // only show signals that matter on this platform
    .sort((a, b) => b._weighted - a._weighted)
    .map(({ _weighted: _, ...t }) => t);

  // Overall score: weighted average of top triggers × their platform relevance
  const topTriggers = scoredTriggers.slice(0, 5);
  const weightedSum = topTriggers.reduce((sum, t) => sum + t.score * t.platformWeight, 0);
  const totalWeight = topTriggers.reduce((sum, t) => sum + t.platformWeight, 0);
  const overall = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 30;

  return {
    overall: Math.min(100, overall),
    emotionalResidueType: residue.type,
    residueStrength: Math.round(residue.strength * 100) / 100,
    triggers: scoredTriggers.slice(0, 6),
    shareabilityScore:  computeShareability(detectedTriggers, platform),
    saveabilityScore:   computeSaveability(detectedTriggers, platform),
    completionPullScore: computeCompletionPull(detectedTriggers, platform),
    watchAgainScore:    computeWatchAgain(detectedTriggers, platform),
    topRecommendation:  buildRecommendation(detectedTriggers, residue, platform),
  };
}

// Residue → predicted signal mapping (for AI analysis context)
export const RESIDUE_SIGNAL_MAP: Record<EmotionalResidueType, string> = {
  inspiration: "Save + follow (viewer wants to return to this state). Best CTA: 'Follow to see the full challenge journey.'",
  outrage:     "Public share / retweet (moral elevation response). Best CTA: 'Send this to anyone being misled about X.'",
  validation:  "DM share to specific person (identity affirmation). Best CTA: 'Send this to whoever in your group feels this way.'",
  curiosity:   "Rewatch + comment (open loop drive). Best CTA: 'Comment the answer — let's see who knows.'",
  amusement:   "Share + comment (social bonding). Best CTA: 'Send this to your trading group.'",
  awe:         "Save + external share (world-expanding). Best CTA: 'Save this and share with your group — this took me months to figure out.'",
  anxiety:     "Save + DM share (threat protection). Best CTA: 'Save this before your next challenge session.'",
  neutral:     "Low sharing prediction. Content needs a stronger emotional design.",
};
