"use client";

// ═══════════════════════════════════════════════════════════════════════════
// NEW DASHBOARD — FundedNext Intel shell
// ═══════════════════════════════════════════════════════════════════════════
//
// Orchestrator for the Dashboard.html design. Assembles Sidebar + TopBar +
// History drawer + War Room modal around a route-switched main area.
//
// Routes:
//   landing    → LandingPage (default)
//   reverse    → ReverseEnginePage
//   bulk       → BulkImportPage
//   calendar   → CalendarPage
//   libraries  → LibrariesPage
//   reference  → ReferencePoolPage
//   forecast   → legacy <Dashboard /> (full analyze flow lives in Dashboard.tsx)
//   history    → LandingPage (history surface lives in the bottom drawer)
//   calibration→ LandingPage + footer link to /admin/calibration
//
// The legacy Dashboard component is rendered unchanged when route==='forecast'
// so the full analyze → fetch → enrich → forecast pipeline keeps working
// exactly as before. This lets us ship the new shell without touching the
// 2300 lines of analyze logic.

import React, { useEffect, useState } from "react";
import type { Platform } from "@/lib/forecast";
import { type ShellRoute, PLATFORMS } from "@/lib/design-tokens";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import HistoryDrawer from "./HistoryDrawer";
import WarRoomModal from "./WarRoomModal";
import LandingPage from "./LandingPage";
import ReverseEnginePage from "./ReverseEnginePage";
import { BulkImportPage, CalendarPage, LibrariesPage, ReferencePoolPage } from "./OtherPages";
import Dashboard from "@/components/Dashboard";

const STORAGE_KEY = "ve_route";

