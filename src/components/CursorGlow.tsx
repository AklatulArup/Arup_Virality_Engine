"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;

    const move = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };

    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div
      ref={glowRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 480,
        height: 480,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(0,212,255,0.055) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 9998,
        transform: "translate(-9999px, -9999px)",
        marginLeft: -240,
        marginTop: -240,
        willChange: "transform",
      }}
    />
  );
}
