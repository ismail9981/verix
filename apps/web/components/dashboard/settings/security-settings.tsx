import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { ProfileSection } from "../business-profile/profile-section";
import { PlusIcon } from "../icons";
import { Badge } from "../ui/badge";
import { KeyIcon, MonitorIcon } from "./icons";
import { API_KEYS, SESSIONS } from "./mock-data";
import { ToggleRow } from "./toggle-row";

function Subheading({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-white">{children}</h3>
      {action}
    </div>
  );
}

export function SecuritySettings() {
  return (
    <ProfileSection
      id="security"
      title="Security"
      description="Protect your account and manage access to your workspace."
    >
      <div className="flex flex-col divide-y divide-hairline">
        {/* Two-factor authentication */}
        <ToggleRow
          label="Two-factor authentication"
          description="Require a verification code in addition to your password."
          defaultChecked
        />

        {/* Active sessions */}
        <div className="flex flex-col gap-3 py-5">
          <Subheading>Active sessions</Subheading>
          <ul className="flex flex-col gap-2">
            {SESSIONS.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas/40 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <MonitorIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">
                    <span className="truncate">{session.device}</span>
                    {session.current ? <Badge tone="success">Current</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {session.location} · {session.lastActive}
                  </p>
                </div>
                {!session.current ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Change password */}
        <div className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-white">Password</p>
            <p className="mt-0.5 text-sm text-muted">Last changed 3 months ago.</p>
          </div>
          <Button type="button" size="sm" className={CTA_SECONDARY}>
            Change password
          </Button>
        </div>

        {/* API keys */}
        <div className="flex flex-col gap-3 py-5 last:pb-0">
          <Subheading
            action={
              <Button
                type="button"
                size="sm"
                className={CTA_SECONDARY}
                leftIcon={<PlusIcon className="h-4 w-4" />}
              >
                Create key
              </Button>
            }
          >
            API keys
          </Subheading>
          <ul className="flex flex-col gap-2">
            {API_KEYS.map((key) => (
              <li
                key={key.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas/40 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <KeyIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{key.name}</p>
                  <p className="truncate font-mono text-xs text-muted">{key.masked}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted sm:block">
                  {key.created}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProfileSection>
  );
}
