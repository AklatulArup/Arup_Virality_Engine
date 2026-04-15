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
  life: number;
  decay: number;
}

const STAR_COUNT  = 90;
const COMET_COUNT = 28;
const FPS_CAP     = 30;

function makeComet(W: number, H: number): Comet {
  const fromTop   = Math.random() < 0.7;
  const baseAngle = Math.PI * (0.06 + Math.random() * 0.20);
  const angle     = Math.random() < 0.2 ? Math.PI - baseAngle : baseAngle;
  return {
    x:        fromTop ? Math.random() * W * 1.4 - W * 0.2 : -80,
    y:        fromTop ? -50 - Math.random() * 40 : Math.random() * H * 0.8,
    angle,
    speed:    120 + Math.random() * 140,
    tail:     70  + Math.random() * 100,
    width:    0.4 + Math.random() * 1.2,
    maxAlpha: 0.18 + Math.random() * 0.28,
    life:     Math.random(),
    decay:    0.12 + Math.random() * 0.22,
  };
}

export default function StarfieldCanvas({ opacity = 0.65 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    // Use non-null typed references for use inside closures
    const canvas: HTMLCanvasElement              = canvasEl;
    const c:      CanvasRenderingContext2D       = ctx;

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
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
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
          type: (Math.random() < 0.14 ? "blue"
               : Math.random() < 0.08 ? "warm"
               : "white") as "white" | "blue" | "warm",
        };
      });
    }

    function buildComets() {
      comets = Array.from({ length: COMET_COUNT }, () => makeComet(W, H));
    }

    resize();
    buildStars();
    buildComets();

    const onResize = () => { resize(); buildStars(); buildComets(); };
    window.addEventListener("resize", onResize, { passive: true });

    function draw(now: number) {
      if (document.hidden) { raf = requestAnimationFrame(draw); return; }
      if (now - last < FRAME_MS) { raf = requestAnimationFrame(draw); return; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      c.clearRect(0, 0, W, H);

      // ── Stars ──
      for (const s of stars) {
        s.x  += s.vx * dt;
        s.y  += s.vy * dt;
        s.twinklePhase += s.twinkleSpeed * dt;
        if (s.x < -20) s.x = W + 10;
        if (s.x > W+20) s.x = -10;
        if (s.y < -20) s.y = H + 10;
        if (s.y > H+20) s.y = -10;

        const tw    = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const al    = (s.alpha * (0.7 + 0.3 * tw)) * 0.8;
        const color = s.type === "blue" ? `rgba(147,197,253,${al})`
                    : s.type === "warm" ? `rgba(253,230,150,${al})`
                    :                     `rgba(255,255,255,${al})`;

        // diffraction cross on large stars
        if (s.r > 1.2) {
          const arm = s.r * 4;
          c.strokeStyle = color;
          c.lineWidth   = 0.45;
          c.beginPath();
          c.moveTo(s.x - arm, s.y); c.lineTo(s.x + arm, s.y);
          c.moveTo(s.x, s.y - arm); c.lineTo(s.x, s.y + arm);
          c.stroke();
        }

        c.beginPath();
        c.arc(s.x, s.y, s.r * (0.88 + 0.12 * tw), 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
      }

      // ── Comets ──
      for (let i = 0; i < comets.length; i++) {
        const cm = comets[i];
        cm.x    += Math.cos(cm.angle) * cm.speed * dt;
        cm.y    += Math.sin(cm.angle) * cm.speed * dt;
        cm.life -= cm.decay * dt;

        const gone = cm.life <= 0
          || cm.x > W + 200 || cm.y > H + 100
          || cm.x < -200    || cm.y < -80;
        if (gone) { comets[i] = makeComet(W, H); continue; }

        // fade envelope
        const alpha = cm.life > 0.85  ? (1 - cm.life) / 0.15 * cm.maxAlpha
                    : cm.life < 0.15  ? cm.life / 0.15 * cm.maxAlpha
                    : cm.maxAlpha;
        if (alpha < 0.005) continue;

        const tx = cm.x - Math.cos(cm.angle) * cm.tail;
        const ty = cm.y - Math.sin(cm.angle) * cm.tail;
        if (!isFinite(tx) || !isFinite(ty)) continue;

        // tail gradient
        const g = c.createLinearGradient(tx, ty, cm.x, cm.y);
        g.addColorStop(0,    "rgba(255,255,255,0)");
        g.addColorStop(0.55, `rgba(200,220,255,${alpha * 0.45})`);
        g.addColorStop(1,    `rgba(255,255,255,${alpha})`);

        c.save();
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(cm.x, cm.y);
        c.strokeStyle = g;
        c.lineWidth   = cm.width;
        c.stroke();

        // head glow
        if (isFinite(cm.width) && cm.width > 0) {
          const hg = c.createRadialGradient(cm.x, cm.y, 0, cm.x, cm.y, cm.width * 4);
          hg.addColorStop(0, `rgba(255,255,255,${Math.min(alpha * 1.4, 1)})`);
          hg.addColorStop(1, "rgba(180,210,255,0)");
          c.beginPath();
          c.arc(cm.x, cm.y, cm.width * 4, 0, Math.PI * 2);
          c.fillStyle = hg;
          c.fill();
        }
        c.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
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
