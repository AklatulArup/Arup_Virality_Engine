"use client";

// Global command bar (⌘K). Paste anything — parseInput classifies it live and
// the top rows route to the right surface: video-ish input → the Video Report
// analyze flow, channel/handle input → the Creator report card. A bare
// "@handle" can belong to any platform, so it gets an explicit disambiguator
// (parseInput alone assumes YouTube).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Users, House, LibraryBig, ShieldCheck, ArrowRight } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { parseInput } from "@/lib/url-parser";

type Action = { key: string; label: string; hint: string; href: string; kind: "video" | "creator" };

function isBareHandle(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.includes("/") || t.includes(" ")) return false;
  if (/youtube|youtu\.be|tiktok|instagram|twitter|x\.com/i.test(t)) return false;
  return /^@?[A-Za-z0-9_.-]+$/.test(t) && !t.replace(/^@/, "").includes(".");
}

function classify(raw: string): Action[] {
  const t = raw.trim();
  if (!t) return [];
  const p = parseInput(t);
  const analyzeHref = `/videos/analyze?u=${encodeURIComponent(t)}`;

  // Bare @handle → platform is ambiguous; offer the three handle platforms.
  if (isBareHandle(t) && p.type === "youtube-channel" && p.handle) {
    const h = encodeURIComponent(p.handle);
    return [
      { key: "yt", label: `Open creator report — @${p.handle}`, hint: "YouTube", href: `/creators/youtube/${h}`, kind: "creator" },
      { key: "tt", label: `Open creator report — @${p.handle}`, hint: "TikTok", href: `/creators/tiktok/${h}`, kind: "creator" },
      { key: "ig", label: `Open creator report — @${p.handle}`, hint: "Instagram", href: `/creators/instagram/${h}`, kind: "creator" },
    ];
  }

  switch (p.type) {
    case "youtube-video":
      return [{ key: "v", label: "Analyze video", hint: "YouTube", href: analyzeHref, kind: "video" }];
    case "youtube-short":
      return [{ key: "v", label: "Analyze video", hint: "YouTube Short", href: analyzeHref, kind: "video" }];
    case "youtube-channel": {
      const idOrHandle = p.handle ?? p.id;
      if (!idOrHandle) return [];
      return [
        {
          key: "c",
          label: `Open creator report — ${p.handle ? `@${p.handle}` : idOrHandle}`,
          hint: "YouTube",
          href: `/creators/youtube/${encodeURIComponent(idOrHandle)}`,
          kind: "creator",
        },
      ];
    }
    case "tiktok": {
      const rows: Action[] = [];
      if (p.id) rows.push({ key: "v", label: "Analyze this video", hint: "TikTok", href: analyzeHref, kind: "video" });
      if (p.handle)
        rows.push({
          key: "c",
          label: `Open creator report — @${p.handle}`,
          hint: "TikTok",
          href: `/creators/tiktok/${encodeURIComponent(p.handle)}`,
          kind: "creator",
        });
      if (rows.length === 0) rows.push({ key: "v", label: "Analyze content", hint: "TikTok", href: analyzeHref, kind: "video" });
      return rows;
    }
    case "instagram": {
      const rows: Action[] = [];
      if (p.id) rows.push({ key: "v", label: "Analyze this reel", hint: "Instagram", href: analyzeHref, kind: "video" });
      if (p.handle)
        rows.push({
          key: "c",
          label: `Open creator report — @${p.handle}`,
          hint: "Instagram",
          href: `/creators/instagram/${encodeURIComponent(p.handle)}`,
          kind: "creator",
        });
      if (rows.length === 0) rows.push({ key: "v", label: "Analyze content", hint: "Instagram", href: analyzeHref, kind: "video" });
      return rows;
    }
    case "x":
      return [{ key: "v", label: "Analyze post", hint: "X", href: analyzeHref, kind: "video" }];
    default:
      return [];
  }
}

const PAGES = [
  { href: "/", label: "Home", icon: House },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/library/pool", label: "Library", icon: LibraryBig },
  { href: "/trust", label: "Trust Center", icon: ShieldCheck },
] as const;

export function CommandBar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const actions = useMemo(() => classify(query), [query]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Analyze anything" description="Paste a link or @handle">
      {/* shouldFilter off: rows are computed from parseInput, not fuzzy-matched */}
      <Command shouldFilter={false}>
        <CommandInput placeholder="Paste a video URL, channel link, or @handle…" value={query} onValueChange={setQuery} />
        <CommandList>
        {query.trim() && actions.length === 0 ? (
          <CommandEmpty>We couldn&apos;t read that — try a full video URL or an @handle.</CommandEmpty>
        ) : null}
        {actions.length > 0 ? (
          <CommandGroup heading="Detected">
            {actions.map((a) => (
              <CommandItem key={a.key + a.href} value={a.key + a.href} onSelect={() => go(a.href)}>
                {a.kind === "video" ? <Clapperboard className="size-4" /> : <Users className="size-4" />}
                <span>{a.label}</span>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                  {a.hint}
                  <ArrowRight className="size-3" />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {actions.length > 0 ? <CommandSeparator /> : null}
          <CommandGroup heading="Go to">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={`page ${label}`} onSelect={() => go(href)}>
                <Icon className="size-4" />
                <span>{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
