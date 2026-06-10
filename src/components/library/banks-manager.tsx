"use client";

// Library → Banks: the vocabulary the engine matches against. Keywords power
// niche detection + ranking; hashtags feed content packaging; competitors
// power the gap analysis.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { X } from "lucide-react";

interface KeywordBankShape {
  categories: { niche: string[]; competitors: string[]; contentType: string[]; language: string[] };
}
interface HashtagBankShape {
  categories: { viral: string[]; brand: string[]; niche: string[]; campaign: string[] };
}
interface CompetitorShape {
  name: string;
  space?: string;
}

function ChipList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => (
        <span key={k} className="group inline-flex items-center gap-1 rounded-[4px] border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground">
          {k}
          <button type="button" onClick={() => onRemove(k)} className="text-muted-foreground/50 hover:text-destructive" aria-label={`Remove ${k}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {items.length === 0 ? <span className="text-[11.5px] text-muted-foreground">None yet.</span> : null}
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) {
          onAdd(v.trim());
          setV("");
        }
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-8 max-w-[280px] text-[12.5px]" />
      <Button type="submit" size="sm" variant="outline" className="h-8">Add</Button>
    </form>
  );
}

export function BanksManager() {
  const [kw, setKw] = useState<KeywordBankShape | null>(null);
  const [ht, setHt] = useState<HashtagBankShape | null>(null);
  const [comp, setComp] = useState<CompetitorShape[] | null>(null);

  const loadAll = useCallback(() => {
    fetch("/api/keyword-bank").then((r) => r.json()).then(setKw).catch(() => {});
    fetch("/api/hashtag-bank").then((r) => r.json()).then(setHt).catch(() => {});
    fetch("/api/competitor-bank").then((r) => r.json()).then((d) => setComp(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  useEffect(() => loadAll(), [loadAll]);

  const mutate = async (url: string, method: "POST" | "DELETE", body: unknown, okMsg: string) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      toast.success(okMsg);
      loadAll();
    } else {
      toast.error("That didn't save.");
    }
  };

  const KW_CATS = [
    { key: "niche", label: "Niche terms", why: "Detect what niche a video belongs to, so it gets ranked against the right peers" },
    { key: "competitors", label: "Competitor names", why: "Spot when a video mentions a rival prop firm" },
    { key: "contentType", label: "Content formats", why: "Classify videos by format (challenge, tutorial, review…)" },
    { key: "language", label: "Language markers", why: "Detect non-English content for the language breakdown" },
  ] as const;

  const HT_CATS = [
    { key: "viral", label: "Viral" },
    { key: "brand", label: "Brand" },
    { key: "niche", label: "Niche" },
    { key: "campaign", label: "Campaign" },
  ] as const;

  return (
    <div className="mt-5 space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">Keywords</CardTitle>
          <p className="text-[11.5px] text-muted-foreground">Used to detect niche and rank videos against the right peer group.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!kw ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            KW_CATS.map(({ key, label, why }) => (
              <div key={key}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[12.5px] font-medium text-foreground">{label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{why}</span>
                </div>
                <ChipList
                  items={kw.categories[key] ?? []}
                  onRemove={(item) => void mutate("/api/keyword-bank", "DELETE", { [key]: [item] }, "Keyword removed.")}
                />
                <AddRow placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}…`} onAdd={(v) => void mutate("/api/keyword-bank", "POST", { [key]: [v] }, "Keyword added.")} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">Hashtags</CardTitle>
          <p className="text-[11.5px] text-muted-foreground">Grouped tags for packaging guidance.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ht ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            HT_CATS.map(({ key, label }) => (
              <div key={key}>
                <div className="mb-1.5 text-[12.5px] font-medium text-foreground">{label}</div>
                <ChipList
                  items={ht.categories[key] ?? []}
                  onRemove={(item) => void mutate("/api/hashtag-bank", "DELETE", { [key]: [item] }, "Hashtag removed.")}
                />
                <AddRow placeholder={`Add a ${label.toLowerCase()} hashtag…`} onAdd={(v) => void mutate("/api/hashtag-bank", "POST", { [key]: [v.replace(/^#/, "")] }, "Hashtag added.")} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[14px] font-semibold">Competitors</CardTitle>
          <p className="text-[11.5px] text-muted-foreground">Powers the competitor-gap analysis on Video Reports.</p>
        </CardHeader>
        <CardContent>
          {!comp ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <ChipList
                items={comp.map((c) => c.name)}
                onRemove={(name) => void mutate(`/api/competitor-bank?name=${encodeURIComponent(name)}`, "DELETE", { name }, "Competitor removed.")}
              />
              <AddRow placeholder="Add a competitor (e.g. FTMO)…" onAdd={(v) => void mutate("/api/competitor-bank", "POST", { name: v }, "Competitor added.")} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
