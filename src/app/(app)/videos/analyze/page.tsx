import { PageHeader } from "@/components/layout/page-header";
import { VideoAnalyzeScreen } from "@/components/video/video-analyze-screen";

// Video Report route. Next 16: searchParams is a Promise — awaited here, then
// passed as plain props to the client screen. The screen is KEYED by the raw
// input so a new ?u= deterministically remounts + re-analyzes (replaces the
// legacy sessionStorage/event handoff dance).
export default async function VideoAnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  const target = typeof u === "string" && u.length > 0 ? u : null;

  if (!target) {
    return (
      <PageHeader
        title="Video Report"
        description="Paste a video link in the command bar (⌘K) to start a report."
      />
    );
  }

  return <VideoAnalyzeScreen key={target} url={target} />;
}
