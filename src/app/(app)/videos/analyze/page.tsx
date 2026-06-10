import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

// Video Report route. Next 16: searchParams is a Promise — awaited here, then
// passed as plain props to the client screen (arrives with the P3 surface).
export default async function VideoAnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  const target = typeof u === "string" && u.length > 0 ? decodeURIComponent(u) : null;

  return (
    <div>
      <PageHeader
        title="Video Report"
        description={target ? `Queued: ${target}` : "Paste a video link in the command bar (⌘K) to start a report."}
      />
      <PhasePlaceholder note="The full Video Report (forecast, signals, war room, intelligence) is being rebuilt here — it lands in the next phase. The current tool on the home page still analyzes everything." />
    </div>
  );
}
