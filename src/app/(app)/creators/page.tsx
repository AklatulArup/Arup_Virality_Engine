import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export default function CreatorsPage() {
  return (
    <div>
      <PageHeader
        title="Creators"
        description="Everyone in our evidence pool — who looks partner-worthy, who is trending up, and who carries risk."
      />
      <PhasePlaceholder note="The creator index is being rebuilt. Paste an @handle in the command bar (⌘K) to look someone up." />
    </div>
  );
}
