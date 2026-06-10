"use client";

// The (app) shell: sidebar + main column, global command bar, shared pool
// store, tooltips and toasts. Every new-UI route renders inside this.

import { useState } from "react";
import { PoolProvider } from "@/hooks/use-pool";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarNav } from "./sidebar-nav";
import { CommandBar } from "./command-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <PoolProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen bg-background font-sans text-foreground">
          <SidebarNav onOpenCommand={() => setCommandOpen(true)} />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-[1280px] px-8 py-8">{children}</div>
          </main>
        </div>
        <CommandBar open={commandOpen} onOpenChange={setCommandOpen} />
        <Toaster theme="dark" position="bottom-right" />
      </TooltipProvider>
    </PoolProvider>
  );
}