export default function NewDashboard() {
  const [route, setRoute]         = useState<ShellRoute>("landing");
  const [platform, setPlatform]   = useState<Platform>("youtube");
  // Mode is MULTI-SELECT (legacy behaviour restored). Default F = URL analysis.
  const [activeModes, setActiveModes] = useState<Set<string>>(() => new Set(["F"]));
  const [drawerOpen, setDrawer]   = useState(false);
  const [warRoom, setWarRoom]     = useState(false);
  const [poolStats, setPoolStats] = useState({ videos: 0, creators: 0, shorts: 0, keywords: 0 });

  // Restore persisted route on mount, persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && isRoute(saved)) setRoute(saved as ShellRoute);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, route);
  }, [route]);

  // Sync Mode D ↔ Reverse Engineer page. When the user navigates to the
  // reverse route, ensure D is in the active mode set (additive — doesn't
  // clear other selected modes).
  useEffect(() => {
    if (route === "reverse" && !activeModes.has("D")) {
      setActiveModes(prev => new Set(prev).add("D"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Listen for War Room open events fired by any descendant (e.g. the forecast
  // panel's rail CTA button).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setWarRoom(true);
    window.addEventListener("ve:open-war-room", handler);
    return () => window.removeEventListener("ve:open-war-room", handler);
  }, []);

  // Fetch pool stats for the sidebar tiles. Refetches on mount AND whenever
  // legacy Dashboard fires `ve:pool-updated` after a successful analyze →
  // reference-store/keyword-bank write. This keeps the sidebar numbers live
  // without polling.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      fetch("/api/reference-store")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const entries = Array.isArray(d?.entries) ? d.entries : Array.isArray(d) ? d : [];
          const creators = new Set<string>();
          let shorts = 0;
          for (const e of entries) {
            const handle = (e?.channelName ?? e?.name) as string | undefined;
            if (handle) creators.add(handle);
            const duration   = Number(e?.durationSeconds ?? 0);
            const format     = e?.videoFormat as string | undefined;
            const platformId = e?.platform    as string | undefined;
            if (platformId === "youtube_short" || format === "short" || (duration > 0 && duration <= 60)) shorts++;
          }
          fetch("/api/keyword-bank")
            .then(r => r.ok ? r.json() : null)
            .then(kb => {
              const cats = kb?.categories ?? {};
              const keywords = Object.values(cats).reduce<number>((n, arr) => {
                return n + (Array.isArray(arr) ? arr.length : 0);
              }, 0);
              setPoolStats({ videos: entries.length, creators: creators.size, shorts, keywords });
            })
            .catch(() => setPoolStats({ videos: entries.length, creators: creators.size, shorts, keywords: 0 }));
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("ve:pool-updated", refresh);
    return () => window.removeEventListener("ve:pool-updated", refresh);
  }, []);

  const handleAnalyze = (url: string) => {
    if (!url || typeof window === "undefined") return;
    // Two paths so it works whether Dashboard is already mounted or not:
    //  1. sessionStorage — for COLD mount (user was on Landing, first click).
    //  2. custom event    — for HOT re-trigger (Dashboard already mounted on
    //                        the forecast route, user pastes a new URL).
    // The event path fires synchronously so a listener installed in a
    // currently-mounted Dashboard picks it up. The sessionStorage backup
    // covers the case where the route switch remounts Dashboard fresh.
    window.sessionStorage.setItem("ve_pending_analyze", url);
    window.dispatchEvent(new CustomEvent("ve:analyze-url", { detail: { url } }));
    setRoute("forecast");
  };

  // Mode toggle: legacy multi-select behaviour — clicking a chip flips its
  // presence in the active set. If Mode D is toggled ON, also switch to the
  // Reverse Engineer page (mirrors old Dashboard.tsx logic).
  const toggleMode = (m: string) => {
    setActiveModes(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
    if (m === "D" && !activeModes.has("D")) setRoute("reverse");
  };
  const selectAllModes = () => {
    setActiveModes(new Set(["A", "B", "C", "D", "E", "F", "G", "H", "OLR"]));
  };
  const clearModes = () => {
    setActiveModes(new Set());
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#0B0C0E", color: "#E8E6E1", fontFamily: "IBM Plex Sans, sans-serif" }}>
      <Sidebar
        route={route}         setRoute={setRoute}
        platform={platform}   setPlatform={setPlatform}
        activeModes={activeModes}
        toggleMode={toggleMode}
        selectAllModes={selectAllModes}
        clearModes={clearModes}
        pool={poolStats}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
        <TopBar platform={platform} onAnalyze={handleAnalyze} />
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {route === "landing"   && <LandingPage />}
          {route === "reverse"   && <ReverseEnginePage platform={platform} onAnalyze={handleAnalyze} />}
          {route === "bulk"      && <BulkImportPage />}
          {route === "calendar"  && <CalendarPage />}
          {route === "libraries" && <LibrariesPage />}
          {route === "reference" && <ReferencePoolPage />}
          {route === "forecast"  && <Dashboard headless />}
          {route === "history"   && <LandingPage />}
          {route === "calibration" && <CalibrationStub />}
        </div>
        <HistoryDrawer open={drawerOpen} onToggle={() => setDrawer(v => !v)} />
      </div>
      <WarRoomModal open={warRoom} onClose={() => setWarRoom(false)} />
      {/* Unused right now but exposed so any child can trigger it via window: */}
      <WarRoomOpener onOpen={() => setWarRoom(true)} />
      {/* Platform label used nowhere but kept to silence tree-shake warnings when we iterate */}
      <span style={{ display: "none" }}>{PLATFORMS[platform].label}</span>
    </div>
  );
}

function isRoute(v: string): v is ShellRoute {
  return [
    "landing", "reverse", "bulk", "calendar", "libraries",
    "reference", "forecast", "history", "calibration",
  ].includes(v);
}

function CalibrationStub() {
  return (
    <div style={{ padding: "16px 20px", position: "relative" }}>
      <section style={{
        background: "#101216", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 4, padding: "16px 18px",
      }}>
        <div style={{ fontSize: 14, color: "#E8E6E1", fontWeight: 600, marginBottom: 6 }}>Forecast calibration</div>
        <div style={{ fontSize: 12, color: "#B5B2AB", marginBottom: 12, lineHeight: 1.55 }}>
          The full calibration surface (MdAPE per platform, conformal intervals, lifecycle-tier distribution, auto-tuning suggestions) is at the admin page below. Opening this route only restores the persisted position in the new shell.
        </div>
        <a href="/admin/calibration" style={{
          display: "inline-block", padding: "8px 14px",
          background: "rgba(155,135,232,0.14)", border: "1px solid rgba(155,135,232,0.35)",
          color: "#9B87E8", fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
          letterSpacing: 0.8, borderRadius: 3, textDecoration: "none",
        }}>→ /admin/calibration</a>
      </section>
    </div>
  );
}

// Invisible helper — placeholder for future "Open War Room" triggers from
// child components. Currently unused; keeping the import valid.
function WarRoomOpener(_props: { onOpen: () => void }): null {
  return null;
}
