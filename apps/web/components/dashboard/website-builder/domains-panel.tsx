"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { Badge, type BadgeTone } from "../ui/badge";
import { RowActionsMenu } from "../ui/row-actions";
import { PlusIcon } from "../icons";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  createDomainAction,
  deleteDomainAction,
  setPrimaryDomainAction,
} from "../../../src/server/actions/domain";
import {
  APP_DOMAIN,
  type DomainListItem,
  type DomainStatus,
  type DomainType,
} from "../../../src/server/validators/domain";
import type { Notify } from "./types";

const TYPE_OPTIONS = [
  { value: "subdomain", label: "Subdomain" },
  { value: "custom", label: "Custom domain" },
];

const STATUS_TONE: Record<DomainStatus, BadgeTone> = {
  active: "success",
  verified: "info",
  pending: "warning",
  failed: "danger",
};

const TH = "px-5 py-2.5 font-medium";
const CELL = "px-5 py-3";

interface DomainsPanelProps {
  siteId: string;
  siteName: string;
  domains: DomainListItem[];
  onNotify: Notify;
}

export function DomainsPanel({
  siteId,
  siteName,
  domains,
  onNotify,
}: DomainsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<DomainType>("subdomain");
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("siteId", siteId);
    formData.set("type", type);
    formData.set("value", value);
    startTransition(async () => {
      const result = await createDomainAction(formData);
      if (result.status === "success") {
        setValue("");
        setFieldError(undefined);
      } else {
        setFieldError(result.fieldErrors?.value?.[0]);
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleSetPrimary(domain: DomainListItem) {
    startTransition(async () => {
      const result = await setPrimaryDomainAction(siteId, domain.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleRemove(domain: DomainListItem) {
    startTransition(async () => {
      const result = await deleteDomainAction(domain.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  return (
    <SectionCard id="domains" title={`Domains · ${siteName}`} bodyClassName="p-0">
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 border-b border-hairline p-5"
      >
        <div className="w-40">
          <FieldSelect
            label="Type"
            name="type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value as DomainType)}
          />
        </div>
        <div className="min-w-56 flex-1">
          <FieldInput
            label={type === "subdomain" ? "Subdomain" : "Custom domain"}
            name="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "subdomain" ? "my-site" : "example.com"}
            error={fieldError}
          />
          <p className="mt-1 text-xs text-muted">
            {type === "subdomain"
              ? `Will be added as ${value ? value : "<name>"}.${APP_DOMAIN}`
              : "Enter a domain you own. Verification comes later."}
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          className={CTA_SECONDARY}
          loading={isPending}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add domain
        </Button>
      </form>

      {domains.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          No domains yet. Add a subdomain or connect a custom domain.
        </p>
      ) : (
        <div
          aria-busy={isPending}
          className={`transition-opacity ${isPending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Domains</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>Hostname</th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>Type</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr
                  key={domain.id}
                  className="border-b border-hairline last:border-0"
                >
                  <td className={`${CELL} font-medium text-white`}>
                    <span className="flex items-center gap-2">
                      {domain.hostname}
                      {domain.isPrimary ? (
                        <Badge tone="accent">Primary</Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${CELL} hidden text-muted sm:table-cell`}>
                    {domain.type === "subdomain" ? "Subdomain" : "Custom"}
                  </td>
                  <td className={CELL}>
                    <Badge tone={STATUS_TONE[domain.status]}>
                      {domain.status}
                    </Badge>
                  </td>
                  <td className={`${CELL} text-right`}>
                    <div className="flex justify-end">
                      <RowActionsMenu
                        label={`Actions for ${domain.hostname}`}
                        actions={[
                          ...(domain.isPrimary
                            ? []
                            : [
                                {
                                  label: "Set as primary",
                                  onSelect: () => handleSetPrimary(domain),
                                },
                              ]),
                          {
                            label: "Remove",
                            danger: true,
                            onSelect: () => handleRemove(domain),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
