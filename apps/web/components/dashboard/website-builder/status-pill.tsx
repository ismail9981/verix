import { Badge, type BadgeTone } from "../ui/badge";
import type { PageStatus } from "./types";

const TONES: Record<PageStatus, BadgeTone> = {
  Published: "success",
  Draft: "warning",
};

export function StatusPill({ status }: { status: PageStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
