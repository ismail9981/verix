"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { ReservationFormFields } from "./reservation-form-fields";
import { ProfileToast, type ToastState } from "../business-profile/profile-toast";
import { createReservationAction } from "../../../src/server/actions/reservation";
import type { FieldErrors } from "../../../src/server/actions/action-result";
import type { ReservationPersonOption } from "../../../src/server/validators/reservation";
import type { RentalUnitOption } from "../../../src/server/validators/rental-unit";

interface NewReservationFormProps {
  unitOptions: RentalUnitOption[];
  customerOptions: ReservationPersonOption[];
  staffOptions: ReservationPersonOption[];
  defaultCurrency: string;
}

export function NewReservationForm({
  unitOptions,
  customerOptions,
  staffOptions,
  defaultCurrency,
}: NewReservationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createReservationAction(formData);
      if (result.status === "success") {
        router.push("/reservations");
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  return (
    <>
      <SectionCard id="new-reservation" title="New reservation">
        <form onSubmit={handleSubmit}>
          <ReservationFormFields
            reservation={null}
            unitOptions={unitOptions}
            customerOptions={customerOptions}
            staffOptions={staffOptions}
            defaultCurrency={defaultCurrency}
            fieldErrors={fieldErrors}
          />

          <div className="mt-8 flex items-center justify-end gap-3">
            <Button type="button" className={CTA_SECONDARY} onClick={() => router.push("/reservations")}>
              Cancel
            </Button>
            <Button type="submit" className={CTA_PRIMARY} loading={isPending}>
              Create reservation
            </Button>
          </div>
        </form>
      </SectionCard>

      <ProfileToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
