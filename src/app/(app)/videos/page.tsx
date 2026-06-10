import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export default function VideosPage() {
  return (
    <div>
      <PageHeader
        title="Videos"
        description="Every video the team has analyzed — forecasts, outcomes, and what happened since we looked."
      />
      <PhasePlaceholder note="The video index is being rebuilt. For now, paste a link in the command bar (⌘K) — analysis lands here next." />
    </div>
  );
}
