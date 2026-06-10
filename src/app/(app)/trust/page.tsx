import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export default function TrustPage() {
  return (
    <div>
      <PageHeader
        title="Trust Center"
        description="How reliable our forecasts are — measured against real results — and whether every data source is healthy."
      />
      <PhasePlaceholder note="The Trust Center is being rebuilt here. Until it lands, the existing accuracy page at /admin/calibration has the full picture." />
    </div>
  );
}
