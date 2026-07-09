import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function BookingHeader() {
  return (
    <PageHeader
      title="Bookings"
      subtitle="Manage appointments, staff, and customer schedules."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          New booking
        </Button>
      }
    />
  );
}
