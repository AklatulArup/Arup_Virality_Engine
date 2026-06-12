"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Clapperboard, Users, LibraryBig, ShieldCheck, Search, BookOpen, Sparkles } from "lucide-react";
import { usePool } from "@/hooks/use-pool";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: House, exact: true },
  { href: "/videos", label: "Videos", icon: Clapperboard, exact: false },
  { href: "/creators", label: "Creators", icon: Users, exact: false },
] as const;

const NAV_SECONDARY = [
  { href: "/playbooks", label: "Playbooks", icon: Sparkles, match: "/playbooks" },
  { href: "/library/pool", label: "Library", icon: LibraryBig, match: "/library" },
  { href: "/trust", label: "Trust Center", icon: ShieldCheck, match: "/trust" },
  { href: "/guide", label: "How to use", icon: BookOpen, match: "/guide" },
] as const;

export function SidebarNav({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();
  const { counts, loading } = usePool();

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Wordmark */}
      <Link href="/" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex size-7 items-center justify-center rounded-[6px] border border-border bg-card font-mono text-[11px] font-semibold text-foreground">
          FN
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">FundedNext Intel</span>
      </Link>

      {/* Command bar trigger */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2 rounded-[6px] border border-input bg-card px-3 py-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Search className="size-3.5" />
          <span className="flex-1">Analyze anything…</span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <NavLink key={href} href={href} active={active}>
              <Icon className="size-4" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-5 my-3 border-t border-sidebar-border" />

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_SECONDARY.map(({ href, label, icon: Icon, match }) => (
          <NavLink key={href} href={href} active={pathname.startsWith(match)}>
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Evidence pool tile */}
      <div className="mt-auto px-5 pb-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Evidence pool
        </div>
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        ) : counts ? (
          <Link href="/library/pool" className="group block">
            <div className="font-mono text-[20px] font-medium text-foreground group-hover:text-primary">
              {counts.videos.toLocaleString()}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">entries</span>
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
              {counts.creators.toLocaleString()} creators · {counts.shorts.toLocaleString()} shorts
            </div>
          </Link>
        ) : (
          <div className="text-[11.5px] text-muted-foreground">Pool unavailable</div>
        )}
      </div>
    </aside>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-[6px] px-3 py-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
