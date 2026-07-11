import "server-only";
import { listServices } from "../../server/services/service.service";
import { buildServicesData } from "../sections/services/data";
import type { SectionContext } from "./types";
import type { ServicesProps } from "../sections/services";

/*
 * Server-only live-data resolvers, keyed by section key (registry-style, no
 * switch). The `server-only` guard keeps this (and the DB layer) out of any
 * client bundle — the snapshot compiler (`website-snapshot.ts`) is the sole
 * importer. Returns `undefined` for sections that render purely from props.
 */

type Resolver = (props: unknown, ctx: SectionContext) => Promise<unknown>;

const RESOLVERS: Record<string, Resolver> = {
  services: async (props, ctx) => {
    const { limit } = props as ServicesProps;
    const services = await listServices(ctx.workspaceId, { status: "active" });
    return buildServicesData(services, limit);
  },
};

export async function resolveSectionData(
  key: string,
  props: unknown,
  ctx: SectionContext,
): Promise<unknown> {
  const resolver = RESOLVERS[key];
  return resolver ? resolver(props, ctx) : undefined;
}
