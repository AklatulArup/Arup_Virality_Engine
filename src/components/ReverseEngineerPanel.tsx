"use client";

import { useState } from "react";
import type { AnalysisResult, ChannelData, EnrichedVideo } from "@/lib/types";

type Platform = "youtube" | "youtube_short" | "tiktok" | "instagram" | "x";
type TargetPlatform = "youtube" | "youtube_short" | "tiktok" | "instagram";

interface ReverseEngineerPanelProps {
  platform: Platform;
  result: AnalysisResult | null;
  loading: boolean;
  onAnalyze: (input: string) => void;
  onRetry?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-PLATFORM DATA
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_INTEL = {
  youtube: {
    color: "#FF4444",
    label: "YouTube",
    icon: "▶",
    hookWindow: "First 30 seconds",
    tagline: "YouTube Long-Form rewards watch time above everything else. AVD carries 50% of the scoring formula. A 15% improvement in 30-second retention means the difference between 2M and 10M views. Long-Form is evergreen — a well-optimised video keeps generating search views for months or years.",

    algorithmSignals: [
      {
        signal: "Click-Through Rate (CTR)",
        target: ">4% in first 48h",
        weight: "30%",
        plain: "Out of every 100 people who SEE your thumbnail, at least 4 need to click. YouTube gives a +25% distribution boost to thumbnails with high emotional resonance. Below 4% CTR in the first 48 hours and the algorithm slows distribution.",
        tip: "The thumbnail and title must create a curiosity gap. High emotional resonance — surprise, shock, 'I need to know' — consistently outperforms information-heavy thumbnails. Use a face with a genuine expression, not a posed one.",
        howToFix: "Check YouTube Studio → Analytics → Reach. If below 4%, A/B test thumbnails. Change one element at a time: try an expressive face, bold 2–3 word text, and a bright contrasting background.",
        badExample: "Text-only thumbnail with neutral colour → 1.8% CTR → algorithm slows distribution",
        goodExample: "Shocked face + '$8,400 payout' bold text + bright background → 7.2% CTR → algorithm amplifies",
      },
      {
        signal: "Average Watch Duration (AVD)",
        target: ">50% of runtime",
        weight: "50%",
        plain: "The single most important signal on YouTube Long-Form. If your video is 10 minutes, the average viewer needs to watch at least 5 minutes. YouTube uses this to decide whether people actually wanted the video — not just clicked on it.",
        tip: "Every section should earn the next one. At each 2-minute mark, give the viewer a reason to keep going: 'But the thing that actually surprised me about this is coming up…' Re-hook before they drop.",
        howToFix: "YouTube Studio → Analytics → Audience retention. Find every sharp drop. Each drop is a specific moment that doesn't deliver on a promise. Cut it or rewrite it for the next video.",
        badExample: "Long intro talking about yourself and the channel → viewers leave at 0:45 → AVD crashes",
        goodExample: "Start with the payoff/result, then work backwards explaining how → viewers stay for the full breakdown",
      },
      {
        signal: "Satisfaction Signal (Hype + Surveys)",
        target: ">4% like rate + Hype clicks",
        weight: "20%",
        plain: "YouTube's 2026 satisfaction metric combines Hype button clicks (available on channels under 500K subs) and post-watch survey responses. This separates a video people watched from one they actually enjoyed. Each viewer gets 3 Hypes per week to allocate.",
        tip: "Ask your trading community (Telegram/Discord) to use one of their 3 weekly Hypes on your video. This is platform-approved and directly feeds the satisfaction score — not engagement bait.",
        howToFix: "Add to your community post: 'If you found this useful, use one of your 3 weekly Hypes — it directly helps the video reach more traders.' Also ask for the like at the moment of highest value, not at the end.",
        badExample: "'Like and subscribe if you enjoyed' at the end → 0.9% like rate → satisfaction signal negligible",
        goodExample: "Discord Hype CTA + like ask mid-video at key insight → 4.5% like rate + community Hypes → satisfaction signal strong",
      },
    ],

    scriptFormula: [
      {
        step: "STEP 1 — Hook (0 to 30 seconds)",
        plain: "This is the most important part of your entire video. Do NOT start with 'Hey guys welcome back to my channel.' Start with the RESULT. Show what they're going to learn/see FIRST.",
        template: '"In this video I\'m going to show you the exact [result] that got me [specific number/outcome] — and I\'ll break it down step by step so you can copy it."',
        why: "Viewers decide in the first 5 seconds whether to stay. If you waste those seconds on an intro, they're gone.",
        mistake: "Starting with: 'So today we're going to be talking about...' — this delays the value and loses 40% of viewers instantly.",
      },
      {
        step: "STEP 2 — Authority Bridge (30–60 seconds)",
        plain: "Spend 20 seconds MAX explaining why you're qualified to talk about this. Then immediately move on.",
        template: '"I\'ve been doing this for [X time], I\'ve seen [specific result], and I\'m going to show you exactly what worked."',
        why: "Viewers need to trust you before they'll keep watching. But they don't need your life story — just one sentence of credibility.",
        mistake: "Spending 3 minutes on your backstory. Nobody cares yet. Earn their interest first.",
      },
      {
        step: "STEP 3 — Value Delivery (60s to 80% of video)",
        plain: "This is where you deliver the actual content. Break it into clear, numbered chunks. After each chunk, tease what's coming next.",
        template: 'End each section with: "But that\'s only part of it — the thing that actually surprised me is coming up next..."',
        why: "Re-hooking every few minutes keeps the retention graph flat instead of steadily declining.",
        mistake: "Dumping all information at once with no structure. Viewers can't follow along and bail.",
      },
      {
        step: "STEP 4 — Loop CTA (last 20% of video)",
        plain: "Before you say goodbye, tease your NEXT video. Tell them what they'll miss if they don't watch it.",
        template: '"If you found this useful, my next video covers [specific related topic] — and the results honestly shocked me. I\'ll link it right here."',
        why: "Getting the same viewer to watch another video immediately signals strong channel health to the algorithm.",
        mistake: "Ending with 'Thanks for watching, see you next time!' — gives them no reason to stay on your channel.",
      },
    ],

    titleFormulas: [
      {
        pattern: "Number + Power Word + Clear Benefit",
        template: "[Number] [Niche] [Things/Tips/Strategies] That [Specific Result]",
        example: '"7 TikTok Scripts That Printed 500K Views in 30 Days"',
        why: "Numbers tell the viewer exactly what they're getting. The brain processes specificity as credibility.",
      },
      {
        pattern: "Personal Result Story",
        template: "I [Did X] for [Time Period] — Here's What Happened",
        example: '"I Posted Every Day for 90 Days on YouTube (Honest Results)"',
        why: "First-person results feel real and personal. Viewers think 'if they could do it, maybe I can too.'",
      },
      {
        pattern: "The Truth / Nobody Talks About",
        template: "The Truth About [Topic] Nobody Tells You",
        example: '"The Truth About Prop Firm Payouts Nobody Tells You"',
        why: "Creates instant curiosity. Implies the viewer has been lied to or is missing key information.",
      },
      {
        pattern: "Question That Stings",
        template: "Why [Common Belief or Behavior] Is [Surprising Opposite]",
        example: '"Why Most Funded Traders Fail Their Second Account"',
        why: "If the viewer has done the thing in the title, they MUST click to defend themselves or find out what they did wrong.",
      },
    ],

    thumbnailRules: [
      { rule: "Use a face showing REAL emotion", detail: "Shock, joy, disbelief, or frustration. Not a staged smile. The emotion must match what the viewer will feel when they watch." },
      { rule: "Maximum 5 words of text — huge font", detail: "If someone can't read it in 1 second on a phone screen, it's too small or too wordy." },
      { rule: "High contrast background", detail: "Bright colors (red, yellow, orange) against dark subjects. Or dark background with bright text. Avoid grey, beige, or brown." },
      { rule: "Arrow or circle pointing to something", detail: "Directs the eye. Creates a 'what is that?' curiosity that drives clicks." },
      { rule: "Thumbnail text ≠ title text", detail: "They should complement each other, not repeat. Thumbnail: 'BIGGEST MISTAKE'. Title: 'Why 90% of Funded Traders Fail.'", },
    ],

    replicationSteps: [
      { num: 1, action: "Find 3 videos in your niche with 10x more views than average", detail: "Go to your competitor's channel. Sort by 'Most Popular'. The outlier videos are your research targets." },
      { num: 2, action: "Screenshot their thumbnail and write down every element", detail: "What's in the background? What emotion is on the face? What does the text say? Where is the text placed?" },
      { num: 3, action: "Transcribe word-for-word the first 60 seconds", detail: "Listen carefully. What's the first sentence? What promise do they make? When do they first show value?" },
      { num: 4, action: "Write down the exact title formula", detail: "Is it a number list? A personal story? A question? A warning? Identify the pattern." },
      { num: 5, action: "Read the top 20 comments", detail: "The comments tell you what resonated most. What are people quoting? What questions are they asking? That's your next video idea." },
      { num: 6, action: "Map the chapter structure", detail: "How many sections are there? How long is each one? Where does energy spike? What transitions do they use?" },
      { num: 7, action: "Now rebuild it — same structure, your topic, different angle", detail: "Don't copy. Borrow the STRUCTURE. Use your own story, your own data, your own personality." },
    ],

    commonMistakes: [
      "Long intro talking about yourself — viewers leave before the hook lands. The first 5 seconds must visually deliver on the title's promise.",
      "Title over 50 characters — truncates on most devices. Shorter, more extreme titles drive higher CTR. 'I passed a $100K challenge' beats 'How I Used FundedNext to Achieve My Trading Goals.'",
      "Asking for a like at the end when viewers have already checked out. Ask at the moment of highest value — right after your best insight.",
      "Padding videos to hit a time target. A 15% difference in 30-second retention is the difference between 2M and 10M views. Remove every dull moment.",
      "Ignoring YouTube Hype. Each viewer gets 3 Hypes per week — ask your trading community to use one. It directly feeds the 20% satisfaction signal.",
      "Not speaking keywords in the first 30 seconds. YouTube transcribes audio for search. Say 'FundedNext challenge', 'prop firm', 'daily drawdown' out loud in the first 30 seconds.",
      "Posting on a schedule before quality is consistent. One video at 500K views builds algorithmic authority. Fifty videos averaging 2K views does the opposite.",
    ],
  },

  tiktok: {
    color: "#00f2ea",
    label: "TikTok",
    icon: "♪",
    hookWindow: "First 3 seconds",
    tagline: "TikTok's distribution is completion-first. The first 60 minutes — when your followers see the video — decide everything. TikTok shows your video to YOUR FOLLOWERS first, unlike Instagram. Completion (45%), rewatches (35%), DM shares (20%) are the only signals that matter. A like is the weakest signal — stop optimising for it.",

    algorithmSignals: [
      {
        signal: "Completion Rate (Watch to End)",
        target: ">70% in first hour",
        weight: "45%",
        plain: "TikTok's most important signal. For videos under 20 seconds, you need more than 42% of viewers to finish. The overall distribution threshold is ~70% — 70 out of 100 of your followers who see the video in the first hour need to watch to the end. Below that threshold, TikTok stops distributing beyond your followers. No recovery.",
        tip: "TikTok shows your video to YOUR FOLLOWERS FIRST (unlike Instagram). If your own followers don't finish it, it goes nowhere. Make content your existing audience would genuinely watch all the way through.",
        howToFix: "Check TikTok analytics → Average watch time. If it drops at a specific second, that moment is your problem. Cut it or move the payoff earlier. Every second that doesn't earn the next second kills your completion rate.",
        badExample: "'Hey guys welcome back to my channel…' opening → 52% completion in first hour → TikTok stops at followers only",
        goodExample: "Open on payout screen, number visible, zero intro → 81% completion → TikTok pushes to the For You Page",
      },
      {
        signal: "Rewatch Rate (Loop Compounding)",
        target: ">3x average rewatch",
        weight: "35%",
        plain: "One person rewatching your video 3 times is worth MORE than 3 different people watching once. TikTok's leaked internal point system: DM Share = 25 pts, Save = 15 pts, Finish video = 8 pts, Like = less than 8 pts. Loop rewatches compound exponentially using the formula (1 + rewatch rate)^n.",
        tip: "Leaked TikTok engagement weights: DM Share (25pts) > Save (15pts) > Finish video (8pts) > Like (<8pts, lowest of all). A single DM share is worth more than 3 video completions. Engineer your content toward DMs and saves, not likes.",
        howToFix: "End your video on a moment that only fully makes sense if you watched from the start. Or end with a visual that IS the first frame. This creates a psychological pull to rewatch without the viewer realising.",
        badExample: "Standard 'follow for more' CTA at end → viewer leaves TikTok → zero rewatches → loop compound = 1x",
        goodExample: "Ending cuts back to opening number on screen → 2.8 average rewatches → loop compound multiplies views by (1+2.8)^n",
      },
      {
        signal: "DM Shares (High-Intent Actions)",
        target: ">1% share rate",
        weight: "20%",
        plain: "DM Shares = 25 pts in TikTok's leaked internal system — the highest-value single action a viewer can take. Higher than saves (15pts), higher than completions (8pts), higher than likes (<8pts). Before posting, ask: would a prop trader DM this to their trading group right now?",
        tip: "The caption question is your DM share trigger. 'Send this to whoever is about to start a challenge' is a direct instruction TikTok doesn't penalise. Generic 'comment YES if you agree' captions ARE penalised in 2026 as engagement bait.",
        howToFix: "Write your caption as a send instruction: 'Send this to your trading group before they start their next challenge.' This activates the 25-point DM signal without triggering TikTok's engagement-bait filter.",
        badExample: "'Drop a ❤️ if this helped' → gets likes (<8 pts each) → lowest possible engagement signal",
        goodExample: "'Send this to whoever is about to start a challenge — they need to see the drawdown rule first' → DM sends (25 pts each) → algorithm pushes to FYP",
      },
    ],

    scriptFormula: [
      {
        step: "STEP 1 — Visual + Text Hook (0 to 1 second)",
        plain: "Before anyone hears audio, the VIDEO itself must stop the scroll. Most people watch TikTok on silent first. Your first frame needs to work without sound.",
        template: 'Bold text on screen: "[Controversial or surprising statement]" — before you say a single word.',
        why: "60% of TikTok users scroll with sound off. If your hook only works with audio, you've lost more than half your potential audience.",
        mistake: "Starting with a black screen, a fade-in, or your face just appearing. Nothing to stop the scroll.",
      },
      {
        step: "STEP 2 — Verbal Hook (1 to 3 seconds)",
        plain: "Your first spoken sentence must create a knowledge gap — make them feel like they're about to learn something they don't know yet.",
        template: '"Most [your audience type] don\'t know about [thing]..." OR "Stop doing [common thing] if you want [result]..."',
        why: "Knowledge gaps are psychologically irresistible. The brain needs to close the gap — which means watching the rest of the video.",
        mistake: "Starting with your name or greeting. 'Hey I'm [Name] and today...' — nobody cares. They want the value.",
      },
      {
        step: "STEP 3 — Twist / Stakes (3 to 10 seconds)",
        plain: "Immediately raise the stakes. Tell them what they LOSE if they don't watch, or what they GAIN if they do. Make it specific.",
        template: '"This one thing cost me [specific loss]..." OR "If you get this right, you can [specific gain] without [common obstacle]."',
        why: "Stakes create urgency. Without stakes, there's no reason to keep watching.",
        mistake: "Jumping straight into the content without establishing WHY it matters to the viewer.",
      },
      {
        step: "STEP 4 — Value Delivery (10 seconds to end)",
        plain: "Give the actual content now. No filler. No 'so as I was saying.' Every second counts. Cut anything that isn't information or emotion.",
        template: "Structure as: Point 1 → quick proof → Point 2 → quick proof → Point 3 → final takeaway",
        why: "Tight delivery keeps completion rate high. Every wasted second is a viewer who swiped away.",
        mistake: "Rambling. Long pauses. Saying 'um' or 'like' repeatedly. Repeating what you already said.",
      },
      {
        step: "STEP 5 — Loop / CTA (last 2 seconds)",
        plain: "End in a way that either makes them follow you OR makes the video loop back automatically.",
        template: '"Follow for [specific type of content] every week." OR end on a question that makes them read back from the start.',
        why: "The follow prompt must have a specific reason. 'Follow me' doesn't work. 'Follow if you want my exact trading checklist' works.",
        mistake: "Ending with 'that's it for today' or a slow fade-out — kills all momentum.",
      },
    ],

    titleFormulas: [
      {
        pattern: "Statement They'll Argue With",
        template: "[Counterintuitive claim about your niche]",
        example: '"Prop firms are the best thing that happened to retail traders"',
        why: "Controversy drives comments. Comments drive algorithm. Even people who disagree will comment — which pushes your video further.",
      },
      {
        pattern: "POV / Relatable Moment",
        template: "POV: [specific moment your audience has lived through]",
        example: '"POV: you just blew your funded account for the 3rd time"',
        why: "Creates instant emotional resonance. The viewer feels seen and understood.",
      },
      {
        pattern: "Shortcut / Hack",
        template: "[Number] [things/rules/steps] that [specific result] every time",
        example: '"3 trade setups that work even in choppy markets"',
        why: "Specific numbers and 'every time' language promises reliability — exactly what a struggling trader wants.",
      },
      {
        pattern: "Direct Address to Specific Person",
        template: "If you [specific behavior], [consequence or insight]",
        example: '"If you\'re trading news events without this, you\'re gambling"',
        why: "Feels like the creator is speaking directly to YOU. High relevance = high engagement.",
      },
    ],

    thumbnailRules: [
      { rule: "Your FIRST FRAME is your thumbnail", detail: "Unlike YouTube, you can't always choose a custom thumbnail on TikTok. Make frame 1 visually arresting. This is non-negotiable." },
      { rule: "Bold on-screen text in frame 1", detail: "Put the hook in text ON the video before you even speak. This captures silent scrollers." },
      { rule: "High contrast — usually dark background + bright subject", detail: "Your subject should POP off the screen. If it blends in with the TikTok UI, you're invisible." },
      { rule: "Real human reaction, not posed", detail: "Genuine shock, frustration, or laughter. Posed smiling feels like an ad and gets scrolled past." },
      { rule: "For finance/trading: P&L screenshots work extremely well", detail: "Real numbers in the thumbnail create instant credibility and curiosity." },
    ],

    replicationSteps: [
      { num: 1, action: "Find the creator's top 5 videos from the last 90 days", detail: "Go to their profile. Sort by 'Most Liked' or look at view counts manually. You want outlier performance — 3x or more their average." },
      { num: 2, action: "Write down the EXACT first 3 seconds of each video", detail: "What's the first frame? What's the first word spoken? What text is on screen? Write it verbatim." },
      { num: 3, action: "Map the emotional arc of each video", detail: "Where does the energy peak? Where do they slow down? Where do they reveal the key information? Draw a line graph of engagement level." },
      { num: 4, action: "Note the audio used", detail: "Is it trending audio or original voice? If trending audio, find the same sound and see how other creators are using it." },
      { num: 5, action: "Read the top 30 comments", detail: "What are people saying specifically? 'This is literally me' = relatable. 'Can you do a part 2 on X' = your next video idea." },
      { num: 6, action: "Extract the hook formula and test 3 angles", detail: "Take their hook structure and apply it to 3 different sub-topics in your niche. Test which performs best." },
      { num: 7, action: "Post timing: 6–9am or 7–10pm in your audience's timezone", detail: "These windows catch people during their morning commute/routine and their evening wind-down scroll." },
    ],

    commonMistakes: [
      "'Comment YES if you want to get funded' — TikTok actively penalises this as engagement bait in 2026. It reduces distribution.",
      "Posting when your followers are offline. TikTok tests on YOUR FOLLOWERS FIRST. If they're not active, your first-hour completion rate dies and the video goes nowhere.",
      "Re-uploading a video you've already posted. TikTok detects duplicates via content fingerprinting and buries the new upload faster than the original decayed.",
      "Chasing likes. Leaked TikTok internal points: Like <8pts, Finish video 8pts, Save 15pts, DM Share 25pts. Likes are literally the weakest signal on the platform.",
      "Ending the video in a way that makes people leave TikTok. The platform penalises exits heavily. Design your ending to loop back to the beginning.",
      "Buying fake views. Bot views have zero watch time. 10,000 fake views drops your completion rate below 5%. You're paying to make your video perform worse.",
      "Making the content too long. Under 20 seconds needs 42% completion threshold. Under 45 seconds is ideal. Every extra second is a completion rate risk.",
    ],
  },

  instagram: {
    color: "#E1306C",
    label: "Instagram",
    icon: "◎",
    hookWindow: "First 1 second",
    tagline: "Instagram's distribution is relationship-driven. DM sends are weighted 3–5x higher than likes — confirmed by Mosseri Jan 2025. 55% of Reels views come from non-followers. Instagram tests your Reel on strangers FIRST — your hook needs to land before anyone who follows you even sees it. Saves carry 3x the weight of likes. Likes are explicitly the weakest signal.",

    algorithmSignals: [
      {
        signal: "DM Sends per Reach",
        target: ">2% send rate",
        weight: "~40%",
        plain: "Confirmed by Instagram head Adam Mosseri (Jan 2025) as the strongest signal for reaching non-followers — weighted 3–5x higher than likes. Before posting, ask: 'Would a prop trader DM this to their trading group?' If the answer is no, the content isn't built for Instagram's distribution model.",
        tip: "The content types that get DM'd most in trading: near-failure confessions, specific rule breakdowns with exact numbers, and real payout reveals. Make these the core of your Instagram content strategy.",
        howToFix: "Add a direct DM instruction to your Reel outro: 'Send this to whoever you're trading with before their next challenge.' On Instagram, explicit send instructions in the video itself are not penalised and are the most effective DM triggers available.",
        badExample: "Generic motivational trading content → no DM reason → 0.3% send rate → Reel stays with followers only",
        goodExample: "Rule breakdown + 'Send this to your trading group before Day 1' outro → 2.8% send rate → Reel pushed to Explore",
      },
      {
        signal: "Saves (Lasting Utility)",
        target: ">3% save rate",
        weight: "~30%",
        plain: "A save means a viewer thought 'I'll need this later.' Saves carry 3x the weight of a like on Instagram. What earns saves in trading: specific rules with exact numbers, position sizing formulas, challenge checklists, drawdown calculations. Vague motivational content does not earn saves.",
        tip: "The save trigger is specificity. 'The daily loss limit is 5% of your starting balance — NOT your current balance. At $110K, that's still $5,000' earns a save. 'Risk management is important' does not. Include one specific calculation in every Reel.",
        howToFix: "At the moment you deliver your most specific insight (the number, the rule, the calculation), say: 'Save this — you'll need it before your next challenge.' This is the highest-leverage placement. Not at the end.",
        badExample: "Generic trading motivation with no specific numbers → 0.4% save rate → Reel decays in 48 hours",
        goodExample: "Specific rule + exact numbers + 'Save this before your challenge' mid-video CTA → 4.2% save rate → Reel resurfaces for 2–4 weeks",
      },
      {
        signal: "3-Second Hook Rate",
        target: ">60% stay past 3s",
        weight: "~30%",
        plain: "Instagram tests your Reel on NON-FOLLOWERS FIRST (the opposite of TikTok). Your hook needs to work for someone who has never heard of you. Kill thresholds: below 40% hook rate = 5–10x less reach. Below 50% completion = not eligible for the Explore page. Something visually surprising must appear before 1.5 seconds.",
        tip: "Use Instagram's Trial Reels feature to test your opening on non-followers BEFORE it hits your main feed. If the 3-second hold rate in the trial is below 50%, rework the opening before publishing. This is the single most effective pre-publish quality check available.",
        howToFix: "Trial Reels: publish the Reel to non-followers only first, check the 3-second hold rate in 24 hours, then decide whether to share to your main feed. A failed hook on your main feed permanently damages your account's reach metrics.",
        badExample: "'Hey guys, today I'm going to talk about…' first 3 seconds → 28% 3-sec hold → 5–10x less reach → Reel buried",
        goodExample: "Open directly on payout screen, number visible, zero narration for 1.5 seconds → 73% 3-sec hold → Reel pushed to Explore",
      },
    ],

    scriptFormula: [
      {
        step: "STEP 1 — Visual Hook (Frame 1 — zero exceptions)",
        plain: "The first frame of your reel is your entire marketing budget. No intro. No logo. No 'hey guys.' The first frame must be the CLIMAX or the most visually interesting moment.",
        template: "Start mid-action: mid-sentence, mid-result, mid-reaction. Make the viewer feel like they've missed something and need to watch from the beginning.",
        why: "Instagram users make a keep/scroll decision in under 400 milliseconds. Your first frame is competing against everything else in their feed.",
        mistake: "Starting with a title card, a blank screen, or a static shot of your face. All of these read as 'this is boring, skip.'",
      },
      {
        step: "STEP 2 — Caption First Line (must hook without expanding)",
        plain: "On Instagram, only the FIRST LINE of your caption shows before the 'more' button. This line must be so compelling that people tap 'more' OR it must add meaning to what they're watching.",
        template: '"[Question or incomplete statement that can\'t be ignored]..." OR "[Bold claim that the reel proves]"',
        why: "A good caption first line doubles your engagement. Most creators waste this space with hashtags or filler text.",
        mistake: "Starting your caption with hashtags, your handle, or 'NEW REEL OUT NOW' — completely wasted opportunity.",
      },
      {
        step: "STEP 3 — Value Delivery (2 seconds to end)",
        plain: "Teach, inspire, or show something useful — immediately and without padding. Use TEXT OVERLAYS on screen to reinforce your spoken words. Many viewers watch on mute.",
        template: "Spoken word + matching text on screen + visual proof where possible. The trifecta: hear it + read it + see it.",
        why: "Text overlays increase both accessibility AND retention. Viewers who watch on mute can still get full value.",
        mistake: "Long pauses, slow talking, no on-screen text. Losing muted viewers means losing 30–40% of your potential audience.",
      },
      {
        step: "STEP 4 — Save + Send CTA (place mid-reel, not at the end)",
        plain: "Place your call-to-action at the exact moment of highest value — right after your best tip or most useful insight. NOT at the end.",
        template: '"Save this — you\'ll want to come back to it." OR "Send this to someone who needs to hear this."',
        why: "By the time the video ends, 40% of viewers have already checked out. Your best CTA placement is while they're most engaged, mid-video.",
        mistake: "Saying 'like and save if you found this useful' at the very end of the reel — most people who would have saved have already scrolled away.",
      },
    ],

    titleFormulas: [
      {
        pattern: "Specific Result + Proof",
        template: "I [did specific thing] and got [specific measurable result] — here's exactly how",
        example: '"I went from 0 to a $50K funded account in 47 days — here\'s the exact plan"',
        why: "Specificity is credibility. '47 days' is more believable than 'in less than 2 months.' Real numbers signal real results.",
      },
      {
        pattern: "Myth Bust",
        template: "You don't need [common belief] to [desired outcome]",
        example: '"You don\'t need 10,000 followers to get brand deals on Instagram"',
        why: "Challenges a belief your audience holds. Creates immediate 'wait, really?' curiosity.",
      },
      {
        pattern: "The Resource / List",
        template: "[Number] [specific things] that [specific audience] needs right now",
        example: '"5 prop firms that actually pay out without hidden rules (2026 updated list)"',
        why: "Lists feel complete and useful. 'Updated list' signals freshness. Specificity in the audience makes it feel personal.",
      },
      {
        pattern: "Transformation Hook",
        template: "This one [thing/mindset/habit] changed [specific aspect of my life/trading/business]",
        example: '"This one rule eliminated 90% of my losing trades"',
        why: "Transformation stories are the most shareable content format. They're relatable AND aspirational.",
      },
    ],

    thumbnailRules: [
      { rule: "First frame = bold text on clean background OR face with real expression", detail: "No stock photos, no fake reactions. The thumbnail must feel real and personal." },
      { rule: "Use the native Instagram aesthetic", detail: "Over-produced, corporate-looking thumbnails look like ads and get scrolled past. Raw, real, slightly imperfect performs better." },
      { rule: "Carousel cover should tease the value inside", detail: "If you're posting a carousel, the cover card should promise something that can only be unlocked by swiping. 'Slide 3 is the one that changed everything.'", },
      { rule: "For Reels: choose a mid-action frame as your cover", detail: "Don't use the first or last frame as your cover — choose a moment mid-action where something interesting is visually happening." },
      { rule: "Consistent brand colors across all thumbnails", detail: "When someone sees your content in Explore, they should be able to recognize it as yours before they read your name. Color consistency builds this." },
    ],

    replicationSteps: [
      { num: 1, action: "Pull the top 10 reels from the target account in the last 60 days", detail: "Go to their profile and identify which reels have the most views. Screenshot the thumbnail, write down the caption first line." },
      { num: 2, action: "For each reel: note the first frame, first spoken word, and caption first line", detail: "Write these three elements down exactly. This is their 'hook stack' — the three-layer attention grab." },
      { num: 3, action: "Find which reels have the most saves (proxy: likes vs comments ratio)", detail: "High likes + low comments = passive engagement = entertainment. High comments + high saves = deep engagement = educational or controversial content." },
      { num: 4, action: "Map the content format", detail: "Is it talking head? Text-only slides? Screen recording? B-roll with voiceover? Identify the format and note how long each type runs." },
      { num: 5, action: "Extract CTA placement — where exactly do they ask for the save?", detail: "Scrub to the moment they say 'save this' or 'send this.' Is it at the 30% mark? 50%? Right after a key insight? Note it precisely." },
      { num: 6, action: "Identify their 3-second hook and rewrite it for your angle", detail: "Take their first frame + first sentence structure and rewrite it around your specific topic, your story, your result." },
      { num: 7, action: "Post Tuesday–Friday, 11am–1pm or 7–9pm in your audience's local timezone", detail: "These are peak scroll windows. Avoid Monday mornings and Saturday afternoons — low engagement windows for most business-adjacent content." },
    ],

    commonMistakes: [
      "Posting a video with a TikTok or CapCut watermark — Instagram automatically excludes watermarked content from recommendations with no exceptions.",
      "Posting the same content 10+ times in 30 days — Instagram applies an account-level originality flag that stops ALL your content being recommended, including new originals.",
      "Optimising for likes. Mosseri confirmed likes have 'the lowest algorithmic weight' of all engagement signals on Reels. They're worth less than completions, saves, and DMs.",
      "Putting the save CTA at the end. The save trigger fires at peak emotional engagement — right after your best insight. By the end, viewers have already decided whether to save.",
      "No text overlay for muted viewers. 30–40% of Instagram viewers watch on mute. Every key point you speak should also appear as text on screen.",
      "Promising something in the hook that the video doesn't deliver. Instagram measures whether opening matches content. Disappointed viewers click 'Not Interested' which suppresses all future content.",
      "Posting without testing via Trial Reels. A failed hook on your main feed permanently damages your non-follower reach score. Use Trial Reels to test first.",
    ],
  },

  youtube_short: {
    color: "#FF0076",
    label: "YouTube Shorts",
    icon: "⚡",
    hookWindow: "First 3 seconds",
    tagline: "YouTube Shorts uses a velocity model — it either spreads fast or it doesn't. In 2026 there is no 48-hour virality cap — a strong Short can keep spreading for weeks. The first frame is your thumbnail. A >30% swipe-away rate permanently kills distribution — there is no recovery.",

    algorithmSignals: [
      {
        signal: "Viewed vs Swiped (First Frame)",
        target: "<30% swipe-away",
        weight: "50%",
        plain: "YouTube Shorts has no thumbnail — your FIRST FRAME is what people see before deciding to watch or swipe. If more than 30% of test viewers swipe away in the first 2 seconds, distribution permanently stops. This is a binary kill switch — no recovery available.",
        tip: "Your opening frame must be a pattern interrupt — the payout number, a chart at its spike, the funded certificate. No intros, no logos, no 'hey guys.' The first frame must create enough curiosity to stop a scroll.",
        howToFix: "Watch the first 2 seconds of your Short as a stranger seeing it for the first time. Ask: does this frame create enough curiosity to not swipe? If uncertain, re-film the opening on a more visually striking moment.",
        badExample: "Opening on a talking head with no visual context → 48% swipe-away → video permanently buried",
        goodExample: "Opening directly on payout dashboard, number clearly visible, zero narration → 22% swipe-away → algorithm pushes",
      },
      {
        signal: "Loop Rate (Natural Rewatch)",
        target: ">40% loop rate",
        weight: "30%",
        plain: "YouTube's 2026 model specifically identifies 'natural loops' — Shorts that flow seamlessly back to the first frame. A Short watched twice scores dramatically higher than one watched once. No outro. No 'thanks for watching.' No music fade. Cut at the last moment of value.",
        tip: "Your last line should be a question or unfinished thought that only resolves on rewatch. Or end on the same visual as your first frame. The video should feel like it ends too soon — which pulls people back to the beginning.",
        howToFix: "Remove your outro completely. End at the last moment of value — the number, the rule, the punchline. Then cut. The seamless loop is more valuable than any CTA you'd put in an outro.",
        badExample: "'Like and subscribe for more' outro card → viewer closes immediately → loop rate 3%",
        goodExample: "Ends with the key insight then cuts directly to opening frame → 44% loop rate → algorithm keeps distributing",
      },
      {
        signal: "DM Shares & External Sharing",
        target: ">2% share rate",
        weight: "20%",
        plain: "YouTube Shorts weights external shares to WhatsApp, iMessage, and Discord MORE than TikTok or Instagram. A DM share means someone actively handed your video to another person — the strongest signal of genuine value available on any platform.",
        tip: "Share your own Short to WhatsApp, iMessage, and Discord immediately after posting. Seed the external shares. Each external share carries more algorithmic weight than 10 passive feed views.",
        howToFix: "After posting, immediately share the direct YouTube link to every channel you own — Telegram, Discord, WhatsApp group. Cross-platform sharing in the first 60 minutes gives the algorithm the quality signals it needs.",
        badExample: "Post and wait for organic shares → zero external shares in first hour → algorithm treats as low-quality",
        goodExample: "Post → immediately share to trading Discord and WhatsApp → external shares in first 15 minutes → algorithm detects quality",
      },
    ],

    scriptFormula: [
      {
        step: "STEP 1 — Pattern Interrupt (0 to 3 seconds)",
        plain: "Your first frame must be visually or aurally different from everything else in the feed. People are swiping fast. You need a literal jolt to stop them mid-swipe.",
        template: '"[Shocking visual or sound] + [1 sentence that creates immediate curiosity or controversy]"',
        why: "On Shorts, the first 3 seconds are everything. If viewers don't stop scrolling, the rest doesn't matter. Make those 3 seconds unpredictable.",
        mistake: "Starting with your logo, a title card, or any kind of intro — these signal 'ad' to viewers and they swipe instantly.",
      },
      {
        step: "STEP 2 — Core Value (3 to 40 seconds)",
        plain: "Get to the point immediately. No context-setting, no backstory. State the one key idea, show the one key result, or make the one key argument — then stop.",
        template: '"The [result/fact/opinion] is [specific detail]. Here\'s why that matters for you: [1-sentence reason]."',
        why: "Short attention spans mean you have one idea worth communicating. One idea well-delivered beats three ideas rushed.",
        mistake: "Trying to cover 5 points in a 45-second Short. Pick one. Cover it completely. End.",
      },
      {
        step: "STEP 3 — Loop Hook (last 2 seconds)",
        plain: "Your last line should create enough curiosity that a viewer wants to watch again — OR should visually/audibly connect back to your first second.",
        template: '"…and that\'s the part nobody talks about. [cut to opening frame or silence]"',
        why: "Loop rate is YouTube Shorts' most powerful distribution signal. A video that gets rewatched is algorithmically indistinguishable from a video that got watched twice as many times.",
        mistake: "Adding an outro: 'Subscribe for more' or 'Follow me' at the end. This breaks the loop and drops your loop rate to near zero.",
      },
    ],

    titleFormulas: [
      {
        pattern: "Controversial Claim",
        template: "[Strong opinion most people disagree with]",
        example: "Stop doing 3R risk management (here's why)",
        why: "Controversy stops scrolling. People who agree feel validated; people who disagree need to watch to argue. Both outcomes boost engagement.",
      },
      {
        pattern: "Surprising Number",
        template: "[Unexpected stat or result in X days/trades/hours]",
        example: "I made $4,200 in 3 trades using this one rule",
        why: "Specific numbers feel real. Vague claims get ignored. Always use a specific number you can back up.",
      },
      {
        pattern: "Secret/Unknown",
        template: "The [thing] nobody tells you about [topic]",
        example: "The psychology mistake that kills most funded traders",
        why: "Creates an information gap — the viewer feels they're about to learn something others don't know. Works especially well for finance/trading content.",
      },
      {
        pattern: "Before/After",
        template: "From [bad state] to [good state] in [timeframe]",
        example: "From failed challenge to funded in 11 days — here's the system",
        why: "Transformation stories are the highest-performing narrative arc on Shorts. Real results beat advice every time.",
      },
    ],

    thumbnailRules: [
      { rule: "One face, maximum expression", detail: "Thumbnails with a face showing genuine emotion (not posed) get 3× more clicks. Surprise, shock, or intense focus all outperform neutral faces." },
      { rule: "3 words or fewer on the thumbnail", detail: "Shorts thumbnails are tiny. If you need more than 3 words to explain the thumbnail, redesign it. Use the title for words, the thumbnail for emotion." },
      { rule: "Bright background, high contrast text", detail: "Your thumbnail competes in a vertical feed of other thumbnails. Muted/dark backgrounds disappear. Use neon, white, or bright solid colors behind any text." },
      { rule: "No logo, no watermark in the first frame", detail: "The first frame of your Short IS the thumbnail preview. If it starts with a branded intro, your thumbnail is your logo — and logos don't get clicked." },
    ],

    replicationSteps: [
      { num: 1, action: "Identify the one idea in the video", detail: "Watch the original Short and write down in one sentence what the core idea is. If you can't, the original video was too complex — simplify even further for your version." },
      { num: 2, action: "Rewrite the hook for your angle", detail: "Keep the same hook TYPE (controversial claim, number, secret) but apply it to your specific story or trading experience." },
      { num: 3, action: "Film in one take under 45 seconds", detail: "Shorts under 45 seconds consistently outperform 60-second Shorts on completion rate. Practice until you can deliver your idea in under 45 seconds without rushing." },
      { num: 4, action: "Add subtitles manually for the first 3 seconds", detail: "Auto-captions often lag on the most important lines. Manually add large-text captions for your opening hook so they appear instantly." },
      { num: 5, action: "Post within 48 hours of filming", detail: "Fresh energy shows on camera. Shorts filmed and posted quickly also tend to reference current events or feelings — which makes them feel more real and relatable." },
      { num: 6, action: "Reply to every comment within 30 minutes of posting", detail: "Comment velocity in the first hour is a major distribution signal. Your replies count as engagement. Set a 30-minute phone reminder to reply to everyone." },
    ],

    commonMistakes: [
      "Opening with your name, a logo, or 'Hey guys' — your first frame IS your thumbnail. Swipes in the first 2 seconds permanently kill the video's reach.",
      "Adding an outro card ('subscribe', 'follow for more'). This kills your loop rate (30% of the scoring formula). End at the last moment of value and cut immediately.",
      "Uploading a horizontal video or a file with a TikTok watermark — YouTube detects both and permanently buries the video.",
      "Making it too long. If you can say it in 35 seconds, don't pad to 60. Every extra second is a completion rate risk.",
      "Not sharing externally after posting. Shorts weights external DM shares (WhatsApp, iMessage, Discord) more than any other short-form platform. Share immediately.",
      "Opening on a frame that requires prior context. If someone needs to already know what they're looking at, they'll swipe. Every Short must be fully self-contained from frame 1.",
      "Treating Shorts as separate from long-form. Add 'Full breakdown in my channel ↑' text overlay to convert Shorts viewers into long-form subscribers.",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-PLATFORM ADAPTATION GUIDE
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<TargetPlatform, { label: string; color: string; icon: string }> = {
  youtube:       { label: "YouTube Long Form", color: "#FF4444", icon: "▶" },
  youtube_short: { label: "YouTube Shorts",    color: "#FF0076", icon: "⚡" },
  tiktok:        { label: "TikTok",            color: "#00F2EA", icon: "♪" },
  instagram:     { label: "Instagram Reels",   color: "#E040FB", icon: "◈" },
};

interface AdaptationGuide {
  summary: string;
  keep: string[];
  change: string[];
  add: string[];
  drop: string[];
  formatDiff: string;
  biggestTrap: string;
}

const CROSS_PLATFORM_ADAPTATION: Partial<Record<string, AdaptationGuide>> = {
  "youtube→tiktok": {
    summary: "You're taking long-form educational content and compressing it into a 30–60 second dopamine hit. This is the most common repurposing direction — and the most commonly done wrong.",
    keep: ["The hook — the most surprising or counterintuitive moment in your YouTube video", "The single most valuable insight (pick ONE, not five)", "Your authentic voice and energy"],
    change: ["Duration: compress from minutes to under 60 seconds", "Pacing: at least 1 new visual element or cut every 3 seconds", "Opening: start mid-sentence or mid-action, not with a formal intro"],
    add: ["On-screen text overlay for every key point (30% of TikTok viewers watch on mute)", "A trending audio track underneath (even at low volume)", "A loop-back moment at the end"],
    drop: ["ALL intro/outro branding", "All context-setting ('In today's video…')", "All multi-step breakdowns — pick ONE step from your YouTube structure"],
    formatDiff: "YouTube: 16:9 horizontal, 8–20 mins ideal. TikTok: 9:16 vertical, 30–45 seconds ideal. Your YouTube thumbnail does NOT work on TikTok — film new content or crop creatively.",
    biggestTrap: "Uploading the raw YouTube clip to TikTok. The algorithm penalises cross-posted horizontal/watermarked content. Always re-edit or re-film natively.",
  },
  "youtube→instagram": {
    summary: "Instagram Reels viewers expect polished but authentic content. They're more likely to save, share to Stories, and follow — but they will scroll past anything that looks like a repurposed YouTube clip.",
    keep: ["Educational value and credibility signals (showing real results, real numbers)", "Any moment that has a clear 'save-worthy' insight", "Professional energy — Instagram rewards polished production more than TikTok"],
    change: ["Format to 9:16 vertical", "Duration: 15–30 seconds for Reels (not 60)", "Replace 'like and subscribe' CTAs with 'save this' and 'share to your story'"],
    add: ["Captions — Instagram users save and rewatch, captions make that easier", "A strong save CTA right after your best insight, not at the end", "Aesthetically pleasing B-roll or graphics overlay"],
    drop: ["YouTube chapter structure — Reels have no chapters", "Long setup or backstory — Instagram viewers skip to value instantly", "YouTube branding / watermarks"],
    formatDiff: "YouTube: 16:9, long-form with chapters. Instagram Reels: 9:16, under 30 seconds for maximum reach. Cover image matters as much as thumbnail — choose a frame that looks good in the 4:5 grid preview.",
    biggestTrap: "Thinking your YouTube audience and Instagram audience want the same thing. YouTube viewers search for depth; Instagram viewers scroll for quick wins. Repackage your insight as a 'one thing to remember today.'",
  },
  "youtube→youtube_short": {
    summary: "You already have the content — now you need to find the single most compelling moment and extract it. Shorts are a discovery tool for your long-form channel, not just repurposed content.",
    keep: ["The most surprising fact, result, or statement from the full video", "Your face and voice (familiarity builds subscribers)", "Any moment where you revealed something counter-intuitive"],
    change: ["Cut to a standalone 45-second story — it must make sense without context from the original video", "Remove all references to 'this video' or 'in this tutorial'", "Re-record the hook natively for Shorts if the original was filmed landscape"],
    add: ["A text overlay on screen: 'Full breakdown in my channel ↑' — this converts Short viewers to long-form watchers", "A loop ending", "Shorts-specific captions (larger text, more visual)"],
    drop: ["The intro, outro, sponsor reads, and chapter transitions", "Any moment that requires having seen the rest of the video to understand", "Horizontal formatting — Shorts must be 9:16"],
    formatDiff: "Long-form: 16:9, depth and structure rewarded. Shorts: 9:16, loop rate and completion rate rewarded. Shorts live in a separate feed — their algorithm doesn't share data with your long-form videos.",
    biggestTrap: "Posting horizontal long-form clips as Shorts. YouTube will accept them, but the completion rate tanks because black bars kill the visual experience on mobile.",
  },
  "tiktok→youtube": {
    summary: "You're expanding a viral moment into a full educational piece. TikTok virality does NOT guarantee YouTube success — the audiences have completely different expectations and patience levels.",
    keep: ["The hook concept — the same curiosity gap or controversy that worked on TikTok", "Your energy level and authenticity", "Any personal story or real result that resonated"],
    change: ["Expand the single TikTok idea into a full 8–12 minute structured breakdown", "Add credibility signals: data, examples, before/after, step-by-step instructions", "Film horizontal 16:9 with proper lighting and stable camera"],
    add: ["Chapters every 2–3 minutes so viewers can navigate and rewatch", "A clear promise at the beginning ('By the end of this, you'll know exactly how to…')", "A call to comment with their result/situation so YouTube algorithm sees comment engagement", "A thumbnail designed for 16:9 desktop preview"],
    drop: ["TikTok-speed editing (cut every 1 second) — YouTube viewers want breathing room", "Trending audio as the main audio — on YouTube, your voice is the audio", "The loop-back ending — YouTube viewers expect a clear conclusion and outro"],
    formatDiff: "TikTok: 9:16 vertical, 30–60 seconds, loop-optimised. YouTube: 16:9 horizontal, 8–15 mins for search discovery, chapter-optimised. YouTube videos are found via search months after posting; TikToks die in 48 hours.",
    biggestTrap: "Assuming your TikTok comments section will migrate to YouTube. Your YouTube version needs to be fully self-contained and searchable. Title it as if nobody has seen the TikTok.",
  },
  "tiktok→instagram": {
    summary: "TikTok and Instagram Reels are the closest platforms algorithmically, but the audiences and aesthetics differ enough to require intentional adaptation.",
    keep: ["Short duration (under 30 seconds performs best on Reels)", "Trending audio — if it's trending on TikTok, it often trends on Instagram 48–72 hours later", "The core hook and message"],
    change: ["Remove TikTok watermark (Instagram explicitly suppresses watermarked videos)", "Re-export at higher quality — Instagram compresses video less aggressively than TikTok", "Adjust caption style: Instagram captions can be longer and more intentional; TikTok captions are usually short"],
    add: ["'Save this' CTA — TikTok rewards shares/loops; Instagram rewards saves", "Hashtags in the caption (Instagram hashtags still drive discovery; TikTok hashtags matter less)", "A visually polished cover frame — Instagram grid aesthetics matter more than TikTok"],
    drop: ["TikTok @ handles in the text", "Any TikTok-specific references ('check my TikTok for…')", "The TikTok-style cut-to-beat editing if the beat is copyrighted — Instagram's licensing is stricter"],
    formatDiff: "Both: 9:16 vertical, 15–60 seconds. Key difference: Instagram surfaces content in the Explore grid as a 4:5 cropped cover image — your vertical video thumbnail matters for grid appearance.",
    biggestTrap: "Direct cross-posting from TikTok to Instagram via the native share button. This embeds the TikTok watermark, which Instagram suppresses — your Reel will get 60–80% less reach. Always re-upload the original file.",
  },
  "tiktok→youtube_short": {
    summary: "These two platforms are the most similar in format and audience. But YouTube Shorts lives next to long-form YouTube, so the same video can convert Shorts viewers into long-form subscribers — a funnel TikTok doesn't offer.",
    keep: ["Your hook, pacing, and energy", "Duration under 60 seconds", "The core idea and visual style"],
    change: ["Remove TikTok watermark before uploading", "Add a text overlay pointing to your long-form YouTube channel", "Optimise for loop rate over shares (YouTube Shorts weights loop rate more heavily than TikTok)"],
    add: ["A chapter/series context in the title (e.g., 'Part 1') — creates a reason to subscribe for continuity", "A pinned comment with a question to drive engagement in the first hour", "YouTube Shorts hashtag (#Shorts) in the description for discoverability"],
    drop: ["TikTok-only trending sounds that aren't licensed on YouTube — check before uploading", "TikTok duet/stitch framing if the other creator isn't on YouTube", "Clips with TikTok interface visible on screen"],
    formatDiff: "Both: 9:16 vertical, under 60 seconds. Key Shorts advantage: your Shorts viewer can immediately click to your long-form videos. Build that bridge intentionally in your copy.",
    biggestTrap: "Treating Shorts as a separate channel. Your Shorts and long-form videos share a subscriber base. A Shorts viewer who sees you posting both formats is far more likely to subscribe.",
  },
  "instagram→tiktok": {
    summary: "Instagram Reels are often more polished and aesthetically intentional. On TikTok, over-production signals 'brand content' — which reduces trust and engagement. You may need to intentionally rough it up.",
    keep: ["The informational value — TikTok users are hungry for educational content", "Any authentic moment — real reactions, real results, real behind-the-scenes", "Short duration (under 45 seconds works best)"],
    change: ["Reduce production polish slightly — raw, authentic content outperforms slick ads on TikTok", "Speed up the pacing — more cuts per minute than on Reels", "Add trending TikTok audio (different trends from Instagram)"],
    add: ["A loop-back ending", "On-screen text that creates a curiosity gap from frame 1", "A comment bait question at the end of the video (e.g., 'Which one are you?')"],
    drop: ["Instagram Reels-style slow transitions and aesthetic B-roll that doesn't add information", "Overly branded content — TikTok users distrust branded aesthetics", "Instagram CTA ('save this') — on TikTok the equivalent is 'follow for part 2' or 'comment your answer'"],
    formatDiff: "Both 9:16 vertical. TikTok: raw energy, fast cuts, loop-optimised. Instagram Reels: polished aesthetic, save-optimised, grid-aware. TikTok's algorithm tests content faster and colder — you'll know in 24 hours if it works.",
    biggestTrap: "Posting Instagram content at Instagram pacing on TikTok. Slow Reels-style edits feel boring in TikTok's high-speed feed. Re-edit with 50% more cuts.",
  },
  "instagram→youtube": {
    summary: "Reels show your best short-form moments. YouTube lets you show the depth behind those moments. This is the highest-leverage repurposing path — expand the 'why' behind what performed well on Instagram.",
    keep: ["The specific insight or result that made your Reel perform", "Your visual style and personal brand aesthetic", "Any audience questions from your Reel comments — these become your YouTube script"],
    change: ["Expand to 8–15 minutes with full context, backstory, and step-by-step breakdown", "Film in 16:9 horizontal with YouTube-optimised lighting and audio", "Create a custom CTR-optimised thumbnail (not repurposing the Reel cover)"],
    add: ["Chapter markers every 2–3 minutes", "SEO-optimised title with search keywords (Instagram is not searchable; YouTube is)", "A clear structure: Hook → Problem → Solution → Result → How You Can Do It"],
    drop: ["Instagram aesthetic transitions and background music as the main audio", "Short punchy captions — YouTube descriptions need SEO keywords", "The Reel's save CTA — replace with 'subscribe' and 'comment your question'"],
    formatDiff: "Instagram Reel: 9:16 vertical, 15–30 seconds, browse-discovered. YouTube: 16:9 horizontal, 8–15 minutes, search-discovered. Instagram content dies in 48 hours. YouTube SEO continues driving views for years.",
    biggestTrap: "Making the YouTube video too short because the Reel was short. 3-minute YouTube videos perform poorly in search. Expand to at least 8 minutes to get proper SEO traction.",
  },
  "youtube_short→tiktok": {
    summary: "YouTube Shorts and TikTok are the most similar platforms. The content usually ports over well — but TikTok's algorithm is more aggressive in early testing and the audience skews slightly younger.",
    keep: ["The hook, pacing, and core message", "Your face and authentic delivery", "Duration under 45 seconds"],
    change: ["Check that your audio is TikTok-licensed (YouTube Shorts uses different licensing)", "Adjust captions to TikTok font/style — it signals native content", "Add a TikTok-native trending sound underneath your voice"],
    add: ["A comment-bait question as your final line", "TikTok-relevant hashtags in the first comment (not the caption)", "Your first reply comment within 30 minutes of posting to kick the algorithm"],
    drop: ["YouTube Shorts watermark if present", "Any 'subscribe to my channel' CTA — on TikTok this sounds out of place; say 'follow for more'", "YouTube chapter references"],
    formatDiff: "Near-identical: both 9:16, under 60 seconds. TikTok's algorithm shows content cold to a fresh audience much faster. A Short with 2K views might go to 100K on TikTok within 6 hours if the hook works.",
    biggestTrap: "Assuming the same video will get the same response. TikTok communities can be different from YouTube Shorts communities even in the same niche. Watch your first 20 TikTok comments — they'll tell you immediately if your content landed.",
  },
  "youtube_short→instagram": {
    summary: "YouTube Shorts and Instagram Reels audiences overlap significantly — but Instagram viewers place more value on aesthetics and credibility signals. A raw Shorts clip may need visual polish before posting to Reels.",
    keep: ["Core message and hook structure", "Face-to-camera delivery if authentic and clear", "Duration under 30 seconds"],
    change: ["Cover frame: choose a visually appealing frame as your Reel cover (Instagram grid matters)", "Caption: expand to include a value-add sentence and a save CTA", "Polish the edit — smoother transitions if the original was very raw"],
    add: ["'Save this' CTA mid-video at your key insight moment", "3–5 targeted hashtags in the caption", "A strong first caption line before the fold (Instagram shows 2 lines before 'more…')"],
    drop: ["YouTube Shorts watermark", "'Subscribe' CTA — on Instagram say 'follow' and 'save'", "Any reference to YouTube community or channel"],
    formatDiff: "Both 9:16. Instagram Reels surfaces content in the Explore page as a grid thumbnail — your first frame matters aesthetically more than on Shorts. Also: Reels have a longer shelf life than Shorts; a Reel can resurface weeks later.",
    biggestTrap: "Ignoring the Instagram grid aesthetic. Your Reel's cover frame appears in your profile grid. If your Shorts content looks visually inconsistent with your Instagram brand, it can hurt your profile's credibility to new visitors.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COLLAPSIBLE SECTION
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, accent, defaultOpen = true, badge, children }: {
  title: string;
  accent: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: "rgba(255,255,255,0.04)",
      backdropFilter: "blur(20px)",
      border: open ? `1px solid color-mix(in srgb, ${accent} 30%, rgba(255,255,255,0.08))` : "1px solid rgba(255,255,255,0.08)",
      boxShadow: open ? `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)` : "none",
      transition: "all 0.25s ease",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ background: open ? `color-mix(in srgb, ${accent} 5%, transparent)` : "transparent" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold" style={{ color: open ? accent : "#E8E8FF" }}>{title}</span>
          {badge && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{
          color: accent,
          fontSize: 11,
          transform: open ? "rotate(180deg)" : "none",
          display: "inline-block",
          transition: "transform 0.2s",
          filter: open ? `drop-shadow(0 0 4px ${accent})` : "none",
        }}>▾</span>
      </button>
      {open && (
        <div className="px-5 py-4" style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ReverseEngineerPanel({ platform, result, loading, onAnalyze, onRetry }: ReverseEngineerPanelProps) {
  const [urlInput, setUrlInput] = useState("");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>(platform as TargetPlatform);
  const intel = PLATFORM_INTEL[platform] ?? PLATFORM_INTEL.youtube;
  const targetIntel = PLATFORM_META[targetPlatform];
  const adaptationKey = `${platform}→${targetPlatform}`;
  const adaptation = CROSS_PLATFORM_ADAPTATION[adaptationKey] ?? null;
  const isSamePlatform = platform === targetPlatform || adaptationKey === "youtube→youtube";

  const video: EnrichedVideo | null =
    result?.type === "video" ? result.video :
    result?.type === "tiktok-batch" ? (result.videos[0] ?? null) :
    null;

  const channel: ChannelData | null =
    result?.type === "video" ? (result.channel ?? null) : null;

  // Hook type detection from title
  const getHookAnalysis = (title: string) => {
    if (/^how to|^how i/i.test(title)) return {
      type: "Tutorial Hook", emoji: "🎓",
      plain: "This video opens with 'How to' or 'How I' — it promises a concrete skill, result, or transformation.",
      whyItWorks: "Tutorial hooks work because they make an explicit promise upfront. The viewer knows exactly what they'll learn if they watch. This reduces risk and increases clicks.",
      toReplicate: `Start your script with: "In this video I'm going to show you exactly how to [specific result] — step by step." Then deliver on that promise immediately.`,
    };
    if (/\d/.test(title)) return {
      type: "Number Hook", emoji: "🔢",
      plain: "This video uses a specific number in the title — a list, a timeframe, or a stat.",
      whyItWorks: "Numbers create a mental contract with the viewer: you know exactly what you're getting (5 tips, not 'some tips'). Specificity feels like credibility.",
      toReplicate: `Use a number in your title. Instead of 'Ways to improve your trading,' use '7 rules that reduced my losses by 60%.'`,
    };
    if (/why|what|when|where|who/i.test(title)) return {
      type: "Question Hook", emoji: "❓",
      plain: "This video opens with a question — it creates a knowledge gap that viewers feel compelled to close.",
      whyItWorks: "The human brain physically cannot ignore an open question. The viewer HAS to watch to get the answer. This is one of the highest-retention hook formats.",
      toReplicate: `Open with a question your audience is already asking themselves. 'Why do 90% of funded traders fail their second account?' makes them stay to hear the answer.`,
    };
    if (/stop|don't|never|avoid|mistake/i.test(title)) return {
      type: "Warning / Loss-Aversion Hook", emoji: "⚠️",
      plain: "This video warns about a mistake, something to avoid, or a wrong way of doing something.",
      whyItWorks: "Loss-aversion is 2x stronger psychologically than the desire for gain. If viewers think they might be making this mistake right now, they MUST watch to find out.",
      toReplicate: `Think about the most common mistake in your niche. Lead with: 'Stop doing [X] if you want [result].' Make the viewer feel like they might be doing it wrong right now.`,
    };
    if (/i made|i earned|i lost|i went|i tried/i.test(title)) return {
      type: "Confession / Story Hook", emoji: "🎭",
      plain: "This video opens with a personal result or first-person story.",
      whyItWorks: "First-person results feel real and unscripted. When someone says 'I did X and got Y,' it's more believable than 'here's how to get Y.' It also creates empathy — viewers see themselves in the creator.",
      toReplicate: `Share a specific personal result or moment. 'I lost my funded account doing this one thing — here's exactly what happened.' Real stories beat advice every time.`,
    };
    return {
      type: "Direct Statement Hook", emoji: "💬",
      plain: "This video opens with a bold, direct statement — a claim designed to confirm or challenge what the viewer believes.",
      whyItWorks: "Bold statements create immediate cognitive engagement. The viewer either agrees (and feels validated) or disagrees (and wants to argue) — both responses keep them watching.",
      toReplicate: `Open with the most counterintuitive or direct thing you can say about your topic. 'Most funded traders fail not because of their strategy — but because of this one mental habit.'`,
    };
  };

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="rounded-2xl p-5" style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${intel.color} 10%, rgba(255,255,255,0.04)), rgba(255,255,255,0.03))`,
        border: `1px solid color-mix(in srgb, ${intel.color} 30%, rgba(255,255,255,0.08))`,
        backdropFilter: "blur(20px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
      }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0"
              style={{ background: `color-mix(in srgb, ${intel.color} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${intel.color} 35%, transparent)`, boxShadow: `0 0 16px color-mix(in srgb, ${intel.color} 20%, transparent)` }}>
              ⚙
            </div>
            <div>
              <h2 className="text-[17px] font-bold" style={{ color: "#E8E8FF" }}>Reverse Engineer</h2>
              <p className="text-[12px] mt-0.5" style={{ color: "rgba(232,232,255,0.5)" }}>
                Analyze content FROM <span style={{ color: intel.color }}>{intel.label}</span>
                {!isSamePlatform && <> → recreate it FOR <span style={{ color: targetIntel.color }}>{targetIntel.label}</span></>}
              </p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0" style={{ background: `color-mix(in srgb, ${intel.color} 20%, transparent)`, color: intel.color, border: `1px solid color-mix(in srgb, ${intel.color} 30%, transparent)` }}>
            MODE D
          </div>
        </div>
        {/* Platform tagline */}
        <div className="mt-3 px-3 py-2 rounded-xl text-[12px]" style={{ background: "rgba(0,0,0,0.25)", color: "rgba(232,232,255,0.7)", borderLeft: `3px solid ${intel.color}` }}>
          💡 {intel.tagline}
        </div>
      </div>

      {/* ── URL Input ── */}
      <div className="flex gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder={`Paste a ${intel.label} URL to break it down completely…`}
          onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) { onAnalyze(urlInput.trim()); } }}
          className="flex-1 rounded-xl px-4 py-3 text-[13px] outline-none glass-input"
          style={{ color: "#E8E8FF" }}
        />
        <button
          onClick={() => { if (urlInput.trim()) onAnalyze(urlInput.trim()); }}
          disabled={loading || !urlInput.trim()}
          className="rounded-xl px-5 py-3 text-[13px] font-semibold shrink-0 transition-all"
          style={{
            background: intel.color,
            color: platform === "tiktok" ? "#000" : "#fff",
            opacity: (loading || !urlInput.trim()) ? 0.4 : 1,
            boxShadow: urlInput.trim() ? `0 4px 16px color-mix(in srgb, ${intel.color} 35%, transparent)` : "none",
          }}
        >
          {loading ? "Analyzing…" : "Analyze →"}
        </button>
      </div>

      {/* ── Target Platform Selector ── */}
      <div className="rounded-2xl p-4" style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
      }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(232,232,255,0.45)" }}>
          I WANT TO RECREATE THIS CONTENT FOR →
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(PLATFORM_META) as [TargetPlatform, typeof PLATFORM_META[TargetPlatform]][]).map(([key, meta]) => {
            const isActive = targetPlatform === key;
            const isSource = platform === key;
            return (
              <button
                key={key}
                onClick={() => setTargetPlatform(key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: isActive ? `color-mix(in srgb, ${meta.color} 20%, transparent)` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? meta.color : "rgba(255,255,255,0.1)"}`,
                  color: isActive ? meta.color : "rgba(232,232,255,0.55)",
                  boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${meta.color} 25%, transparent)` : "none",
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                {isSource && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>SOURCE</span>}
              </button>
            );
          })}
        </div>
        {!isSamePlatform && adaptation && (
          <div className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.15)", color: "rgba(255,200,100,0.9)" }}>
            ⚡ Cross-platform blueprint active — scroll down to see the full <strong>{intel.label} → {targetIntel.label}</strong> adaptation guide after the live analysis.
          </div>
        )}
        {!isSamePlatform && !adaptation && (
          <div className="mt-3 px-3 py-2 rounded-xl text-[11px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(232,232,255,0.5)" }}>
            Analyze a video above to get a personalized cross-platform adaptation blueprint.
          </div>
        )}
      </div>

      {/* ── Live Content Breakdown (when video analyzed) ── */}
      {video && (
        <div className="rounded-2xl overflow-hidden" style={{
          background: `color-mix(in srgb, ${intel.color} 5%, rgba(255,255,255,0.04))`,
          border: `1px solid color-mix(in srgb, ${intel.color} 25%, transparent)`,
          backdropFilter: "blur(20px)",
        }}>
          {/* Header */}
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: `color-mix(in srgb, ${intel.color} 8%, transparent)` }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: intel.color }}>CONTENT ANALYSIS — LIVE</div>
              {(platform === "tiktok" || platform === "instagram") && onRetry && (
                <button
                  onClick={onRetry}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all shrink-0"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(232,232,255,0.7)",
                    opacity: loading ? 0.4 : 1,
                  }}
                >
                  <span style={{ fontSize: 11 }}>↺</span> Re-scrape Fresh Data
                </button>
              )}
            </div>
            <div className="text-[14px] font-bold" style={{ color: "#E8E8FF" }}>{video.title || video.channel}</div>
            {channel && <div className="text-[11px] mt-0.5" style={{ color: "rgba(232,232,255,0.5)" }}>{channel.name} · {channel.subs >= 1000000 ? `${(channel.subs/1000000).toFixed(1)}M` : `${(channel.subs/1000).toFixed(0)}K`} subscribers</div>}
          </div>

          {/* Data accuracy banner for TikTok / Instagram */}
          {(platform === "tiktok" || platform === "instagram") && (
            <div className="mx-5 mt-4 rounded-xl px-4 py-3" style={{
              background: "rgba(255,184,0,0.07)",
              border: "1px solid rgba(255,184,0,0.2)",
            }}>
              <div className="flex items-start gap-2.5">
                <span className="text-[15px] shrink-0 mt-0.5">⚠️</span>
                <div>
                  <div className="text-[11px] font-bold mb-1" style={{ color: "#FFB800" }}>
                    {platform === "tiktok" ? "TikTok" : "Instagram"} Data Accuracy Notice
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,232,255,0.7)" }}>
                    {platform === "tiktok"
                      ? "TikTok blocks official API access. This data is scraped via Apify and may be 12–48 hours old. View counts, saves, and shares are real but may not reflect the latest numbers. Signals marked \"estimated\" below are calculated approximations — not direct platform data."
                      : "Instagram restricts third-party data access. This data is scraped via Apify and may be 24–48 hours old. Engagement rates and reach data are approximations. For most accurate numbers, cross-check inside Instagram's native Insights panel."}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { label: "Views/Likes/Comments", reliable: true },
                      { label: "Saves & Shares", reliable: platform === "tiktok" },
                      { label: "Completion Rate", reliable: false },
                      { label: "Loop Rate", reliable: false },
                      { label: "Reach & Impressions", reliable: false },
                    ].map(({ label, reliable }) => (
                      <span key={label} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                        background: reliable ? "rgba(0,255,136,0.1)" : "rgba(255,184,0,0.1)",
                        border: `1px solid ${reliable ? "rgba(0,255,136,0.2)" : "rgba(255,184,0,0.2)"}`,
                        color: reliable ? "#00FF88" : "#FFB800",
                      }}>
                        {reliable ? "✓" : "~"} {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-5 space-y-5">

            {/* Signal scores */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "rgba(232,232,255,0.45)" }}>HOW THIS CONTENT SCORES ON THE ALGORITHM</div>
              <div className="grid grid-cols-3 gap-3">
                {intel.algorithmSignals.map(({ signal, target, weight }) => {
                  const rawLikeRate = video.likes / Math.max(video.views, 1);
                  const isScrapedPlatform = platform === "tiktok" || platform === "instagram";
                  const sigLower = signal.toLowerCase();

                  // Which signals are estimated (not directly from API)
                  const isEstimated = isScrapedPlatform && (
                    sigLower.includes("completion") ||
                    sigLower.includes("loop") ||
                    sigLower.includes("3-second") ||
                    sigLower.includes("saves") ||
                    sigLower.includes("send")
                  );

                  const actual =
                    sigLower.includes("completion") ? `${(video.engagement * 12).toFixed(0)}%` :
                    sigLower.includes("ctr") ? "—" :
                    sigLower.includes("avd") ? "—" :
                    sigLower.includes("saves") ? `${(rawLikeRate * 100 * 0.8).toFixed(1)}%` :
                    sigLower.includes("share") || sigLower.includes("send") ? `${(video.shares ? (video.shares / Math.max(video.views, 1) * 100).toFixed(1) : (rawLikeRate * 100 * 0.4).toFixed(1))}%` :
                    sigLower.includes("3-second") || sigLower.includes("loop") ? `${Math.min(99, (video.engagement * 8)).toFixed(0)}%` :
                    `${video.engagement.toFixed(2)}%`;

                  const numericTarget = parseFloat(target);
                  const numericActual = parseFloat(actual);
                  const isGood = !isNaN(numericActual) && !isNaN(numericTarget) && numericActual >= numericTarget;
                  const statusColor = actual === "—" ? "rgba(232,232,255,0.4)" : isEstimated ? "#FFB800" : isGood ? "#00FF88" : "#FF453A";

                  return (
                    <div key={signal} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${actual === "—" ? "rgba(255,255,255,0.06)" : isEstimated ? "rgba(255,184,0,0.2)" : isGood ? "rgba(0,255,136,0.2)" : "rgba(255,69,58,0.2)"}` }}>
                      <div className="text-[9px] mb-1.5 leading-tight" style={{ color: "rgba(232,232,255,0.45)" }}>{signal.split(" (")[0]}</div>
                      <div className="text-[20px] font-bold font-mono leading-none mb-1" style={{ color: statusColor }}>{actual}</div>
                      <div className="text-[9px]" style={{ color: "rgba(232,232,255,0.35)" }}>target: {target}</div>
                      <div className="text-[8px] mt-1 font-semibold" style={{ color: statusColor }}>
                        {actual === "—" ? "needs platform data" : isEstimated ? "~ estimated (not direct API)" : isGood ? "✓ above target" : "↑ below target"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hook Analysis */}
            {video.title && (() => {
              const hook = getHookAnalysis(video.title);
              return (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="px-4 py-3" style={{ background: `color-mix(in srgb, ${intel.color} 8%, rgba(0,0,0,0.3))` }}>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(232,232,255,0.45)" }}>HOOK TYPE DETECTED</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[18px]">{hook.emoji}</span>
                      <span className="text-[14px] font-bold" style={{ color: intel.color }}>{hook.type}</span>
                    </div>
                    <div className="text-[11px] mt-1.5 italic" style={{ color: "rgba(232,232,255,0.55)" }}>&ldquo;{video.title}&rdquo;</div>
                  </div>
                  <div className="px-4 py-3 space-y-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(232,232,255,0.4)" }}>WHAT IT IS</div>
                      <p className="text-[12px]" style={{ color: "#E8E8FF" }}>{hook.plain}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(232,232,255,0.4)" }}>WHY IT WORKS</div>
                      <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.75)" }}>{hook.whyItWorks}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: `color-mix(in srgb, ${intel.color} 8%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${intel.color} 20%, transparent)` }}>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: intel.color }}>HOW TO REPLICATE THIS HOOK</div>
                      <p className="text-[12px]" style={{ color: "#E8E8FF" }}>{hook.toReplicate}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Performance context */}
            <div className="rounded-xl p-3.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-2.5" style={{ color: "rgba(232,232,255,0.4)" }}>PERFORMANCE AT A GLANCE</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Views", value: video.views >= 1000000 ? `${(video.views/1000000).toFixed(1)}M` : `${(video.views/1000).toFixed(0)}K`, color: intel.color },
                  { label: "Engagement Rate", value: `${video.engagement.toFixed(2)}%`, color: video.engagement >= 4 ? "#00FF88" : video.engagement >= 2 ? "#FFB800" : "#FF453A" },
                  { label: "Views / Day", value: `${video.velocity >= 1000 ? `${(video.velocity/1000).toFixed(1)}K` : video.velocity.toFixed(0)}`, color: "#00D4FF" },
                  { label: "vs Channel Avg", value: `${video.vsBaseline >= 1 ? `+${((video.vsBaseline - 1) * 100).toFixed(0)}%` : `-${((1 - video.vsBaseline) * 100).toFixed(0)}%`}`, color: video.vsBaseline >= 1.5 ? "#00FF88" : video.vsBaseline >= 0.8 ? "#FFB800" : "#FF453A" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(232,232,255,0.38)" }}>{label}</div>
                    <div className="text-[16px] font-bold font-mono" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Your replication blueprint personalized to this content */}
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2.5" style={{ color: "rgba(232,232,255,0.4)" }}>YOUR PERSONALIZED REPLICATION BLUEPRINT</div>
              <div className="space-y-2">
                {[
                  {
                    step: 1,
                    action: "Copy the hook structure",
                    detail: `Use the same "${getHookAnalysis(video.title || "").type}" formula but change the topic to your angle. Your first sentence should follow the same emotional trigger.`,
                  },
                  {
                    step: 2,
                    action: `Target ${Math.round(video.views * 1.1 / 1000)}K+ views as your success benchmark`,
                    detail: `This creator got ${video.views >= 1000 ? `${(video.views/1000).toFixed(0)}K` : video.views} views on this. Matching their baseline means you're at parity. Beating it by 10% means your angle resonated better.`,
                  },
                  {
                    step: 3,
                    action: `Hit ${Math.max(video.engagement, 3).toFixed(1)}%+ engagement rate`,
                    detail: `This video has ${video.engagement.toFixed(2)}% engagement. If yours beats this, your audience resonated more strongly with your version. Check your comment sentiment.`,
                  },
                  {
                    step: 4,
                    action: `Hook window: you have ${intel.hookWindow}`,
                    detail: `For ${intel.label}, the algorithm decides whether to push your content based entirely on what happens in the first ${intel.hookWindow}. If viewers don't commit in that window, the video is dead.`,
                  },
                  ...(platform === "youtube" ? [
                    { step: 5, action: "Add chapters every 2–3 minutes", detail: "Chapters increase average view duration because viewers can jump to sections they care about AND come back to sections they want to rewatch. Both boost your AVD metric." },
                    { step: 6, action: "End Chapter 1 with a micro-tease", detail: "Before transitioning to the next section, say: 'But the thing that actually surprised me is coming in a minute…' This keeps the retention graph flat." },
                  ] : []),
                  ...(platform === "tiktok" ? [
                    { step: 5, action: "Loop the ending back to frame 1", detail: "End your video so the last frame either IS the first frame, or transitions naturally back to it. This triggers TikTok's auto-loop and increases watch time without more content." },
                    { step: 6, action: "Check trending audio from the last 7 days", detail: "Using an audio that's currently trending in your category gives you a +40% organic distribution boost. TikTok's algorithm tests trending sounds with new accounts." },
                  ] : []),
                  ...(platform === "instagram" ? [
                    { step: 5, action: "Place your save CTA at the moment of highest value", detail: "Don't wait until the end. The moment you deliver your best insight — pause and say: 'Save this, you'll want to come back to it.' This is when they're most engaged." },
                    { step: 6, action: "Add text overlay matching your spoken words", detail: "30–40% of your viewers are watching on mute. Every key point you speak should also appear as text on screen. Doubles your accessible audience." },
                  ] : []),
                ].map(({ step, action, detail }) => (
                  <div key={step} className="flex gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                      style={{ background: `color-mix(in srgb, ${intel.color} 20%, transparent)`, color: intel.color }}>
                      {step}
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold mb-0.5" style={{ color: "#E8E8FF" }}>{action}</div>
                      <div className="text-[11px]" style={{ color: "rgba(232,232,255,0.6)" }}>{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Cross-Platform Adaptation Guide ── */}
      {!isSamePlatform && adaptation && (
        <Section title={`${intel.label} → ${targetIntel.label} Adaptation Guide`} accent={targetIntel.color} badge="ADAPT" defaultOpen={true}>
          <div className="space-y-4">

            {/* Summary */}
            <div className="rounded-xl px-4 py-3" style={{ background: `color-mix(in srgb, ${targetIntel.color} 8%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${targetIntel.color} 20%, transparent)` }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: targetIntel.color }}>WHAT THIS ADAPTATION MEANS</div>
              <p className="text-[12px]" style={{ color: "#E8E8FF" }}>{adaptation.summary}</p>
            </div>

            {/* Format Difference */}
            <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: "rgba(232,232,255,0.45)" }}>FORMAT DIFFERENCES</div>
              <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.8)" }}>{adaptation.formatDiff}</p>
            </div>

            {/* Keep / Change / Add / Drop grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { heading: "✅ KEEP", items: adaptation.keep, bg: "rgba(0,255,136,0.06)", border: "rgba(0,255,136,0.15)", color: "#00FF88" },
                { heading: "✏️ CHANGE", items: adaptation.change, bg: "rgba(255,184,0,0.06)", border: "rgba(255,184,0,0.15)", color: "#FFB800" },
                { heading: "➕ ADD", items: adaptation.add, bg: `color-mix(in srgb, ${targetIntel.color} 6%, rgba(0,0,0,0.2))`, border: `color-mix(in srgb, ${targetIntel.color} 20%, transparent)`, color: targetIntel.color },
                { heading: "🗑 DROP", items: adaptation.drop, bg: "rgba(255,69,58,0.06)", border: "rgba(255,69,58,0.15)", color: "#FF453A" },
              ].map(({ heading, items, bg, border, color }) => (
                <div key={heading} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>{heading}</div>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-[11px]" style={{ color: "rgba(232,232,255,0.75)" }}>
                        <span style={{ color, flexShrink: 0 }}>·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Biggest Trap */}
            <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)" }}>
              <span className="text-[18px] shrink-0">⚠️</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#FF453A" }}>BIGGEST TRAP WHEN DOING THIS ADAPTATION</div>
                <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.85)" }}>{adaptation.biggestTrap}</p>
              </div>
            </div>

          </div>
        </Section>
      )}

