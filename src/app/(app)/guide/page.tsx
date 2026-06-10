import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Static onboarding guide for partner managers — the canonical "how do I use
// this to gauge views" reference. Content mirrors the circulated PDF.

const TIMING = [
  ["X (Twitter)", "24 hours", "end of day 1"],
  ["TikTok", "2–3 days", "day 2–3"],
  ["Instagram Reels", "3–5 days", "day 3"],
  ["YouTube Shorts", "~1 week", "day 3–7"],
  ["YouTube long-form", "keeps earning for months", "day 7 (number only grows after)"],
] as const;

const CONFIDENCE = [
  ["Hour 0 (just posted)", "~55–65%", "Anchor expectations only — don't decide"],
  ["Hour 24", "~70–75%", "First wave visible"],
  ["Day 2–3", "~80%", "THE decision point for short-form"],
  ["Day 7", "~85–90%", "Confirmation — curve mostly finished"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-[14px] font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title="How to use this tool"
        description="The partner-manager playbook for gauging how many views a piece of content will get."
      />

      <Section title="What this tool is">
        <p>
          A <span className="text-foreground">weather forecast for content</span>. It never says &ldquo;exactly 114,200
          views&rdquo; — it gives a <span className="text-foreground">range</span> (low / expected / high), a confidence
          level, and the reasons. It ranks and brackets very well, and snipes poorly: direction is right ~3 of 4 times,
          the real number lands in the bracket ~8 of 10 times, and ~15% of virality is pure luck no tool can predict.
        </p>
      </Section>

      <Section title="The golden rule — WHEN you check decides what you can know">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-4">Platform</th>
                <th className="py-1.5 pr-4">Fate mostly sealed by</th>
                <th className="py-1.5">Your decision read</th>
              </tr>
            </thead>
            <tbody>
              {TIMING.map(([p, sealed, read]) => (
                <tr key={p} className="border-b border-border/50">
                  <td className="py-1.5 pr-4 text-foreground">{p}</td>
                  <td className="py-1.5 pr-4">{sealed}</td>
                  <td className="py-1.5">{read}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A 3-week-old TikTok tells you nothing predictive — the game is over. Hour zero tells you little — it
          hasn&apos;t started. <span className="text-foreground">Day 2–3 is the sweet spot for short-form.</span>
        </p>
      </Section>

      <Section title="The workflow — five steps">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <span className="text-foreground">Vet the creator first.</span> ⌘K → type their @handle → Creator Report
            Card. Read the verdict band (a red <span className="text-foreground">Brand risk</span> banner = reputation
            split across platforms — check before partnering) and{" "}
            <span className="text-foreground">&ldquo;Typical views&rdquo; — your negotiation anchor</span>. Never judge a
            creator on one video.
          </li>
          <li>
            <span className="text-foreground">Paste the link the day the content drops.</span> ⌘K → paste URL. This also
            starts the hourly tracker — paste late and the early growth history is lost forever.
          </li>
          <li>
            <span className="text-foreground">Get one screenshot from the creator.</span> &ldquo;Add creator
            analytics&rdquo; → drop in their Studio/Insights screenshot (Ctrl+V works). Completion rate only exists in
            their private dashboard, and it&apos;s the single most predictive metric. How willingly they share is itself
            a partner-trust signal.
          </li>
          <li>
            <span className="text-foreground">Make the call on day 2–3.</span> Read: the verdict band → the range → live
            pace (×1.15+ and climbing = good; below ×0.85 = platform losing interest) → the Algorithm read (gates,
            spread-per-wave m̂ — above 1.0 twice in a row = no ceiling yet; below ~0.6 = the final number is already
            visible).
          </li>
          <li>
            <span className="text-foreground">Log it, confirm day 7.</span> Set the date picker to your decision date →
            &ldquo;Log this forecast&rdquo; (locks the prediction on record). Day 7 = confirmation; the Videos tab shows
            &ldquo;since we looked&rdquo; for every analysis.
          </li>
        </ol>
      </Section>

      <Section title="How to read the range (the part everyone gets wrong)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="text-foreground">LOW = your near-guarantee.</span> Holds ~9 times out of 10. This is the
            number you use in a negotiation: &ldquo;this clears at least X.&rdquo;
          </li>
          <li>
            <span className="text-foreground">EXPECTED = your anchor, not a promise.</span> Reality lands above it as
            often as below — but rarely exactly on it.
          </li>
          <li>
            <span className="text-foreground">HIGH = the upside story</span> if distribution fully kicks in.
          </li>
        </ul>
      </Section>

      <Section title="How much to trust it">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-4">When you check</th>
                <th className="py-1.5 pr-4">Confidence</th>
                <th className="py-1.5">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {CONFIDENCE.map(([when, conf, note]) => (
                <tr key={when} className="border-b border-border/50">
                  <td className="py-1.5 pr-4 text-foreground">{when}</td>
                  <td className="py-1.5 pr-4 font-mono">{conf}</td>
                  <td className="py-1.5">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Certainty also depends on distance: if you need 100K and the range says 250K–800K, you&apos;re near-certain on
          day 1. If your threshold sits inside the range, the honest answer is &ldquo;too close to call yet.&rdquo;
        </p>
      </Section>

      <Section title="What NOT to do">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Don&apos;t analyze old content expecting a prediction — past its window the tool just reads the scoreboard back.</li>
          <li>Don&apos;t quote EXPECTED externally — quote LOW externally, EXPECTED internally.</li>
          <li>Don&apos;t judge a creator from one video — use the Creator Card.</li>
          <li>Don&apos;t override &ldquo;Too early to call&rdquo; — add the creator&apos;s typical views under &ldquo;Type it in&rdquo; if you know them.</li>
          <li>Don&apos;t trust platform accuracy stats under 20 graded results — the Trust Center shows &ldquo;still collecting&rdquo; until then.</li>
        </ul>
      </Section>

      <Section title="How you know the tool itself is honest">
        <p>
          The <span className="text-foreground">Trust Center</span> grades every forecast against the real outcome:
          Calls right %, Range hit rate (target 80%), and the five worst misses — failures included. When the engine
          wants to adjust itself, it asks for approval there instead of silently changing.
        </p>
        <p className="border-l-2 border-primary pl-3 text-foreground">
          Bottom line: vet the card → paste on day 0 → one screenshot → decide day 2–3 on the LOW number → confirm day
          7. Trust direction ~4 of 5, the bracket ~8 of 10, and never an exact number — from anyone.
        </p>
      </Section>
    </div>
  );
}
