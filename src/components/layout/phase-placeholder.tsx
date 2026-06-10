import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

// Temporary stub body for routes whose real surface lands in a later phase of
// the rebuild. Deleted as each surface ships.
export function PhasePlaceholder({ note }: { note: string }) {
  return (
    <Card className="mt-6">
      <CardContent className="flex items-center gap-3 py-8 text-[13px] text-muted-foreground">
        <Hammer className="size-4 shrink-0" />
        <span>{note}</span>
      </CardContent>
    </Card>
  );
}
