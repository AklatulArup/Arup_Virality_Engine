import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

// Creator Report card route. Next 16: params is a Promise — awaited here, then
// passed as plain props to the client screen (arrives with the P4 surface).
export default async function CreatorReportPage({
  params,
}: {
  params: Promise<{ platform: string; handle: string }>;
}) {
  const { platform, handle } = await params;
  const decoded = decodeURIComponent(handle);
  const label = decoded.startsWith("UC") && decoded.length === 24 ? decoded : `@${decoded.replace(/^@/, "")}`;

  return (
    <div>
      <PageHeader
        title={`Creator — ${label}`}
        description={`Partner report card for ${label} on ${platform}. Should we work with them?`}
      />
      <PhasePlaceholder note="The Creator Report card (verdict, reputation, track record) is being rebuilt here — it lands soon." />
    </div>
  );
}
