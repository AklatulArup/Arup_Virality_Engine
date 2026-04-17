/**
 * Comment Intelligence Engine
 * 
 * Analyses comment sections as virality prediction and content diagnostic tools.
 * 
 * The 7 comment archetypes from social-sentiment-intelligence.md, mapped to
 * algorithmic signals and content health indicators.
 * 
 * Key insight: Comments are not feedback — they are a real-time social survey,
 * tribal gathering, and sentiment seismograph. Reading them correctly gives more
 * actionable intelligence than any analytics dashboard.
 */

export type CommentArchetype =
  | "validating"       // "This is exactly what I needed" → save + DM share signal
  | "challenge"        // "This worked but..." → reply chain = strong algorithmic signal
  | "skeptic"          // "Is this legit?" → trust gap or opportunity
  | "pain_amplification" // "I keep failing" → highest resonance opportunity
  | "status"           // Knowledge-showing, corrections → expert engagement
  | "tribal_marker"    // Inside vocab, community references → tribal coherence
  | "conversion"       // "Just signed up", "link?" → direct conversion signal
  | "negative_flag"    // "Scam", "fake" → reputation/trust damage signal
  | "generic"          // "fire", "W", emoji-only → entertainment signal only
  | "question"         // "How do you..." → educational demand signal
  | "unknown";

export interface CommentSignal {
  archetype: CommentArchetype;
  label: string;
  count: number;
  percentage: number;
  algorithmImpact: string;
  contentSignal: string;
  viralityContribution: "high" | "medium" | "low" | "negative";
}

export interface CommentIntelligence {
  totalAnalyzed: number;
  dominantArchetype: CommentArchetype;
  dominantLabel: string;
  signals: CommentSignal[];
  // Derived scores
  conversionSignalStrength: number;   // 0–100: how many conversion-intent comments
  trustSignalStrength: number;        // 0–100: trust health (high skeptic = low trust)
  communitySignalStrength: number;    // 0–100: tribal coherence
  replyChainPotential: number;        // 0–100: how likely to generate reply chains
  // Predicted algorithm impact
  predictedDMShareBoost: number;      // 0–1 multiplier on baseline DM share rate
  predictedSaveBoost: number;         // 0–1 multiplier on baseline save rate
  // Trend signals
  dominantPainPoints: string[];       // most common pain words
  dominantDesires: string[];          // most common desire/aspiration words
  contentOpportunities: string[];     // gaps the comment section reveals
  // Sentiment trajectory
  sentimentTrajectory: "improving" | "stable" | "degrading";
  viralityDiagnosis: string;          // one-sentence read on what the comments mean
}

// ─── Comment classification patterns ─────────────────────────────────────

const ARCHETYPE_PATTERNS: Record<CommentArchetype, RegExp> = {
  validating:         /exactly what i needed|feel so seen|this is me|needed this|been looking for|finally someone|thank you for this|this helped me/i,
  challenge:          /worked for me but|what about|have you tried|curious about|does this work|tried this and|works even better if|alternative|instead of/i,
  skeptic:            /is this legit|seems too good|scam|is this real|really work|fake|doubt|not sure|skeptic|too easy|catch/i,
  pain_amplification: /keep failing|i always|never works for me|can'?t seem to|struggle with|my problem is|this is exactly my issue|relatable|story of my life/i,
  status:             /actually|technically|you forgot|minor correction|to be precise|as a professional|having traded|been trading for|year(s)? of experience/i,
  tribal_marker:      /ftmo|fundednext|prop firm|challenge|drawdown|daily loss|funded|payout|2 step|stellar/i,
  conversion:         /just signed up|just got funded|where do i start|how do i join|link\?|where can i|just got my|applied|applying/i,
  negative_flag:      /scam|fraud|fake|lie|lies|misleading|not true|worst|terrible|don'?t trust|avoid|warning|beware/i,
  generic:            /^[🔥💯👏🙌😂🤣❤️⭐]+$|^(w+|l+|fire|goat|based|fr|no cap|bussin|facts|bet)$/i,
  question:           /how do you|what do you|can you explain|could you|when should|why do you|what is|how does|do you have/i,
  unknown:            /^$/,
};

const PAIN_WORDS = [
  "fail", "failed", "failing", "blew", "blown", "lost", "lose", "losing", "struggle", "struggling",
  "hard", "difficult", "confused", "confusing", "frustrat", "problem", "issue", "cant", "can't",
  "never", "always fail", "keep failing", "drawdown", "violated", "breach",
];

const DESIRE_WORDS = [
  "pass", "passed", "profit", "funded", "payout", "consistent", "grow", "improve", "better",
  "success", "achieve", "goal", "freedom", "income", "earn", "make money", "replace", "quit my job",
  "full time", "professional", "funded trader", "quit", "leave",
];

