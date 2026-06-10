"use client";

// Z4 — "Your data": the #1 accuracy lever, never collapsed. Completeness bar
// (Measured / AI-estimated / Missing) + the ingest Sheet (Screenshot OCR,
// CSV export, Type-it-in with full what/where/good/bad/why guidance).

import { useRef, useState } from "react";
import type { Forecast, ManualInputs, Platform } from "@/lib/forecast";
import { INPUT_TOOLTIPS } from "@/lib/input-tooltips";
import { completenessOf } from "./kpi-row";
import type { IngestStatus } from "@/hooks/use-forecast-bundle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CircleHelp, ImagePlus, FileSpreadsheet, Plus } from "lucide-react";

const FIELDS_BY_PLATFORM: Record<Platform, Array<keyof ManualInputs>> = {
  tiktok: ["ttCompletionPct", "ttRewatchPct", "ttFypViewPct", "baselineMedianOverride"],
  instagram: ["igSaves", "igSends", "igReach", "igHold3s", "baselineMedianOverride"],
  youtube: ["ytAVDpct", "ytCTRpct", "ytImpressions", "baselineMedianOverride"],
  youtube_short: ["ytAVDpct", "ytCTRpct", "ytImpressions", "baselineMedianOverride"],
  x: ["xTweepCred", "xReplyByAuthor", "baselineMedianOverride"],
};

const FIELD_LABELS: Partial<Record<keyof ManualInputs, string>> = {
  ttCompletionPct: "Completion %",
  ttRewatchPct: "Rewatch %",
  ttFypViewPct: "For You traffic %",
  igSaves: "Saves",
  igSends: "Shares (sends)",
  igReach: "Accounts reached",
  igHold3s: "3-second hold %",
  ytAVDpct: "Avg % viewed",
  ytCTRpct: "Click-through %",
  ytImpressions: "Impressions",
  xTweepCred: "Account score",
  xReplyByAuthor: "Replies you answered",
  baselineMedianOverride: "Typical views (manual)",
};

function StatusLine({ status }: { status: IngestStatus | null }) {
  if (!status) return null;
  const color = status.kind === "done" ? "#2ECC8A" : status.kind === "error" ? "#E4574E" : "#7E7B75";
  return (
    <div className="mt-2 font-mono text-[11px]" style={{ color }}>
      {status.kind === "working" ? "⏳ " : status.kind === "done" ? "✓ " : "✕ "}
      {status.message}
    </div>
  );
}