      {/* ── Algorithm Signals ── */}
      <Section title={`${intel.label} Algorithm — What Actually Matters`} accent={intel.color} badge="2026" defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.6)" }}>
            These are the exact signals the {intel.label} algorithm uses to decide whether to push or bury your content. Each one has a target threshold — hit it and the algorithm amplifies you. Miss it and you stay invisible.
          </p>
          {intel.algorithmSignals.map(({ signal, target, weight, plain, tip, howToFix, badExample, goodExample }) => (
            <div key={signal} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Signal header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: `color-mix(in srgb, ${intel.color} 8%, rgba(0,0,0,0.3))` }}>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: "#E8E8FF" }}>{signal}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(232,232,255,0.45)" }}>
                    Target: <span style={{ color: intel.color }}>{target}</span> · Algorithm weight: <span style={{ color: intel.color }}>{weight}</span>
                  </div>
                </div>
                <div className="text-[22px] font-bold font-mono shrink-0" style={{ color: intel.color }}>{weight}</div>
              </div>
              {/* Weight bar */}
              <div className="h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full" style={{ width: weight, background: `linear-gradient(90deg, ${intel.color}, color-mix(in srgb, ${intel.color} 50%, transparent))` }} />
              </div>
              {/* Content */}
              <div className="px-4 py-3.5 space-y-3" style={{ background: "rgba(0,0,0,0.15)" }}>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(232,232,255,0.4)" }}>IN PLAIN ENGLISH</div>
                  <p className="text-[12px]" style={{ color: "#E8E8FF" }}>{plain}</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(232,232,255,0.4)" }}>HOW TO HIT THIS TARGET</div>
                  <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.75)" }}>{tip}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(232,232,255,0.4)" }}>SPECIFIC FIX</div>
                  <p className="text-[12px] mb-2" style={{ color: "rgba(232,232,255,0.75)" }}>{howToFix}</p>
                  <div className="space-y-1.5">
                    <div className="flex gap-2 text-[11px]"><span style={{ color: "#FF453A" }}>✗</span><span style={{ color: "rgba(232,232,255,0.5)" }}>{badExample}</span></div>
                    <div className="flex gap-2 text-[11px]"><span style={{ color: "#00FF88" }}>✓</span><span style={{ color: "rgba(232,232,255,0.8)" }}>{goodExample}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Script Formula ── */}
      <Section title="Script Formula — Step by Step" accent={intel.color} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.6)" }}>
            Every high-performing video on {intel.label} follows this exact structure. Follow these steps in order. Don&apos;t skip any of them.
          </p>
          {intel.scriptFormula.map(({ step, plain, template, why, mistake }) => (
            <div key={step} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: `color-mix(in srgb, ${intel.color} 8%, rgba(0,0,0,0.3))` }}>
                <span className="text-[11px] font-bold" style={{ color: intel.color }}>{step.split("—")[0].trim()}</span>
                <span className="text-[12px] font-semibold" style={{ color: "#E8E8FF" }}>{step.split("—")[1]?.trim()}</span>
              </div>
              <div className="px-4 py-3.5 space-y-2.5" style={{ background: "rgba(0,0,0,0.15)" }}>
                <p className="text-[12px]" style={{ color: "#E8E8FF" }}>{plain}</p>
                <div className="rounded-xl px-3.5 py-2.5" style={{ background: `color-mix(in srgb, ${intel.color} 7%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${intel.color} 20%, transparent)` }}>
                  <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: intel.color }}>COPY-PASTE TEMPLATE</div>
                  <p className="text-[12px] italic" style={{ color: "#E8E8FF" }}>{template}</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "rgba(0,255,136,0.6)" }}>WHY THIS WORKS</div>
                    <p className="text-[11px]" style={{ color: "rgba(232,232,255,0.65)" }}>{why}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-[11px] rounded-lg px-3 py-2" style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.15)" }}>
                  <span style={{ color: "#FF453A" }} className="shrink-0">✗ Common mistake:</span>
                  <span style={{ color: "rgba(232,232,255,0.6)" }}>{mistake}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Title Formulas ── */}
      <Section title="Title Formulas That Actually Get Clicked" accent={intel.color} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.6)" }}>
            Your title is the second thing people see after your thumbnail. These are the 4 formats that consistently outperform generic titles in your niche.
          </p>
          {intel.titleFormulas.map(({ pattern, template, example, why }) => (
            <div key={pattern} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-2.5" style={{ background: `color-mix(in srgb, ${intel.color} 6%, rgba(0,0,0,0.3))` }}>
                <div className="text-[12px] font-bold" style={{ color: intel.color }}>{pattern}</div>
              </div>
              <div className="px-4 py-3 space-y-2" style={{ background: "rgba(0,0,0,0.15)" }}>
                <div className="rounded-lg px-3 py-2 text-[11px] font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(232,232,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "rgba(232,232,255,0.4)" }}>Template: </span>{template}
                </div>
                <div className="rounded-lg px-3 py-2 text-[12px] font-medium" style={{ background: `color-mix(in srgb, ${intel.color} 7%, rgba(0,0,0,0.3))`, color: "#E8E8FF", border: `1px solid color-mix(in srgb, ${intel.color} 18%, transparent)` }}>
                  <span style={{ color: intel.color }}>Example: </span>{example}
                </div>
                <div className="flex gap-2 text-[11px]">
                  <span style={{ color: "#00FF88" }} className="shrink-0">→</span>
                  <span style={{ color: "rgba(232,232,255,0.6)" }}>{why}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Thumbnail Rules ── */}
      <Section title="Thumbnail / Cover — Rules That Drive Clicks" accent={intel.color} defaultOpen={false}>
        <div className="space-y-2.5">
          <p className="text-[12px]" style={{ color: "rgba(232,232,255,0.6)" }}>
            Your thumbnail is the first thing people see. A bad thumbnail means nobody clicks — regardless of how good the content is. Follow every rule below.
          </p>
          {intel.thumbnailRules.map(({ rule, detail }) => (
            <div key={rule} className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-start gap-2.5">
                <span style={{ color: intel.color }} className="shrink-0 mt-0.5 text-[14px]">✓</span>
                <div>
                  <div className="text-[12px] font-semibold mb-0.5" style={{ color: "#E8E8FF" }}>{rule}</div>
                  <div className="text-[11px]" style={{ color: "rgba(232,232,255,0.55)" }}>{detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Replication Blueprint ── */}
      <Section title="Replication Blueprint — Exact Steps to Copy Any Video" accent={intel.color} defaultOpen={false}>
        <div className="space-y-3">
          <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: `color-mix(in srgb, ${intel.color} 8%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${intel.color} 20%, transparent)`, color: "#E8E8FF" }}>
            ⚠️ <strong>Important:</strong> Do not copy content. Copy the <em>structure</em> — the hook format, the pacing, the section order. Use your own topic, your own angle, your own story.
          </div>
          {intel.replicationSteps.map(({ num, action, detail }) => (
            <div key={num} className="flex gap-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-bold mt-0.5"
                style={{ background: `color-mix(in srgb, ${intel.color} 20%, transparent)`, color: intel.color, border: `1px solid color-mix(in srgb, ${intel.color} 30%, transparent)` }}>
                {num}
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-1" style={{ color: "#E8E8FF" }}>{action}</div>
                <div className="text-[11px]" style={{ color: "rgba(232,232,255,0.6)" }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Common Mistakes ── */}
      <Section title="Common Mistakes — Things to Stop Doing Immediately" accent="#FF453A" defaultOpen={false}>
        <div className="space-y-2">
          <p className="text-[12px] mb-3" style={{ color: "rgba(232,232,255,0.6)" }}>
            These are the most common reasons why {intel.label} content underperforms. If you&apos;re doing any of these, fixing them will improve your numbers faster than anything else.
          </p>
          {intel.commonMistakes.map((mistake, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,69,58,0.07)", border: "1px solid rgba(255,69,58,0.15)" }}>
              <span className="text-[14px] shrink-0">🚫</span>
              <span className="text-[12px]" style={{ color: "rgba(232,232,255,0.8)" }}>{mistake}</span>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
