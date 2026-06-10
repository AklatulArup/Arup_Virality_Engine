import { AppShell } from "@/components/layout/app-shell";

// Route-group layout: every new-UI surface (/videos, /creators, /library,
// /trust — and / itself at cutover) gets the shell chrome. The legacy UI at
// "/" lives outside this group until the final cutover phase.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
