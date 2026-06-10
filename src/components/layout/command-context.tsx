"use client";

// Tiny context so any surface (sidebar trigger, Home hero) can open the
// global command bar owned by AppShell.

import { createContext, useContext } from "react";

export const CommandContext = createContext<{ openCommand: () => void }>({ openCommand: () => {} });

export function useCommand() {
  return useContext(CommandContext);
}
