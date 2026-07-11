"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { SectionCard } from "../home/section-card";
import { Badge } from "../ui/badge";
import { FieldInput } from "../business-profile/field-input";
import {
  publishSiteAction,
  rollbackSiteAction,
  unpublishSiteAction,
} from "../../../src/server/actions/website";
import { formatDate, siteStatusLabel, siteStatusTone } from "./website-format";
import type {
  SiteListItem,
  SiteVersionListItem,
} from "../../../src/server/validators/website";
import type { Notify } from "./types";

/*
 * Publish controls for the selected site: publish a new immutable version,
 * unpublish, open the draft preview / live site, and roll back to any prior
 * version. All mutations go through the workspace-scoped server actions; the
 * manager owns the single toast.
 */

interface SitePublishPanelProps {
  site: SiteListItem;
  versions: SiteVersionListItem[];
  onNotify: Notify;
}

export function SitePublishPanel({
  site,
  versions,
  onNotify,
}: SitePublishPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const isPublished = site.status === "published";
  const previewHref = `/website-builder/preview/${site.id}`;
  const liveHref = `/site/${site.id}`;

  function run(action: () => Promise<{ status: string; message: string }>) {
    startTransition(async () => {
      const result = await action();
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", label);
      const result = await publishSiteAction(site.id, formData);
      if (result.status === "success") setLabel("");
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  return (
    <SectionCard
      id="publish"
      title={`Publish · ${site.name}`}
      action={
        <Badge tone={siteStatusTone(site.status)}>
          {siteStatusLabel(site.status)}
        </Badge>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <FieldInput
              label="Version label (optional)"
              name="label"
              value={label}
              placeholder="e.g. Spring launch"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className={CTA_PRIMARY}
            loading={isPending}
            onClick={handlePublish}
          >
            Publish
          </Button>
          {isPublished ? (
            <Button
              type="button"
              className={CTA_SECONDARY}
              onClick={() => run(() => unpublishSiteAction(site.id))}
            >
              Unpublish
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            Open draft preview ↗
          </a>
          {isPublished ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              View live site ↗
            </a>
          ) : null}
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-muted">
            No versions yet. Publishing compiles the current draft into an
            immutable version.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <caption className="sr-only">Published versions</caption>
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">
                    Published
                  </th>
                  <th className="px-4 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-white">
                      v{v.versionNumber}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      <span className="flex items-center gap-2">
                        {v.label ?? "—"}
                        {v.isLive ? <Badge tone="success">Live</Badge> : null}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2 text-muted sm:table-cell">
                      {formatDate(v.publishedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {v.isLive ? null : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            run(() => rollbackSiteAction(site.id, v.id))
                          }
                          className="text-accent underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Roll back
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
