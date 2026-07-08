import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";

export function BookingHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Bookings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage appointments, staff, and customer schedules.
        </p>
      </div>
      <Button
        type="button"
        className={CTA_PRIMARY}
        leftIcon={<PlusIcon className="h-4 w-4" />}
      >
        New booking
      </Button>
    </div>
  );
}
