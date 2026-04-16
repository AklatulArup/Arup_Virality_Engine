"use client";

import type {
  AnalysisResult,
  EnrichedVideo,
  ChannelData,
  DeepAnalysis,
  ReferenceEntry,
} from "@/lib/types";
import { formatNumber } from "@/lib/formatters";

interface ReportData {
  result: AnalysisResult;
  platform: string;
  generatedAt: string;
  channelMedian?: number;
  adjacentCtx?: unknown;
  nicheRanking?: unknown;
  descriptionSEO?: unknown;
  engagementDecay?: unknown;
  publishTime?: unknown;
  competitorGap?: unknown;
  tagCorrelation?: unknown;
  uploadCadence?: unknown;
  languageCPA?: unknown;
  referenceStore?: { entries: ReferenceEntry[] } | null;
  keywordBank?: { categories: { niche: string[]; competitors: string[] } } | null;
}

// ── Score colour ────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return "#2ECC8A";
  if (score >= 65) return "#60A5FA";
  if (score >= 50) return "#F59E0B";
  if (score >= 35) return "#F97316";
  return "#FF4D6A";
}

// ── Phase ───────────────────────────────────────────────────────────────────
function getPhase(v: EnrichedVideo, median: number) {
  const vrs = v.vrs.estimatedFullScore;
  if (v.vsBaseline >= 5 || (vrs >= 82 && v.vsBaseline >= 3.5)) return { label: "VIRAL PHASE", color: "#FF4D6A" };
  if (v.days >= 5 && v.vsBaseline >= 2.5 && vrs >= 65) return { label: "EXPANSION PHASE", color: "#F59E0B" };
  if (v.days >= 2 && v.vsBaseline >= 1.5) return { label: "RESONANCE PHASE", color: "#60A5FA" };
  return { label: "SEED PHASE", color: "#A78BFA" };
}

