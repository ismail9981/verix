import type { ToastState } from "../business-profile/profile-toast";

/** Raise a toast from a child panel; the manager owns the single toast. */
export type Notify = (tone: ToastState["tone"], message: string) => void;

export type {
  SiteListItem,
  PageListItem,
  PageSectionListItem,
} from "../../../src/server/validators/website";
