"use client";

// ═══════════════════════════════════════════════════════════════════════════
// STAR FIELD — subtle ambient background
// ═══════════════════════════════════════════════════════════════════════════
//
// 60 deterministic "stars" + 12 "+" crosses. Positions are generated once
// from fixed coefficients so layouts are stable across renders. Ported from
// `app-chrome.jsx::StarField`.

import React, { useMemo } from "react";
import { T } from "@/lib/design-tokens";

interface Star {
  x: number;
  y: number;
  r?:  number;
  o:  number;
  c?: string;
  cross?: boolean;
}

export default function StarField() {
  const stars: Star[] = useMemo(() => {
    const arr: Star[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        x: (i * 79.3) % 100,
        y: (i * 47.7) % 100,
        r: 0.5 + (i % 4) * 0.25,
        o: 0.06 + ((i * 13) % 7) * 0.03,
        c: i % 17 === 0 ? T.blue : i % 23 === 0 ? T.purple : "#FFFFFF",
      });
    }
    for (let i = 0; i < 12; i++) {
      arr.push({
        cross: true,
        x: (i * 113.7 + 11) % 100,
        y: (i * 67.3 + 9) % 100,
        o: 0.09,
      });
    }
    return arr;
  }, []);

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s, i) => s.cross ? (
        <g key={i} stroke="#FFFFFF" strokeOpacity={s.o} strokeWidth="0.6">
          <line x1={`${s.x}%`} y1={`calc(${s.y}% - 3px)`} x2={`${s.x}%`} y2={`calc(${s.y}% + 3px)`} />
          <line x1={`calc(${s.x}% - 3px)`} y1={`${s.y}%`} x2={`calc(${s.x}% + 3px)`} y2={`${s.y}%`} />
        </g>
      ) : (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill={s.c} opacity={s.o} />
      ))}
    </svg>
  );
}
