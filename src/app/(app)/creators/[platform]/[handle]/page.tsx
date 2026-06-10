import { CreatorReportScreen } from "@/components/creator/creator-report-screen";
import type { Platform } from "@/lib/forecast";

// Creator Report card route. Next 16: params is a Promise — awaited here, then
// passed as plain props to the client screen (keyed so a different creator
// remounts cleanly).
export default async function CreatorReportPage({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform: rawPlatform, handle: rawHandle } = await params;
  const handle = decodeURIComponent(rawHandle);
  const platform: Platform =
    rawPlatform === "tiktok" || rawPlatform === "instagram" || rawPlatform === "x" || rawPlatform === "youtube_short"
      ? rawPlatform
      : "youtube";

  return <CreatorReportScreen key={`${platform}:${handle}`} platform={platform} handle={handle} />;
}
