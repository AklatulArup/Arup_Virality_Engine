"use client";

import React, { useEffect, useRef } from "react";

export default function CursorGlow() {
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  let mouseX = -999, mouseY = -999;
  let outerX = -999, outerY = -999;
  let raf: number;

  useEffect(() => {
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    const move = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      // Inner follows instantly
      inner.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    };

    // Outer lerps behind
    function lerp() {
      outerX += (mouseX - outerX) * 0.08;
      outerY += (mouseY - outerY) * 0.08;
      outer!.style.transform = `translate(${outerX}px, ${outerY}px)`;
      raf = requestAnimationFrame(lerp);
    }

    window.addEventListener("mousemove", move, { passive: true });
    raf = requestAnimationFrame(lerp);

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const common: React.CSSProperties = {
    position: "fixed",
    top: 0, left: 0,
    pointerEvents: "none",
    zIndex: 9998,
    willChange: "transform",
    borderRadius: "50%",
  };

  return (
    <>
      {/* Outer ambient glow — large, very soft */}
      <div
        ref={outerRef}
        style={{
          ...common,
          width: 520, height: 520,
          marginLeft: -260, marginTop: -260,
          background: "radial-gradient(circle, rgba(96,165,250,0.04) 0%, rgba(123,79,255,0.025) 40%, transparent 70%)",
          transform: "translate(-9999px,-9999px)",
        }}
      />
      {/* Inner sharp core — small, visible */}
      <div
        ref={innerRef}
        style={{
          ...common,
          width: 6, height: 6,
          marginLeft: -3, marginTop: -3,
          background: "rgba(96,165,250,0.55)",
          boxShadow: "0 0 0 1px rgba(96,165,250,0.15), 0 0 10px rgba(96,165,250,0.4)",
          transform: "translate(-9999px,-9999px)",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
}
