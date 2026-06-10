"use client";

import type { CrossPromotion } from "@/lib/types";
import CollapsibleSection from "./CollapsibleSection";

interface CrossPromotionPanelProps {
  promo: CrossPromotion;
}

export default function CrossPromotionPanel({ promo }: CrossPromotionPanelProps) {
  const scoreColor = promo.ecosystemScore >= 60 ? "var(--color-vrs-excellent)" : promo.ecosystemScore >= 30 ? "var(--color-vrs-competitive)" : "var(--color-vrs-rework)";

  return (
    <CollapsibleSection
      title="Cross-Promotion & Ecosystem"
      subtitle={`Ecosystem score: ${promo.ecosystemScore}/100`}
      accentColor="var(--color-accent-blue)"
    >
      <div className="flex gap-4 items-start mb-3">
        <div className="text-center">
          <div className="text-[24px] font-mono font-bold" style={{ color: scoreColor }}>{promo.ecosystemScore}</div>
          <div className="text-[8px] text-[#9E9C97]">ECOSYSTEM</div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.videoLinks > 0 ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.videoLinks > 0 ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Video links ({promo.videoLinks})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.playlistLinks > 0 ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.playlistLinks > 0 ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Playlist links ({promo.playlistLinks})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.socialLinks.length > 0 ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.socialLinks.length > 0 ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Social links ({promo.socialLinks.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.endScreenLikely ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.endScreenLikely ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">End screen references</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.pinnedCommentCTA ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.pinnedCommentCTA ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Pinned comment CTA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: promo.cardLinks > 0 ? "var(--color-vrs-excellent)" : "var(--color-vrs-rework)" }}>
              {promo.cardLinks > 0 ? "\u2713" : "\u2717"}
            </span>
            <span className="text-[9px] text-subtle">Card links</span>
          </div>
        </div>
      </div>

      {/* Social platforms detected */}
      {promo.socialLinks.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">SOCIAL PLATFORMS</div>
          <div className="flex flex-wrap gap-1">
            {promo.socialLinks.map((s, i) => (
              <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-background text-subtle">
                {s.platform}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {promo.suggestions.length > 0 && (
        <div>
          <div className="text-[8px] font-mono text-[#9E9C97] tracking-widest mb-0.5">SUGGESTIONS</div>
          {promo.suggestions.map((s, i) => (
            <div key={i} className="text-[8px] text-subtle py-0.5">
              <span style={{ color: "var(--color-vrs-competitive)" }}>{"\u2192"}</span> {s}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
