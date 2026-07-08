"use client";

import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../landing/cta-styles";
import { GitHubIcon } from "../landing/icons";
import { GoogleIcon } from "./icons";

/* Social login placeholders. Rendered as real, focusable buttons for the
   premium look; the OAuth handlers are wired up in a later sprint. */
export function SocialButtons() {
  const handlePlaceholder = () => {
    // Intentionally a no-op until OAuth is implemented.
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        type="button"
        className={CTA_SECONDARY}
        leftIcon={<GoogleIcon className="h-4 w-4" />}
        onClick={handlePlaceholder}
      >
        Google
      </Button>
      <Button
        type="button"
        className={CTA_SECONDARY}
        leftIcon={<GitHubIcon className="h-4 w-4" />}
        onClick={handlePlaceholder}
      >
        GitHub
      </Button>
    </div>
  );
}
