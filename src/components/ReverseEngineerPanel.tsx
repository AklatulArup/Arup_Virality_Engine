"use client";

import { useState } from "react";
import type { AnalysisResult, ChannelData, EnrichedVideo } from "@/lib/types";

type Platform = "youtube" | "youtube_short" | "tiktok" | "instagram";
type TargetPlatform = "youtube" | "youtube_short" | "tiktok" | "instagram";

interface ReverseEngineerPanelProps {
  platform: Platform;
  result: AnalysisResult | null;
  loading: boolean;
  onAnalyze: (input: string) => void;
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
    tagline: "YouTube rewards watch time above everything else. If people stop watching early, the algorithm buries the video.",

    algorithmSignals: [
      {
        signal: "Click-Through Rate (CTR)",
        target: "6–10%",
        weight: "30%",
        plain: "Out of every 100 people who SEE your thumbnail, how many actually click on it? If fewer than 6 do, YouTube stops showing it.",
        tip: "Thumbnail + title must create a curiosity gap — make them feel like they're missing something important if they don't click.",
        howToFix: "Test 3 thumbnail versions. Use a surprised/shocked face, bold 3-word text, and a bright background. The text should NOT repeat the title — it should add to it.",
        badExample: "Generic text thumbnail with no face → 2% CTR",
        goodExample: "Your face looking shocked + '3 words' overlay + bright red background → 9% CTR",
      },
      {
        signal: "Average View Duration (AVD)",
        target: ">50% of runtime",
        weight: "50%",
        plain: "If your video is 10 minutes long, the average viewer needs to watch at least 5 minutes. This is the MOST important signal. YouTube literally sells ads based on watch time.",
        tip: "Every 2 minutes, plant a reason to keep watching. Say things like 'and in a minute I'll show you the part that actually surprised me…' before the payoff.",
        howToFix: "Open your YouTube Studio analytics. Find where the red retention line drops sharply. That moment in the video is boring — cut it or rewrite it.",
        badExample: "Long intro talking about yourself → viewers leave at 0:45",
        goodExample: "Start with the result/payoff first, THEN explain how → viewers stay for the full explanation",
      },
      {
        signal: "Satisfaction (Likes per View)",
        target: ">4% like rate",
        weight: "20%",
        plain: "If 1,000 people watch your video, at least 40 should click Like. This tells YouTube the content delivered on its promise.",
        tip: "Ask for the like at the MOMENT of highest value — when you just delivered the key insight — not at the end when people have already checked out.",
        howToFix: "Say: 'If that just saved you time, hit the like — it takes one second and it helps me keep making these.' Say it mid-video.",
        badExample: "'Like and subscribe if you enjoyed' at the end → 1.2% like rate",
        goodExample: "'Drop a like if this is useful' right after your best tip → 5% like rate",
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
      "Starting with a long intro or 'Hey guys welcome back'",
      "Not asking for likes or asking at the very end only",
      "Videos with no chapters or timestamps",
      "Thumbnail text that repeats the title word-for-word",
      "Not teasing the next video before ending",
    ],
  },

