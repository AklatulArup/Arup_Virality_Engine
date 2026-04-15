import type { Mode } from "./types";

export const MODES: Mode[] = [
  { id: "A", label: "Platform Education", icon: "📚", desc: "How algorithms work",       color: "var(--color-mode-a)" },
  { id: "B", label: "Continuous Update",  icon: "🔄", desc: "Latest algorithm changes",  color: "var(--color-mode-b)" },
  { id: "C", label: "Outlier Detection",  icon: "🔍", desc: "Why content outperformed",  color: "var(--color-mode-c)" },
  { id: "D", label: "Reverse Engineer",   icon: "⚙️", desc: "Break down virality",       color: "var(--color-mode-d)" },
  { id: "E", label: "Competitor Intel",   icon: "🎯", desc: "Competitor strategies",     color: "var(--color-mode-e)" },
  { id: "F", label: "URL Analysis",       icon: "🔗", desc: "Full viral breakdown",      color: "var(--color-mode-f)" },
  { id: "G", label: "VRS Score",          icon: "📊", desc: "Viral readiness 0–100%",    color: "var(--color-mode-g)" },
  { id: "H", label: "Intel Update",       icon: "🧠", desc: "Update knowledge base",     color: "var(--color-mode-h)" },
];
