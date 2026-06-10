import { PageHeader } from "@/components/layout/page-header";
import { TrustScreen } from "@/components/trust/trust-screen";

export default function TrustPage() {
  return (
    <div>
      <PageHeader
        title="Trust Center"
        description="How reliable our forecasts are — measured against real results — and whether every data source is healthy."
      />
      <TrustScreen />
    </div>
  );
}
