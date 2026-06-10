"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/library/pool", label: "Evidence pool" },
  { href: "/library/banks", label: "Banks" },
  { href: "/library/blocklist", label: "Blocklist" },
  { href: "/library/import", label: "Import" },
] as const;

export function LibraryTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-1 border-b border-border">
      {TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
