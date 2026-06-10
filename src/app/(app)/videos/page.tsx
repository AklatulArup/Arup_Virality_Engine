import { PageHeader } from "@/components/layout/page-header";
import { VideosIndex } from "@/components/video/videos-index";

export default function VideosPage() {
  return (
    <div>
      <PageHeader
        title="Videos"
        description="Every video the team has analyzed — forecasts, what happened since we looked, and the predictions we put on the record."
      />
      <VideosIndex />
    </div>
  );
}