  tiktok: {
    color: "#00f2ea",
    label: "TikTok",
    icon: "♪",
    hookWindow: "First 3 seconds",
    tagline: "TikTok's algorithm pushes content to strangers first. You do NOT need followers to go viral — but you need to stop the scroll in 3 seconds.",

    algorithmSignals: [
      {
        signal: "Completion Rate",
        target: ">70% watch the full video",
        weight: "45%",
        plain: "If 1,000 people see your video and 700 watch it all the way through, TikTok thinks it's great content and shows it to 10,000 more. If only 200 finish it, TikTok buries it.",
        tip: "Keep your first TikToks under 30 seconds. A 100% completion rate on a 30s video beats a 40% rate on a 3-minute one.",
        howToFix: "Cut everything that doesn't DIRECTLY contribute to the point. If a second doesn't add information or emotion — delete it.",
        badExample: "30-second intro explaining what you're about to say → viewers swipe away at 5 seconds",
        goodExample: "First word = the most interesting thing. Then deliver it. Then end. → 85% completion",
      },
      {
        signal: "Rewatch / Loop Rate",
        target: "Average viewer watches 1.3× (views > unique viewers)",
        weight: "35%",
        plain: "If people watch your video more than once, TikTok interprets it as extremely high-quality content. This is worth MORE than a like.",
        tip: "Build in a reason to rewatch: a detail they might have missed, a loop-back ending, or a callback at the end that only makes sense if you watched from the start.",
        howToFix: "End your video mid-sentence OR with a visual that matches your opening frame. This triggers an automatic rewatch as the loop restarts.",
        badExample: "Definitive ending: 'And that's everything, thanks for watching!' → zero loops",
        goodExample: "Last frame = first frame. End on an open loop question. → 1.5x rewatch rate",
      },
      {
        signal: "Shares & DMs",
        target: ">2% of viewers share it",
        weight: "20%",
        plain: "The most powerful signal on TikTok. When someone sends your video to a friend, TikTok treats it as a massive endorsement. 100 DM shares can trigger a viral wave.",
        tip: "Create content that makes people think 'I need to send this to [specific person].' The more specific the audience, the more shareable.",
        howToFix: "Build content around universal experiences in your niche. 'POV: your prop firm just emailed you' or 'Every trader has done this at least once.'",
        badExample: "Generic advice video nobody relates to personally → 0.1% share rate",
        goodExample: "Relatable moment video that speaks directly to a specific experience → 4% share rate",
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
      "Starting with a slow intro or greeting before the hook",
      "Making videos longer than necessary — if you can say it in 20s, don't make it 60s",
      "Not adding on-screen text — silent viewers can't engage with audio-only content",
      "Ending definitively instead of creating a loop or follow prompt",
      "Posting at random times without checking your audience's active hours",
    ],
  },

  instagram: {
    color: "#E1306C",
    label: "Instagram",
    icon: "◎",
    hookWindow: "First 1 second",
    tagline: "Instagram rewards saves and sends above all else. Make content people bookmark and share privately — not just content they like.",

    algorithmSignals: [
      {
        signal: "Sends / DM Shares",
        target: ">4% of reach sends it to someone",
        weight: "40%",
        plain: "When someone DMs your reel to a friend, Instagram interprets it as the highest possible endorsement. 100 sends can trigger a distribution wave to 50,000 new people.",
        tip: "Design content specifically to be sent. Think: 'Who would someone send this to, and why?' Build around that exact scenario.",
        howToFix: "Make content that solves a problem someone else has. 'Sending this to my friend who just started trading' is the reaction you want to design for.",
        badExample: "Generic motivational quote — people don't send these because they're everywhere",
        goodExample: "Specific 'send this to your trading partner before you both blow your accounts' content → 6% send rate",
      },
      {
        signal: "Saves Rate",
        target: ">3% of reach saves it",
        weight: "30%",
        plain: "When someone taps the bookmark icon, they're saying 'I want to come back to this.' Instagram treats saves as a signal that your content is highly valuable and reference-worthy.",
        tip: "Tutorial content, checklists, and 'how to' step-by-step posts get saved. The moment someone thinks 'I'll need this later,' they save it.",
        howToFix: "At the exact moment in your reel where you deliver the key value, say 'Save this — you'll want to refer back to it.' Don't wait until the end.",
        badExample: "Entertainment content — funny but not useful. Gets watched but not saved.",
        goodExample: "Step-by-step tutorial or resource list: 'Save this checklist before your next trade' → 5% save rate",
      },
      {
        signal: "3-Second View Rate",
        target: ">60% of viewers watch at least 3 seconds",
        weight: "30%",
        plain: "If 1,000 people see your reel but only 300 watch past the first 3 seconds, Instagram decides the content isn't interesting and stops showing it to others.",
        tip: "Your first frame must be the most interesting, most surprising, or most visually striking moment of the entire video. No exceptions.",
        howToFix: "Edit your reels so the best part comes FIRST. Then explain how you got there. This is called 'front-loading the payoff.'",
        badExample: "First frame: you sitting down, adjusting mic, saying 'hi guys' → 20% 3-second rate",
        goodExample: "First frame: the result/punchline/reveal, then cut back to explain → 72% 3-second rate",
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
      "Starting the reel with your name, logo, or 'hi guys'",
      "Placing the save CTA at the very end of the reel",
      "No text overlay — losing all muted viewers",
      "Caption first line wasted on hashtags or 'new reel out now'",
      "Over-produced content that looks like an advertisement — Instagram rewards authenticity",
    ],
  },

  youtube_short: {
    color: "#FF0076",
    label: "YouTube Shorts",
    icon: "⚡",
    hookWindow: "First 3 seconds",
    tagline: "YouTube Shorts competes directly with TikTok. The algorithm rewards loop rate and completion — not subscribers or watch time in minutes.",

    algorithmSignals: [
      {
        signal: "Loop Rate",
        target: ">40% of viewers rewatch",
        weight: "35%",
        plain: "YouTube Shorts auto-loops your video. If 40+ out of 100 viewers let it play again from the start, the algorithm treats that as a high-engagement signal and distributes it further.",
        tip: "Design your ending to flow back into your beginning. End with a question, a cliffhanger, or a frame that looks like the opening frame.",
        howToFix: "Watch your Short all the way to the end. Ask yourself: does the last second make sense as a beginning? If not, re-edit your outro.",
        badExample: "Ends with 'follow for more' text screen → viewers swipe away → 8% loop rate",
        goodExample: "Ends mid-sentence or with an unanswered question → viewers rewatch → 45% loop rate",
      },
      {
        signal: "View Completion Rate",
        target: ">80% of runtime watched",
        weight: "40%",
        plain: "If your Short is 45 seconds, the average viewer needs to watch at least 36 seconds. Shorts that lose viewers early get shown to fewer people — the algorithm tests content on small batches first.",
        tip: "Cut every second that doesn't add value. If you can say it in 30 seconds, don't pad to 60. Tight shorts have higher completion rates.",
        howToFix: "Re-edit your intro. Remove any sentence that isn't directly related to the payoff. Your first line should be the most interesting thing in the whole video.",
        badExample: "'Hey, welcome back — today I'm going to talk about…' → 55% completion, algorithm stops distributing",
        goodExample: "Start on the payoff or punchline mid-action → 87% completion, algorithm keeps pushing",
      },
      {
        signal: "Engagement Rate (Likes + Comments)",
        target: ">3% combined",
        weight: "25%",
        plain: "Comments matter more than likes on Shorts. A controversial opinion, a question in the caption, or a surprising claim will generate comments — which tells the algorithm real humans are reacting.",
        tip: "End with a direct question or a provocative statement. 'Drop your answer in the comments — I'll reply to every one' works better than a generic CTA.",
        howToFix: "Add a pinned comment yourself right after posting with a question. It prompts others to reply and boosts the comment count in the first hour.",
        badExample: "No CTA, no question in caption → 0.4% engagement → algorithm stops after 500 views",
        goodExample: "Caption ends with a bold claim + 'Agree or disagree?' → 4.8% engagement → pushed to 50K+",
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
      "Starting with a title card, logo, or 'Hey guys' intro — your first 3 seconds are your entire chance",
      "Making the Short too long — if you can cut it to 35 seconds, cut it",
      "Using a full-screen text-only Short with no face — these perform 60% worse on average",
      "Horizontal video posted to Shorts (9:16 vertical is mandatory, horizontal looks broken)",
      "Ending with 'subscribe and follow' — this kills your loop rate",
      "Posting at random times — post when your target viewer is most likely scrolling (typically 7–9pm local time)",
      "Ignoring the first pinned comment opportunity — post a question as a comment immediately after uploading",
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

export default function ReverseEngineerPanel({ platform, result, loading, onAnalyze }: ReverseEngineerPanelProps) {
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
            <div className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: intel.color }}>CONTENT ANALYSIS — LIVE</div>
            <div className="text-[14px] font-bold" style={{ color: "#E8E8FF" }}>{video.title || video.channel}</div>
            {channel && <div className="text-[11px] mt-0.5" style={{ color: "rgba(232,232,255,0.5)" }}>{channel.name} · {channel.subs >= 1000000 ? `${(channel.subs/1000000).toFixed(1)}M` : `${(channel.subs/1000).toFixed(0)}K`} subscribers</div>}
          </div>

          <div className="p-5 space-y-5">

            {/* Signal scores */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "rgba(232,232,255,0.45)" }}>HOW THIS CONTENT SCORES ON THE ALGORITHM</div>
              <div className="grid grid-cols-3 gap-3">
                {intel.algorithmSignals.map(({ signal, target, weight }) => {
                  const rawLikeRate = video.likes / Math.max(video.views, 1);
                  const actual =
                    signal.toLowerCase().includes("completion") ? `${(video.engagement * 12).toFixed(0)}%` :
                    signal.toLowerCase().includes("ctr") ? "—" :
                    signal.toLowerCase().includes("avd") ? "—" :
                    signal.toLowerCase().includes("saves") ? `${(rawLikeRate * 100 * 0.8).toFixed(1)}%` :
                    signal.toLowerCase().includes("share") || signal.toLowerCase().includes("send") ? `${(video.shares ? (video.shares / Math.max(video.views, 1) * 100).toFixed(1) : (rawLikeRate * 100 * 0.4).toFixed(1))}%` :
                    signal.toLowerCase().includes("3-second") || signal.toLowerCase().includes("loop") ? `${Math.min(99, (video.engagement * 8)).toFixed(0)}%` :
                    `${video.engagement.toFixed(2)}%`;

                  const numericTarget = parseFloat(target);
                  const numericActual = parseFloat(actual);
                  const isGood = !isNaN(numericActual) && !isNaN(numericTarget) && numericActual >= numericTarget;
                  const statusColor = actual === "—" ? "rgba(232,232,255,0.4)" : isGood ? "#00FF88" : "#FF453A";

                  return (
                    <div key={signal} className="rounded-xl p-3" style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${actual === "—" ? "rgba(255,255,255,0.06)" : isGood ? "rgba(0,255,136,0.2)" : "rgba(255,69,58,0.2)"}` }}>
                      <div className="text-[9px] mb-1.5 leading-tight" style={{ color: "rgba(232,232,255,0.45)" }}>{signal.split(" (")[0]}</div>
                      <div className="text-[20px] font-bold font-mono leading-none mb-1" style={{ color: statusColor }}>{actual}</div>
                      <div className="text-[9px]" style={{ color: "rgba(232,232,255,0.35)" }}>target: {target}</div>
                      <div className="text-[8px] mt-1 font-semibold" style={{ color: statusColor }}>{actual === "—" ? "needs platform data" : isGood ? "✓ above target" : "↑ below target"}</div>
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
                    <div className="text-[11px] mt-1.5 italic" style={{ color: "rgba(232,232,255,0.55)" }}>"{video.title}"</div>
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
            Every high-performing video on {intel.label} follows this exact structure. Follow these steps in order. Don't skip any of them.
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
            These are the most common reasons why {intel.label} content underperforms. If you're doing any of these, fixing them will improve your numbers faster than anything else.
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