// ─── Comment classification ───────────────────────────────────────────────

function classifyComment(text: string): CommentArchetype {
  // Negative flags take priority
  if (ARCHETYPE_PATTERNS.negative_flag.test(text)) return "negative_flag";
  
  // Conversion signals are high value
  if (ARCHETYPE_PATTERNS.conversion.test(text)) return "conversion";
  
  // Specific archetypes
  for (const type of ["validating", "challenge", "pain_amplification", "tribal_marker", "status", "skeptic", "question", "generic"] as CommentArchetype[]) {
    if (ARCHETYPE_PATTERNS[type].test(text)) return type;
  }
  
  return "unknown";
}

function extractPainPoints(comments: string[]): string[] {
  const counts: Record<string, number> = {};
  for (const c of comments) {
    const lower = c.toLowerCase();
    for (const word of PAIN_WORDS) {
      if (lower.includes(word)) counts[word] = (counts[word] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

function extractDesires(comments: string[]): string[] {
  const counts: Record<string, number> = {};
  for (const c of comments) {
    const lower = c.toLowerCase();
    for (const word of DESIRE_WORDS) {
      if (lower.includes(word)) counts[word] = (counts[word] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

// ─── Algorithm impact mapping ─────────────────────────────────────────────

const ARCHETYPE_METADATA: Record<CommentArchetype, {
  label: string;
  algorithmImpact: string;
  contentSignal: string;
  viralityContribution: "high" | "medium" | "low" | "negative";
  dmBoostFactor: number;    // multiplier contribution to DM share rate
  saveBoostFactor: number;  // multiplier contribution to save rate
}> = {
  validating:      { label:"Validating",        algorithmImpact:"Drives DM shares and saves — content resonated at identity level",   contentSignal:"Identity trigger activated. High DM share and save signal.",          viralityContribution:"high",     dmBoostFactor:0.35, saveBoostFactor:0.25 },
  challenge:       { label:"Substantive",       algorithmImpact:"Reply chains = 150x a like on X; strong MSI signal on IG; AVD boost", contentSignal:"Genuine intellectual engagement. Highest reply-chain potential.",      viralityContribution:"high",     dmBoostFactor:0.20, saveBoostFactor:0.20 },
  pain_amplification: { label:"Pain Resonance", algorithmImpact:"Very high save rate signal — content articulates shared frustration", contentSignal:"Content addressed a pain point that audience actively experiences.",   viralityContribution:"high",     dmBoostFactor:0.30, saveBoostFactor:0.35 },
  conversion:      { label:"Conversion Intent", algorithmImpact:"Direct revenue signal. Highest-value comment type for FundedNext.",   contentSignal:"Content is generating purchase/sign-up intent. CTA is working.",     viralityContribution:"high",     dmBoostFactor:0.15, saveBoostFactor:0.15 },
  tribal_marker:   { label:"Tribal Coherence",  algorithmImpact:"Community identity signal — drives DM shares within the tribe",       contentSignal:"Content landed squarely within the trading tribe's identity.",        viralityContribution:"high",     dmBoostFactor:0.30, saveBoostFactor:0.15 },
  skeptic:         { label:"Skeptical",         algorithmImpact:"Trust gap signal — can go viral if creator handles it well publicly",  contentSignal:"Audience has trust questions. Address publicly to flip to credibility.", viralityContribution:"medium",  dmBoostFactor:0.05, saveBoostFactor:0.05 },
  status:          { label:"Expert Flex",       algorithmImpact:"Expert comments score 5-7x on LinkedIn; moderate signal elsewhere",   contentSignal:"Content attracted experts. Quality audience signal.",                  viralityContribution:"medium",  dmBoostFactor:0.10, saveBoostFactor:0.10 },
  question:        { label:"Question / Demand", algorithmImpact:"Educational demand signal — reveals content opportunities",           contentSignal:"Audience wants more depth on a specific topic. Content opportunity.",  viralityContribution:"medium",  dmBoostFactor:0.10, saveBoostFactor:0.20 },
  generic:         { label:"Generic Reaction",  algorithmImpact:"Near-zero algorithmic value — entertainment signal only",             contentSignal:"Content is entertaining but not thought-provoking. Shallow engagement.", viralityContribution:"low",    dmBoostFactor:0.00, saveBoostFactor:0.00 },
  negative_flag:   { label:"Negative / Trust",  algorithmImpact:"Trust damage signal — can suppress distribution if volume grows",     contentSignal:"Trust or credibility challenge. Address immediately in comments.",     viralityContribution:"negative", dmBoostFactor:-0.20, saveBoostFactor:-0.15 },
  unknown:         { label:"Unclassified",      algorithmImpact:"Unknown",                                                             contentSignal:"Could not classify.",                                                   viralityContribution:"low",     dmBoostFactor:0.00, saveBoostFactor:0.00 },
};

// ─── Content opportunities from comment patterns ──────────────────────────

function deriveContentOpportunities(
  signals: CommentSignal[],
  painPoints: string[],
  desires: string[]
): string[] {
  const opps: string[] = [];

  const questionSig = signals.find(s => s.archetype === "question");
  if (questionSig && questionSig.percentage >= 10) {
    opps.push(`${questionSig.count} question comments — make a dedicated deep-dive video answering the most common question. High save potential.`);
  }

  const painSig = signals.find(s => s.archetype === "pain_amplification");
  if (painSig && painSig.percentage >= 8) {
    const pain = painPoints[0] ?? "this challenge";
    opps.push(`Strong pain resonance around "${pain}" — a video specifically about overcoming this will generate high validation saves and DM shares.`);
  }

  const skepticSig = signals.find(s => s.archetype === "skeptic");
  if (skepticSig && skepticSig.percentage >= 10) {
    opps.push(`Trust gap detected (${skepticSig.count} skeptic comments) — a transparency/proof video (live account, withdrawal proof) will flip skeptics to converts. High share potential.`);
  }

  if (desires.includes("funded") || desires.includes("pass")) {
    opps.push("Desire for funded status is high — a step-by-step 'exact process I used to pass' video will earn saves and search traffic.");
  }

  if (signals.find(s => s.archetype === "conversion")?.percentage ?? 0 >= 5) {
    opps.push("High conversion intent — add a more explicit CTA in the next video and pin a comment with the FundedNext link. Audience is ready to act.");
  }

  return opps;
}

// ─── Sentiment trajectory ────────────────────────────────────────────────

function detectTrajectory(signals: CommentSignal[]): "improving" | "stable" | "degrading" {
  const positive = (signals.find(s => s.archetype === "validating")?.percentage ?? 0)
    + (signals.find(s => s.archetype === "conversion")?.percentage ?? 0)
    + (signals.find(s => s.archetype === "tribal_marker")?.percentage ?? 0);
  const negative = (signals.find(s => s.archetype === "negative_flag")?.percentage ?? 0)
    + (signals.find(s => s.archetype === "skeptic")?.percentage ?? 0) * 0.5;

  if (positive > 40 && negative < 10) return "improving";
  if (negative > 15) return "degrading";
  return "stable";
}

// ─── Main export ─────────────────────────────────────────────────────────

export function analyzeCommentIntelligence(
  comments: string[]   // raw comment texts
): CommentIntelligence {
  if (!comments || comments.length === 0) {
    return {
      totalAnalyzed: 0,
      dominantArchetype: "unknown",
      dominantLabel: "No comments",
      signals: [],
      conversionSignalStrength: 0,
      trustSignalStrength: 50,
      communitySignalStrength: 0,
      replyChainPotential: 0,
      predictedDMShareBoost: 0,
      predictedSaveBoost: 0,
      dominantPainPoints: [],
      dominantDesires: [],
      contentOpportunities: [],
      sentimentTrajectory: "stable",
      viralityDiagnosis: "No comment data available.",
    };
  }

  const classified = comments.map(c => ({ text: c, archetype: classifyComment(c) }));
  const counts: Partial<Record<CommentArchetype, number>> = {};
  for (const { archetype } of classified) {
    counts[archetype] = (counts[archetype] ?? 0) + 1;
  }

  const total = comments.length;
  const signals: CommentSignal[] = (Object.entries(counts) as [CommentArchetype, number][])
    .map(([archetype, count]) => {
      const meta = ARCHETYPE_METADATA[archetype];
      return {
        archetype,
        label: meta.label,
        count,
        percentage: Math.round((count / total) * 100),
        algorithmImpact: meta.algorithmImpact,
        contentSignal: meta.contentSignal,
        viralityContribution: meta.viralityContribution,
      };
    })
    .sort((a, b) => b.count - a.count);

  const dominant = signals[0]?.archetype ?? "unknown";
  const domMeta = ARCHETYPE_METADATA[dominant];

  // Derived scores
  const conversionCount = counts["conversion"] ?? 0;
  const conversionSignalStrength = Math.min(100, Math.round((conversionCount / total) * 500));

  const negativeCount = counts["negative_flag"] ?? 0;
  const skepticCount = counts["skeptic"] ?? 0;
  const trustSignalStrength = Math.max(0, Math.min(100, 100 - Math.round(((negativeCount * 2 + skepticCount) / total) * 200)));

  const tribalCount = counts["tribal_marker"] ?? 0;
  const validatingCount = counts["validating"] ?? 0;
  const communitySignalStrength = Math.min(100, Math.round(((tribalCount + validatingCount) / total) * 200));

  const challengeCount = counts["challenge"] ?? 0;
  const questionCount = counts["question"] ?? 0;
  const replyChainPotential = Math.min(100, Math.round(((challengeCount + questionCount + validatingCount) / total) * 250));

  // DM and save boost calculations
  const dmBoost = signals.reduce((sum, s) => sum + (ARCHETYPE_METADATA[s.archetype].dmBoostFactor * s.percentage / 100), 0);
  const saveBoost = signals.reduce((sum, s) => sum + (ARCHETYPE_METADATA[s.archetype].saveBoostFactor * s.percentage / 100), 0);

  const painPoints = extractPainPoints(comments);
  const desires = extractDesires(comments);
  const contentOpportunities = deriveContentOpportunities(signals, painPoints, desires);
  const sentimentTrajectory = detectTrajectory(signals);

  // Virality diagnosis
  let diagnosis: string;
  if (negativeCount / total > 0.15) {
    diagnosis = `Trust under attack — ${negativeCount} negative comments (${Math.round(negativeCount/total*100)}%). Address the top skeptic comments publicly; every public response is also content.`;
  } else if (conversionCount / total > 0.05) {
    diagnosis = `Strong conversion intent detected — ${conversionCount} comments showing purchase/sign-up interest. This content is actively selling FundedNext. Pin the link now.`;
  } else if (tribalCount / total > 0.30) {
    diagnosis = `High tribal coherence — the prop trading community found this content. DM share rate to other traders will be above baseline. Build on this topic immediately.`;
  } else if (validatingCount / total > 0.20) {
    diagnosis = `Validation response is dominant — audience felt seen and understood. This is the DM-share trigger. CTA: "Send this to whoever in your group feels this way."`;
  } else if (painPoints.length > 0) {
    diagnosis = `Pain resonance active around "${painPoints[0]}" — comment section is a content brief. Make a dedicated video addressing this pain point directly.`;
  } else {
    diagnosis = `Engagement is general — no dominant signal yet. ${signals[0]?.label ?? "Unknown"} comments dominate. Increase specificity in next video to sharpen the audience signal.`;
  }

  return {
    totalAnalyzed: total,
    dominantArchetype: dominant,
    dominantLabel: domMeta.label,
    signals,
    conversionSignalStrength,
    trustSignalStrength,
    communitySignalStrength,
    replyChainPotential,
    predictedDMShareBoost: Math.max(0, Math.round(dmBoost * 100) / 100),
    predictedSaveBoost: Math.max(0, Math.round(saveBoost * 100) / 100),
    dominantPainPoints: painPoints,
    dominantDesires: desires,
    contentOpportunities,
    sentimentTrajectory,
    viralityDiagnosis: diagnosis,
  };
}

// Lightweight version for when only title/engagement data is available (no comment texts)
export function estimateCommentQuality(
  commentCount: number,
  views: number,
  likes: number,
  platform: string
): { qualityScore: number; interpretation: string; replyChainLikelihood: string } {
  const commentRate = views > 0 ? (commentCount / views) * 100 : 0;
  const likeRate = views > 0 ? (likes / views) * 100 : 0;
  
  // High comment rate relative to likes = substantive engagement (not just passive like)
  const qualityRatio = likeRate > 0 ? commentRate / likeRate : 0;

  let qualityScore: number;
  let interpretation: string;
  let replyChainLikelihood: string;

  const platformThresholds: Record<string, { good: number; great: number }> = {
    youtube:      { good: 0.5, great: 1.0 },
    youtube_short: { good: 0.3, great: 0.7 },
    tiktok:       { good: 0.8, great: 1.5 },
    instagram:    { good: 0.5, great: 1.2 },
  };

  const thresholds = platformThresholds[platform] ?? platformThresholds.youtube;

  if (commentRate >= thresholds.great) {
    qualityScore = 85;
    interpretation = `${commentRate.toFixed(2)}% comment rate — well above platform average. Comment section likely contains substantive debate and question depth.`;
    replyChainLikelihood = "High — strong engagement depth suggests reply chains are active";
  } else if (commentRate >= thresholds.good) {
    qualityScore = 60;
    interpretation = `${commentRate.toFixed(2)}% comment rate — at or above platform average. Mix of generic and substantive comments expected.`;
    replyChainLikelihood = "Medium — some reply chains likely but not dominant";
  } else {
    qualityScore = 30;
    interpretation = `${commentRate.toFixed(2)}% comment rate — below platform average. Comments likely generic (emoji, short reactions). Low intellectual engagement.`;
    replyChainLikelihood = "Low — content is entertaining but not sparking conversation";
  }

  if (qualityRatio > 0.15) {
    qualityScore = Math.min(100, qualityScore + 15);
    interpretation += " High comment/like ratio suggests people felt compelled to write, not just react.";
  }

  return { qualityScore, interpretation, replyChainLikelihood };
}
