import { PageHeader } from "@/components/layout/page-header";
import { CreatorsIndex } from "@/components/creator/creators-index";

export default function CreatorsPage() {
  return (
    <div>
      <PageHeader
        title="Creators"
        description="Everyone in our evidence pool — who looks partner-worthy, who is trending up, and who carries risk."
      />
      <CreatorsIndex />
    </div>
  );
}
