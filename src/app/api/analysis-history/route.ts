import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const FILE = path.join(process.cwd(), "src/data/analysis-history.json");

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { entries: [] }; }
}
function write(data: object) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  return NextResponse.json(read());
}

export async function POST(req: Request) {
  const entry = await req.json();
  const store = read();
  const entries: HistoryEntry[] = store.entries || [];

  // Check if we already have an entry for this URL
  const existingIdx = entries.findIndex((e: HistoryEntry) => e.url === entry.url);

  if (existingIdx >= 0) {
    // Keep the old entry as previousSnapshot, update with new metrics
    const old = entries[existingIdx];
    entries[existingIdx] = {
      ...entry,
      firstCheckedAt: old.firstCheckedAt || old.checkedAt,
      previousSnapshot: {
        checkedAt: old.checkedAt,
        metrics: old.metrics,
      },
    };
  } else {
    entries.unshift({ ...entry, firstCheckedAt: entry.checkedAt });
  }

  // Keep last 200 entries
  store.entries = entries.slice(0, 200);
  write(store);
  return NextResponse.json({ ok: true, action: existingIdx >= 0 ? "updated" : "created" });
}

interface HistoryEntry {
  url: string;
  checkedAt: string;
  firstCheckedAt?: string;
  metrics: Record<string, number | string>;
  previousSnapshot?: { checkedAt: string; metrics: Record<string, number | string> };
}
