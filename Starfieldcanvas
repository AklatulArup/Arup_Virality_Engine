"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  type: "white" | "blue" | "warm";
}

interface Comet {
  x: number; y: number;
  angle: number;
  speed: number;
  tail: number;
  width: number;
  maxAlpha: number;
  life: number;       // 0–1, counts down
  decay: number;      // life/second
}

const STAR_COUNT  = 90;
const COMET_COUNT = 28;
const FPS_CAP     = 30;

function makeComet(W: number, H: number): Comet {
  const fromTop = Math.random() < 0.7;
  const baseAngle = Math.PI * (0.06 + Math.random() * 0.20);
  const angle = Math.random() < 0.2 ? Math.PI - baseAngle : baseAngle;
  return {
    x:     fromTop ? Math.random() * W * 1.4 - W * 0.2 : -80,
    y:     fromTop ? -50 - Math.random() * 40 : Math.random() * H * 0.8,
    angle,
    speed: 120 + Math.random() * 140,
    tail:  70 + Math.random() * 100,
    width: 0.4 + Math.random() * 1.2,
    maxAlpha: 0.18 + Math.random() * 0.28,
    life:  Math.random(),
    decay: 0.12 + Math.random() * 0.22,
  };
}

export default function StarfieldCanvas({ opacity = 0.65 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    let stars:  Star[]  = [];
    let comets: Comet[] = [];
    let raf: number;
    let last = 0;
    const FRAME_MS = 1000 / FPS_CAP;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function buildStars() {
      stars = Array.from({ length: STAR_COUNT }, () => {
        const tier = Math.random();
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 18,
          vy: (Math.random() - 0.5) * 10,
          r:  tier < 0.06 ? 1.4 + Math.random() * 1.0
            : tier < 0.20 ? 0.6 + Math.random() * 0.8
            :                0.15 + Math.random() * 0.5,
          alpha:        0.4 + Math.random() * 0.5,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 1.5,
          type: Math.random() < 0.14 ? "blue"
              : Math.random() < 0.08 ? "warm"
              : "white",
        };
      });
    }

    function buildComets() {
      comets = Array.from({ length: COMET_COUNT }, () => makeComet(W, H));
    }

    resize();
    buildStars();
    buildComets();
    window.addEventListener("resize", () => { resize(); buildStars(); buildComets(); }, { passive: true });

    function draw(now: number) {
      if (document.hidden) { raf = requestAnimationFrame(draw); return; }
      if (now - last < FRAME_MS) { raf = requestAnimationFrame(draw); return; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, W, H);

      // ── Stars ──
      for (const s of stars) {
        s.x  += s.vx * dt;
        s.y  += s.vy * dt;
        s.twinklePhase += s.twinkleSpeed * dt;
        if (s.x < -20) s.x = W + 10;
        if (s.x > W+20) s.x = -10;
        if (s.y < -20) s.y = H + 10;
        if (s.y > H+20) s.y = -10;

        const tw = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const al = (s.alpha * (0.7 + 0.3 * tw)) * 0.8;
        const color = s.type === "blue"  ? `rgba(147,197,253,${al})`
                    : s.type === "warm"  ? `rgba(253,230,150,${al})`
                    :                      `rgba(255,255,255,${al})`;

        // diffraction cross on large stars
        if (s.r > 1.2) {
          const arm = s.r * 4;
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.45;
          ctx.beginPath();
          ctx.moveTo(s.x - arm, s.y); ctx.lineTo(s.x + arm, s.y);
          ctx.moveTo(s.x, s.y - arm); ctx.lineTo(s.x, s.y + arm);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.88 + 0.12 * tw), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // ── Comets ──
      for (let i = 0; i < comets.length; i++) {
        const c = comets[i];
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        c.life -= c.decay * dt;

        const gone = c.life <= 0 || c.x > W + 200 || c.y > H + 100 || c.x < -200 || c.y < -80;
        if (gone) { comets[i] = makeComet(W, H); continue; }

        // envelope
        const alpha = c.life > 0.85  ? (1 - c.life) / 0.15 * c.maxAlpha
                    : c.life < 0.15  ? c.life / 0.15 * c.maxAlpha
                    : c.maxAlpha;
        if (alpha < 0.005) continue;

        const tx = c.x - Math.cos(c.angle) * c.tail;
        const ty = c.y - Math.sin(c.angle) * c.tail;
        if (!isFinite(tx) || !isFinite(ty)) continue;

        const g = ctx.createLinearGradient(tx, ty, c.x, c.y);
        g.addColorStop(0,    "rgba(255,255,255,0)");
        g.addColorStop(0.55, `rgba(200,220,255,${alpha * 0.45})`);
        g.addColorStop(1,    `rgba(255,255,255,${alpha})`);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(c.x, c.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = c.width;
        ctx.stroke();

        if (isFinite(c.width) && c.width > 0) {
          const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.width * 4);
          hg.addColorStop(0, `rgba(255,255,255,${Math.min(alpha * 1.4, 1)})`);
          hg.addColorStop(1, "rgba(180,210,255,0)");
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.width * 4, 0, Math.PI * 2);
          ctx.fillStyle = hg;
          ctx.fill();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        opacity,
      }}
    />
  );
}
