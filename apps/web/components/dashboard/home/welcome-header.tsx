"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { UserPlusIcon } from "./icons";
import { BUSINESS_NAME, USER_FIRST_NAME } from "./mock-data";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* Time-aware welcome header. The greeting and date depend on the viewer's
   clock, so they are computed after mount (state starts null and renders
   identically on server + first client paint, avoiding hydration mismatch). */
export function WelcomeHeader() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting = now ? greetingFor(now.getHours()) : "Welcome back";
  const dateLabel = now
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(now)
    : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {greeting}, {USER_FIRST_NAME}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here&apos;s what&apos;s happening at {BUSINESS_NAME}
          {dateLabel ? ` · ${dateLabel}` : ""}.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/crm">
          <Button className={CTA_SECONDARY} leftIcon={<UserPlusIcon className="h-4 w-4" />}>
            Add customer
          </Button>
        </Link>
        <Link href="/bookings">
          <Button className={CTA_PRIMARY} leftIcon={<PlusIcon className="h-4 w-4" />}>
            New booking
          </Button>
        </Link>
      </div>
    </div>
  );
}