export function YourDataCard({
  forecast: f,
  platform,
  manualInputs,
  updateInput,
  aiEstimatedKeys,
  ocrStatus,
  csvStatus,
  ingestImage,
  ingestCsv,
  setPasteCaptureEnabled,
}: {
  forecast: Forecast;
  platform: Platform;
  manualInputs: ManualInputs;
  updateInput: (key: keyof ManualInputs, raw: string) => void;
  aiEstimatedKeys: Set<keyof ManualInputs>;
  ocrStatus: IngestStatus | null;
  csvStatus: IngestStatus | null;
  ingestImage: (file: File) => Promise<void>;
  ingestCsv: (file: File) => Promise<void>;
  setPasteCaptureEnabled: (on: boolean) => void;
}) {
  const comp = completenessOf(f);
  const [open, setOpen] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const fields = FIELDS_BY_PLATFORM[platform];
  const csvSupported = platform === "tiktok" || platform === "instagram";

  const seg = (n: number) => (comp.total > 0 ? `${(n / comp.total) * 100}%` : "0%");

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between pb-0">
        <CardTitle className="text-[14px] font-semibold">Your data</CardTitle>
        <Sheet
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            setPasteCaptureEnabled(o);
          }}
        >
          <SheetTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Add creator analytics
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
            <SheetHeader>
              <SheetTitle>Add creator analytics</SheetTitle>
              <SheetDescription>
                Numbers from the creator&apos;s own dashboard tighten the forecast range. Saved to this creator&apos;s
                memory — they pre-fill next time.
              </SheetDescription>
            </SheetHeader>
            <Tabs defaultValue="screenshot" className="px-4 pb-6">
              <TabsList className="w-full">
                <TabsTrigger value="screenshot" className="flex-1">Screenshot</TabsTrigger>
                <TabsTrigger value="csv" className="flex-1">CSV</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">Type it in</TabsTrigger>
              </TabsList>

              <TabsContent value="screenshot" className="mt-4">
                <button
                  type="button"
                  onClick={() => imgRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-border bg-background px-4 py-10 text-center transition-colors hover:border-ring"
                >
                  <ImagePlus className="size-6 text-muted-foreground" />
                  <span className="text-[13px] text-foreground">Drop a Creator Studio / Insights screenshot</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    or press ⌘V to paste from your clipboard — we only fill fields clearly visible in the image
                  </span>
                </button>
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void ingestImage(file);
                    e.target.value = "";
                  }}
                />
                <StatusLine status={ocrStatus} />
              </TabsContent>

              <TabsContent value="csv" className="mt-4">
                {csvSupported ? (
                  <>
                    <button
                      type="button"
                      onClick={() => csvRef.current?.click()}
                      className="flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-border bg-background px-4 py-10 text-center transition-colors hover:border-ring"
                    >
                      <FileSpreadsheet className="size-6 text-muted-foreground" />
                      <span className="text-[13px] text-foreground">
                        Upload a {platform === "tiktok" ? "TikTok Studio" : "Meta Business Suite"} export
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        We aggregate every row into creator-level numbers and save them to memory
                      </span>
                    </button>
                    <input
                      ref={csvRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void ingestCsv(file);
                        e.target.value = "";
                      }}
                    />
                    <StatusLine status={csvStatus} />
                  </>
                ) : (
                  <p className="py-8 text-center text-[12.5px] text-muted-foreground">
                    CSV import is available for TikTok and Instagram. Use Screenshot or Type-it-in here.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="manual" className="mt-4 space-y-3">
                {fields.map((key) => {
                  const tip = INPUT_TOOLTIPS[key as string];
                  const isAI = aiEstimatedKeys.has(key);
                  const val = manualInputs[key];
                  return (
                    <div key={key as string}>
                      <div className="mb-1 flex items-center gap-1.5">
                        <label className="text-[12px] text-muted-foreground" htmlFor={`mi-${key as string}`}>
                          {FIELD_LABELS[key] ?? (key as string)}
                        </label>
                        {tip ? (
                          <HoverCard openDelay={150}>
                            <HoverCardTrigger asChild>
                              <CircleHelp className="size-3 cursor-help text-muted-foreground/60" />
                            </HoverCardTrigger>
                            <HoverCardContent className="w-[340px] space-y-1.5 text-[11.5px] leading-relaxed">
                              <p className="text-foreground">{tip.what}</p>
                              <p className="text-muted-foreground"><span className="text-foreground/80">Where:</span> {tip.where}</p>
                              <p className="text-[#2ECC8A]">Good: {tip.good}</p>
                              <p className="text-[#F0B35A]">Bad: {tip.bad}</p>
                              <p className="text-muted-foreground">{tip.why}</p>
                            </HoverCardContent>
                          </HoverCard>
                        ) : null}
                        {isAI ? (
                          <Badge variant="outline" className="h-4 border-[#9B87E8]/40 px-1.5 font-mono text-[9px] text-[#9B87E8]">
                            AI estimate
                          </Badge>
                        ) : null}
                      </div>
                      <Input
                        id={`mi-${key as string}`}
                        type="number"
                        inputMode="decimal"
                        value={val ?? ""}
                        placeholder="—"
                        onChange={(e) => updateInput(key, e.target.value)}
                        className="h-8 font-mono text-[13px]"
                      />
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      </CardHeader>
      <CardContent>
        <div className="text-[12.5px] text-muted-foreground">
          We&apos;re using <span className="font-mono text-foreground">{comp.measured}</span> measured input
          {comp.measured === 1 ? "" : "s"}
          {comp.aiEstimated > 0 ? (
            <>
              {" "}+ <span className="font-mono text-[#9B87E8]">{comp.aiEstimated}</span> AI estimate{comp.aiEstimated === 1 ? "" : "s"}
            </>
          ) : null}
          {comp.missing > 0 ? (
            <>
              {" "}· <span className="font-mono text-foreground">{comp.missing}</span> high-value input{comp.missing === 1 ? "" : "s"} still missing — adding them typically tightens the range noticeably.
            </>
          ) : (
            <> — every high-value input is in. This is as tight as the range gets.</>
          )}
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-background">
          <div style={{ width: seg(comp.measured), background: "#2ECC8A" }} />
          <div style={{ width: seg(comp.aiEstimated), background: "#9B87E8" }} />
          <div style={{ width: seg(comp.missing), background: "rgba(255,255,255,0.08)" }} />
        </div>
        <div className="mt-2 flex gap-4 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-[#2ECC8A]" />Measured</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-[#9B87E8]" />AI-estimated</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-white/10" />Missing</span>
        </div>
      </CardContent>
    </Card>
  );
}
