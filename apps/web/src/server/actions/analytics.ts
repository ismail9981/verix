"use server";

import { revalidatePath } from "next/cache";
import type { FormActionResult } from "./action-result";

/*
 * Server Action for the Analytics dashboard. The dashboard is read-only and
 * refreshes via the URL date filter (which re-renders the dynamic page), so the
 * only action is a manual refresh that busts the route cache.
 */

export async function refreshAnalyticsAction(): Promise<FormActionResult> {
  revalidatePath("/analytics");
  return { status: "success", message: "Analytics refreshed." };
}
