/**
 * puter-ai.ts
 * Client-side AI via Puter.js — free, no API key required.
 * Falls back automatically when server-side Claude key is unavailable.
 * 
 * Puter.js is loaded via <script> in layout.tsx.
 * It exposes window.puter with puter.ai.chat()
 */

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string,
          options?: { model?: string; stream?: boolean }
        ) => Promise<{ message?: { content?: Array<{ text: string }> }; toString?: () => string } | string>;
      };
    };
  }
}

/** Wait for Puter.js to load — polls until ready or times out */
function waitForPuter(timeoutMs = 8000): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window !== "undefined" && window.puter?.ai) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const check = setInterval(() => {
      if (window.puter?.ai) { clearInterval(check); resolve(true); return; }
      if (Date.now() - start > timeoutMs) { clearInterval(check); resolve(false); }
    }, 100);
  });
}

/** Extract text from puter.ai.chat() response (varies by model) */
function extractText(response: unknown): string {
  if (!response) return "";
  if (typeof response === "string") return response;
  const r = response as { message?: { content?: Array<{ text: string }> }; toString?: () => string };
  // Claude format
  if (r.message?.content?.[0]?.text) return r.message.content[0].text;
  // String coercion
  if (r.toString) return r.toString();
  return JSON.stringify(response);
}

/**
 * Call Claude via Puter.js (client-side, free, no API key needed)
 * Returns the response text or throws an error.
 */
export async function puterAIChat(prompt: string, systemPrompt?: string): Promise<string> {
  const ready = await waitForPuter();
  if (!ready) throw new Error("Puter.js not loaded");
  if (!window.puter?.ai) throw new Error("Puter AI unavailable");

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  const response = await window.puter.ai.chat(fullPrompt, {
    model: "claude-sonnet-4-5",
  });

  const text = extractText(response);
  if (!text) throw new Error("Empty response from Puter AI");
  return text;
}

/** Check if Puter.js is available in this browser session */
export function isPuterAvailable(): boolean {
  return typeof window !== "undefined" && !!window.puter?.ai;
}
