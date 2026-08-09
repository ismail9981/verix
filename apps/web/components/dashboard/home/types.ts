import type { IconComponent } from "../types";

export type InsightKind = "suggestion" | "marketing" | "alert";

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  description: string;
}

export interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: IconComponent;
}