// ── HTML report builder ─────────────────────────────────────────────────────
function buildReportHTML(data: ReportData): string {
  const { result, platform, generatedAt } = data;
  const date = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  function section(title: string, content: string, accent = "#60A5FA"): string {
    return `
      <div class="section">
        <div class="section-header" style="border-left: 3px solid ${accent}">
          <h2 class="section-title">${title}</h2>
        </div>
        ${content}
      </div>`;
  }

  function metricRow(label: string, value: string | number, color = "#E8E6E1"): string {
    return `<div class="metric-row"><span class="metric-label">${label}</span><span class="metric-value" style="color:${color}">${value}</span></div>`;
  }

  function pill(text: string, color: string): string {
    return `<span class="pill" style="background:${color}18;border:1px solid ${color}40;color:${color}">${text}</span>`;
  }

  function table(headers: string[], rows: string[][]): string {
    return `<table class="data-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
  }

  let body = "";

  // ── VIDEO REPORT ─────────────────────────────────────────────────────────
  if (result.type === "video") {
    const v = result.video;
    const ch = result.channel;
    const phase = getPhase(v, data.channelMedian ?? 0);
    const eng = v.engagement.toFixed(2);
    const commentRate = v.views > 0 ? ((v.comments / v.views) * 1000).toFixed(2) : "0";
    const likeRate = v.views > 0 ? ((v.likes / v.views) * 100).toFixed(2) : "0";

    // Cover
    body += `
      <div class="cover">
        <div class="cover-platform">${platform.toUpperCase()}</div>
        <h1 class="cover-title">${v.title}</h1>
        <div class="cover-channel">${v.channel}${ch ? ` · ${formatNumber(ch.subs)} subscribers` : ""}</div>
        <div class="cover-phase" style="background:${phase.color}18;border:1px solid ${phase.color}40;color:${phase.color}">
          ${phase.label} — Day ${v.days}
        </div>
        <div class="cover-meta">Report generated: ${date}</div>
      </div>
      <div class="page-break"></div>`;

    // Performance snapshot
    body += section("Performance Snapshot", `
      <div class="metrics-grid">
        ${metricRow("Total Views", formatNumber(v.views), "#2ECC8A")}
        ${metricRow("Likes", formatNumber(v.likes), "#60A5FA")}
        ${metricRow("Comments", formatNumber(v.comments), "#A78BFA")}
        ${metricRow("Velocity", `${formatNumber(v.velocity)}/day`, "#7B4FFF")}
        ${metricRow("Engagement Rate", `${eng}%`, "#F59E0B")}
        ${metricRow("vs Channel Median", `${v.vsBaseline}x`, v.vsBaseline >= 3 ? "#2ECC8A" : v.vsBaseline >= 1 ? "#F59E0B" : "#FF4D6A")}
        ${metricRow("Like Rate", `${likeRate}%`, "#60A5FA")}
        ${metricRow("Comments / 1K Views", commentRate, "#F59E0B")}
        ${ch ? metricRow("Channel Subscribers", formatNumber(ch.subs), "#EF4444") : ""}
        ${ch ? metricRow("Channel Median Views", formatNumber(data.channelMedian ?? 0), "#06B6D4") : ""}
        ${metricRow("VRS Score", `${v.vrs.estimatedFullScore}/100`, scoreColor(v.vrs.estimatedFullScore))}
        ${metricRow("Published", new Date(v.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), "#9E9C97")}
      </div>
      ${v.isOutlier ? `<div class="alert alert-green">🔥 OUTLIER — This video is performing ${v.vsBaseline}x above channel median. Strong algorithmic amplification signal.</div>` : ""}
    `, "#2ECC8A");

    // Virality Phase
    body += section("Virality Phase Analysis", `
      <div class="phase-card" style="border-left:4px solid ${phase.color}">
        <div class="phase-label" style="color:${phase.color}">${phase.label}</div>
        <p class="phase-desc">${
          phase.label.includes("VIRAL")
            ? `Content has broken past the algorithm ceiling and is being distributed beyond the subscriber base into cold traffic. Platform is actively pushing this into non-subscriber feeds. Confirmed by ${eng}% engagement rate holding on non-subscriber views.`
            : phase.label.includes("EXPANSION")
            ? `Content has cleared the algorithm's quality threshold and entered broader distribution. Velocity of ${formatNumber(v.velocity)} views/day on day ${v.days} indicates sustained algorithmic push rather than a spike-and-decay pattern.`
            : phase.label.includes("RESONANCE")
            ? `The algorithm has detected early quality signals and is beginning to expand distribution. The ${v.vsBaseline}x performance vs channel median indicates strong initial audience response.`
            : `Content is in the ${v.days <= 2 ? "first 48-hour" : "early"} test window. The algorithm is sampling engagement quality before making distribution decisions.`
        }</p>
        <div class="phase-metrics">
          <div>${metricRow("Days Since Publish", v.days)}</div>
          <div>${metricRow("Velocity vs Median", `${v.vsBaseline}x`)}</div>
        </div>
      </div>
    `, phase.color);

    // VRS Breakdown
    if (v.vrs.criteria && v.vrs.criteria.length > 0) {
      const critRows = v.vrs.criteria.map(c => [
        c.label ?? c.id ?? "—",
        `${c.score ?? 0}/${c.weight ?? 0}`,
        c.rationale ?? "—",
      ]);
      body += section("Viral Readiness Score (VRS) Breakdown", `
        <div class="vrs-summary">
          <div class="vrs-score" style="color:${scoreColor(v.vrs.estimatedFullScore)}">${v.vrs.estimatedFullScore}<span class="vrs-max">/100</span></div>
          <div class="vrs-label">${v.vrs.estimatedFullScore >= 80 ? "EXCELLENT" : v.vrs.estimatedFullScore >= 65 ? "STRONG" : v.vrs.estimatedFullScore >= 50 ? "COMPETITIVE" : "NEEDS WORK"}</div>
        </div>
        ${v.vrs.topFixes && v.vrs.topFixes.length > 0 ? `
          <div class="subsection-title">Top Improvement Areas</div>
          <ul class="fix-list">${v.vrs.topFixes.map((f: string) => `<li>${f}</li>`).join("")}</ul>
        ` : ""}
        ${critRows.length > 0 ? table(["Criterion", "Score", "Signal"], critRows) : ""}
      `, scoreColor(v.vrs.estimatedFullScore));
    }

    // Content signals
    const hasPowerWord = /FREE|SECRET|BANNED|NEVER|PROOF|REAL|HIDDEN|EXPOSED|VIRAL|SHOCKING|EARN|MAKE|HOW|WHY|WHAT|BEST|WORST|\$[0-9]|[0-9]+[KM]/i.test(v.title);
    const hasNumber = /\d/.test(v.title);
    const titleLen = v.title.length;
    body += section("Title & Hook Signals", `
      <div class="metrics-grid">
        ${metricRow("Title Length", `${titleLen} characters (${titleLen >= 40 && titleLen <= 70 ? "✓ Optimal" : titleLen < 40 ? "⚠ Too short" : "⚠ Too long"})`)}
        ${metricRow("Power Words", hasPowerWord ? "✓ Detected" : "✗ None found")}
        ${metricRow("Number in Title", hasNumber ? "✓ Present" : "✗ Missing")}
        ${metricRow("Comment Signal", parseFloat(commentRate) >= 2 ? "✓ HIGH — active discussion" : parseFloat(commentRate) >= 0.8 ? "◈ MODERATE" : "✗ LOW")}
      </div>
      <p class="body-text"><strong>Comment section analysis:</strong> ${
        parseFloat(commentRate) >= 2
          ? `Strong at ${commentRate} comments per 1,000 views. Audience is actively discussing — a high-weight retargeting signal.`
          : parseFloat(commentRate) >= 0.8
          ? `Moderate at ${commentRate} per 1,000 views. Healthy engagement but room to drive more discussion.`
          : `Low at ${commentRate} per 1,000 views. Content may be triggering passive consumption rather than active engagement.`
      }</p>
    `, "#F59E0B");

    // Deep analysis
    if (result.deepAnalysis) {
      const da = result.deepAnalysis;
      body += section("Deep Analysis", `
        ${da.recommendations && da.recommendations.length > 0 ? `
          <div class="subsection-title">Actionable Recommendations</div>
          <table class="data-table">
            <thead><tr><th>Priority</th><th>Type</th><th>Recommendation</th></tr></thead>
            <tbody>
              ${da.recommendations.slice(0, 8).map((r: { priority?: string; category?: string; action?: string; title?: string }) => `
                <tr>
                  <td><span class="pill" style="background:${r.priority === "HIGH" ? "#FF4D6A18" : "#F59E0B18"};border:1px solid ${r.priority === "HIGH" ? "#FF4D6A40" : "#F59E0B40"};color:${r.priority === "HIGH" ? "#FF4D6A" : "#F59E0B"}">${r.priority ?? "MED"}</span></td>
                  <td>${r.category ?? "—"}</td>
                  <td>${r.action ?? r.title ?? "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}
      `, "#7B4FFF");
    }

    // Recent channel videos
    if (result.recentVideos && result.recentVideos.length > 0) {
      const rows = result.recentVideos.slice(0, 10).map(rv => [
        rv.title.slice(0, 50) + (rv.title.length > 50 ? "…" : ""),
        formatNumber(rv.views),
        `${rv.engagement.toFixed(1)}%`,
        `${rv.vrs.estimatedFullScore}/100`,
        `${rv.vsBaseline}x`,
      ]);
      body += section("Channel Recent Videos", `
        ${table(["Title", "Views", "Engagement", "VRS", "vs Median"], rows)}
      `, "#06B6D4");
    }

    // Reference context
    if (result.referenceContext && result.referenceContext.length > 0) {
      body += section("Reference Pool Context", `
        <p class="body-text">Benchmarked against <strong>${result.referenceContext.length} reference videos</strong> from your tracked pool.</p>
        ${table(
          ["Creator", "Views", "Engagement", "VRS"],
          result.referenceContext.slice(0, 8).map(e => [
            e.channelName,
            formatNumber(e.metrics?.views ?? 0),
            `${(e.metrics?.engagement ?? 0).toFixed(1)}%`,
            `${e.metrics?.vrsScore ?? "—"}`,
          ])
        )}
      `, "#A78BFA");
    }

  // ── CHANNEL REPORT ─────────────────────────────────────────────────────────
  } else if (result.type === "channel") {
    const h = result.health;
    body += `
      <div class="cover">
        <div class="cover-platform">${platform.toUpperCase()} CHANNEL</div>
        <h1 class="cover-title">${h.channel.name}</h1>
        <div class="cover-channel">${formatNumber(h.channel.subs)} subscribers · ${h.channel.videoCount} videos</div>
        <div class="cover-meta">Report generated: ${date}</div>
      </div>
      <div class="page-break"></div>`;

    body += section("Channel Health", `
      <div class="metrics-grid">
        ${metricRow("Subscribers", formatNumber(h.channel.subs), "#EF4444")}
        ${metricRow("Total Videos", h.channel.videoCount)}
        ${metricRow("Median Views/Video", formatNumber(h.medianViews), "#60A5FA")}
        ${metricRow("Median Velocity", `${formatNumber(h.medianVelocity)}/day`, "#A78BFA")}
        ${metricRow("Median Engagement", `${h.medianEngagement}%`, "#F59E0B")}
        ${metricRow("Outlier Rate", `${h.outlierRate.toFixed(1)}%`, "#2ECC8A")}
        ${metricRow("Upload Frequency", `${h.uploadFrequency.toFixed(1)} videos/week`)}
        ${metricRow("Channel Trend", h.trend, h.trend === "growing" ? "#2ECC8A" : h.trend === "stable" ? "#F59E0B" : "#FF4D6A")}
      </div>
    `, "#2ECC8A");

    if (h.outliers && h.outliers.length > 0) {
      body += section("Outlier Videos", `
        ${table(
          ["Title", "Views", "vs Median", "VRS", "Engagement"],
          h.outliers.slice(0, 10).map(v => [
            v.title.slice(0, 45) + (v.title.length > 45 ? "…" : ""),
            formatNumber(v.views),
            `${v.vsBaseline}x`,
            `${v.vrs.estimatedFullScore}/100`,
            `${v.engagement.toFixed(1)}%`,
          ])
        )}
      `, "#FF4D6A");
    }

    if (h.videos && h.videos.length > 0) {
      body += section("All Recent Videos", `
        ${table(
          ["Title", "Views", "Velocity", "Engagement", "VRS"],
          h.videos.slice(0, 20).map(v => [
            v.title.slice(0, 40) + (v.title.length > 40 ? "…" : ""),
            formatNumber(v.views),
            `${formatNumber(v.velocity)}/d`,
            `${v.engagement.toFixed(1)}%`,
            `${v.vrs.estimatedFullScore}/100`,
          ])
        )}
      `, "#60A5FA");
    }

  // ── TIKTOK/INSTAGRAM BATCH ────────────────────────────────────────────────
  } else if (result.type === "tiktok-batch") {
    const totalViews = result.videos.reduce((s, v) => s + v.views, 0);
    const avgEng = result.videos.reduce((s, v) => s + v.engagement, 0) / Math.max(result.videos.length, 1);

    body += `
      <div class="cover">
        <div class="cover-platform">${platform.toUpperCase()} BATCH ANALYSIS</div>
        <h1 class="cover-title">${result.videos.length} Videos Analysed</h1>
        <div class="cover-channel">${formatNumber(totalViews)} total views · ${avgEng.toFixed(2)}% avg engagement</div>
        <div class="cover-meta">Report generated: ${date}</div>
      </div>
      <div class="page-break"></div>`;

    body += section("Batch Overview", `
      <div class="metrics-grid">
        ${metricRow("Videos Analysed", result.videos.length)}
        ${metricRow("Total Views", formatNumber(totalViews), "#60A5FA")}
        ${metricRow("Avg Engagement", `${avgEng.toFixed(2)}%`, "#F59E0B")}
        ${metricRow("Top Video Views", formatNumber(result.videos[0]?.views ?? 0), "#2ECC8A")}
        ${metricRow("Unique Creators", new Set(result.videos.map(v => v.channel)).size)}
      </div>
    `, "#2ECC8A");

    if (result.topPerformers && result.topPerformers.length > 0) {
      body += section("Top Performers", `
        ${table(
          ["Title / Channel", "Views", "Engagement", "VRS"],
          result.topPerformers.slice(0, 10).map(v => [
            `<strong>${v.channel}</strong><br/>${v.title.slice(0, 40)}`,
            formatNumber(v.views),
            `${v.engagement.toFixed(1)}%`,
            `${v.vrs.estimatedFullScore}/100`,
          ])
        )}
      `, "#FF4D6A");
    }

    if (result.competitorBreakdown && result.competitorBreakdown.length > 0) {
      body += section("Creator Breakdown", `
        ${table(
          ["Creator", "Videos", "Avg Views", "Avg VRS Score"],
          result.competitorBreakdown.slice(0, 15).map(c => [
            c.handle,
            c.videoCount,
            formatNumber(c.avgViews),
            c.avgScore,
          ])
        )}
      `, "#A78BFA");
    }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Sans', sans-serif; background: #fff; color: #111; font-size: 11pt; line-height: 1.5; }

    /* Cover */
    .cover { page-break-after: always; padding: 60px 48px; background: #0A0A08; color: #E8E6E1; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
    .cover-platform { font-family: 'IBM Plex Mono', monospace; font-size: 9pt; letter-spacing: 0.18em; color: #60A5FA; margin-bottom: 20px; }
    .cover-title { font-size: 26pt; font-weight: 700; line-height: 1.25; margin-bottom: 16px; color: #fff; }
    .cover-channel { font-size: 12pt; color: #9E9C97; margin-bottom: 24px; }
    .cover-phase { display: inline-block; padding: 6px 16px; border-radius: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 9pt; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 32px; }
    .cover-meta { font-family: 'IBM Plex Mono', monospace; font-size: 8pt; color: #4A4845; }

    /* Sections */
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-header { padding-left: 12px; margin-bottom: 14px; }
    .section-title { font-size: 13pt; font-weight: 700; color: #111; }

    /* Metrics */
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 12px; }
    .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .metric-label { font-family: 'IBM Plex Mono', monospace; font-size: 8.5pt; color: #666; letter-spacing: 0.04em; }
    .metric-value { font-family: 'IBM Plex Mono', monospace; font-size: 11pt; font-weight: 600; }

    /* Phase */
    .phase-card { padding: 16px; background: #fafafa; border-radius: 8px; margin-bottom: 12px; }
    .phase-label { font-family: 'IBM Plex Mono', monospace; font-size: 10pt; font-weight: 700; letter-spacing: 0.12em; margin-bottom: 8px; }
    .phase-desc { font-size: 10.5pt; color: #333; line-height: 1.65; }
    .phase-metrics { display: flex; gap: 24px; margin-top: 12px; }

    /* VRS */
    .vrs-summary { text-align: center; padding: 20px; background: #fafafa; border-radius: 8px; margin-bottom: 16px; }
    .vrs-score { font-family: 'IBM Plex Mono', monospace; font-size: 42pt; font-weight: 700; line-height: 1; }
    .vrs-max { font-size: 18pt; color: #999; }
    .vrs-label { font-family: 'IBM Plex Mono', monospace; font-size: 9pt; letter-spacing: 0.14em; color: #666; margin-top: 4px; }

    /* Table */
    .data-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
    .data-table th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; letter-spacing: 0.06em; color: #666; border-bottom: 2px solid #e8e8e8; }
    .data-table td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .data-table tr:nth-child(even) td { background: #fafafa; }

    /* Pills */
    .pill { font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; padding: 2px 7px; border-radius: 99px; font-weight: 600; white-space: nowrap; }

    /* Alerts */
    .alert { padding: 10px 14px; border-radius: 6px; font-size: 10.5pt; margin: 12px 0; }
    .alert-green { background: #F0FDF4; border-left: 3px solid #2ECC8A; color: #166534; }

    /* Misc */
    .subsection-title { font-family: 'IBM Plex Mono', monospace; font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; color: #666; margin: 16px 0 8px; }
    .fix-list { padding-left: 18px; margin-bottom: 12px; }
    .fix-list li { font-size: 10.5pt; color: #333; margin-bottom: 5px; line-height: 1.5; }
    .body-text { font-size: 10.5pt; color: #333; line-height: 1.65; margin: 8px 0; }
    .page-break { page-break-before: always; }

    /* Footer */
    @page { margin: 20mm 18mm; @bottom-center { content: "FundedNext Platform Intelligence · " counter(page); font-family: 'IBM Plex Mono', monospace; font-size: 7pt; color: #999; } }

    /* Print */
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>FundedNext Intel Report — ${date}</title>
  <style>${css}</style>
</head>
<body>
  ${body}
  <div style="text-align:center;padding:40px;font-family:'IBM Plex Mono',monospace;font-size:8pt;color:#999;border-top:1px solid #eee;margin-top:48px">
    FundedNext Platform Intelligence · Generated ${date} · Confidential Internal Report
  </div>
</body>
</html>`;
}

// ── Main export function ────────────────────────────────────────────────────
export function downloadPDFReport(data: ReportData): void {
  const html = buildReportHTML(data);

  // Open in new tab and trigger print dialog (browser saves as PDF)
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups to download the report."); return; }

  win.document.write(html);
  win.document.close();

  // Give fonts a moment to load then print
  setTimeout(() => {
    win.focus();
    win.print();
  }, 800);
}

// ── Report button component ─────────────────────────────────────────────────
interface ReportButtonProps {
  data: ReportData;
  compact?: boolean;
}

export default function ReportDownloadButton({ data, compact = false }: ReportButtonProps) {
  const [printing, setPrinting] = React.useState(false);

  function handleClick() {
    setPrinting(true);
    setTimeout(() => {
      downloadPDFReport(data);
      setTimeout(() => setPrinting(false), 1500);
    }, 50);
  }

  return (
    <button
      onClick={handleClick}
      disabled={printing}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: compact ? "6px 12px" : "10px 18px",
        borderRadius: 9, cursor: printing ? "wait" : "pointer",
        fontSize: compact ? 11 : 12, fontWeight: 600, fontFamily: "var(--font-sans)",
        background: printing ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(96,165,250,0.12), rgba(46,204,138,0.08))",
        border: `1px solid ${printing ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.3)"}`,
        color: printing ? "#5E5A57" : "#60A5FA",
        transition: "all 0.2s",
        boxShadow: printing ? "none" : "0 0 12px rgba(96,165,250,0.1)",
      }}
      onMouseEnter={e => { if (!printing) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(96,165,250,0.22)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = printing ? "none" : "0 0 12px rgba(96,165,250,0.1)"; }}
    >
      {printing ? (
        <><span className="orbital-loader" style={{ width: 12, height: 12, borderTopColor: "#60A5FA", borderWidth: 1.5 }} /> Preparing…</>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7M3.5 5l3 3 3-3M2 10h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {compact ? "PDF" : "Download Report"}
        </>
      )}
    </button>
  );
}

// Need React for the button
import React from "react";
