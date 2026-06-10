import { PageHeader } from "@/components/layout/page-header";
import { LibraryTabs } from "@/components/library/library-tabs";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        title="Library"
        description="The engine's evidence base — every forecast is compared against what lives here."
      />
      <LibraryTabs />
      {children}
    </div>
  );
}
