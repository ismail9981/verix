"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { ProfileSection } from "../business-profile/profile-section";
import { Badge } from "../ui/badge";
import { INTEGRATIONS } from "./mock-data";
import type { Integration } from "./types";

function IntegrationRow({ integration }: { integration: Integration }) {
  const { icon: Icon } = integration;
  const [connected, setConnected] = useState(integration.connected);

  return (
    <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <span className="truncate">{integration.name}</span>
          <Badge tone={connected ? "success" : "neutral"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </p>
        <p className="truncate text-xs text-muted">{integration.description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className={CTA_SECONDARY}
        onClick={() => setConnected((value) => !value)}
      >
        {connected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}

export function IntegrationsSettings() {
  return (
    <ProfileSection
      id="integrations"
      title="Integrations"
      description="Connect the tools your business already uses."
    >
      <div className="flex flex-col divide-y divide-hairline">
        {INTEGRATIONS.map((integration) => (
          <IntegrationRow key={integration.id} integration={integration} />
        ))}
      </div>
    </ProfileSection>
  );
}
