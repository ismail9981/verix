import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";
import { DownloadIcon } from "./icons";

export function AnalyticsHeader() {
  return (
    <PageHeader
      title="Analytics"
      subtitle="Track revenue, bookings, and customer growth across your business."
      actions={
        <Button
          type="button"
          className={CTA_SECONDARY}
          leftIcon={<DownloadIcon className="h-4 w-4" />}
        >
          Export
        </Button>
      }
    />
  );
}
