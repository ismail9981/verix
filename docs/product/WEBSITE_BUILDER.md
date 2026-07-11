# Verix Website Builder — Technical Design

> Architecture & planning document. **No implementation.** Design of a
> production-ready, multi-tenant Website Builder that lets each Verix workspace
> build, version, and publish a public marketing + booking website served on a
> subdomain today and custom domains later.

---

## 1. Goals, constraints, and reuse

**Product goal.** Every workspace (tenant) can compose a public website from
reusable sections + templates, edit it as a **draft**, **publish** immutable
**versions**, and serve it SEO/SSR-first on `{slug}.verix.app` (and custom
domains later).

**Reuse of existing platform (no new parallel systems):**

| Existing asset | How the Builder reuses it |
|---|---|
| `workspaces` (business profile) | Tenant root + site defaults: name, logo, cover, contact, timezone, currency, language, accent color → seeds theme, header/footer, SEO `LocalBusiness` JSON-LD. |
| `services` | `services-grid` / `pricing` / `booking-cta` sections reference services by id; deep-link into the booking flow. |
| `files` (Supabase Storage) | All media (logo, favicon, OG image, gallery) via the existing files table + storage; sections reference `fileId`. |
| Auth + `getAuthorizedWorkspace()` | Editor actions derive the workspace server-side; never trust the client. |
| RLS (workspace-membership policies) | Every builder table is workspace-scoped and RLS-guarded, exactly like CRM/Bookings/etc. |
| `proxy.ts` middleware | Extended to resolve public host → site and rewrite to the render route. |
| Observability (logger, request-id, rate-limit) | Publish + domain verification are logged/limited. |

**Non-negotiable constraints:** multi-tenant isolation, SEO-friendly, SSR-first,
Next.js App Router, subdomains now / custom domains later, versionable,
draft+published with a publish workflow, reusable templates & sections, dynamic
routing, theme system, DnD-ready, image management, localization.

---

## 2. Core model: normalized draft + published snapshot

The single most important decision. Three candidate patterns:

| Pattern | Editing | Rendering | Verdict |
|---|---|---|---|
| **A. Pure normalized** (pages/sections rows; draft/published flags per row) | Great | N+1 joins per request; a deleted service breaks a live page | Rejected: slow + fragile public reads |
| **B. Pure snapshot** (everything is JSON blobs) | Poor (hard to query/reorder/reference) | Great | Rejected: bad editor/DnD/integrity |
| **C. Hybrid (chosen): normalized draft → compiled published snapshot** | Great | Great | ✅ |

**Chosen (C):**
- **Draft = normalized rows** (`pages`, `page_sections`) — ideal for the editor,
  fractional-index reordering (DnD-ready), partial updates, and real references
  to `services`/`files`.
- **Publish compiles** the draft into an **immutable, denormalized JSON
  snapshot** (`site_versions.snapshot`) with all references *resolved and frozen*
  (service → {name, price, duration}, file → {cdnUrl, variants, alt, w/h}).
- **Public rendering reads only the published snapshot** — one row, zero joins,
  fully cacheable, and **resilient**: deleting a service later cannot break an
  already-published page.

**Tradeoff:** a compile step on publish, and *frozen* content can drift from the
live catalog until re-publish. Mitigated by **per-section `dataMode`** (§6):
marketing copy is `static` (frozen); volatile data (booking availability, "live
services") is `live` (fetched fresh inside a cached shell).

---

## 3. Database schema (conceptual)

All tables carry `workspace_id` (tenant scope), `created_at/updated_at`, and
(where editable) `deleted_at` soft delete, consistent with the rest of Verix.
Types are described, not DDL.

### `sites` — one publishable site (1 per workspace in v1; model allows N)
- `id` (uuid pk), `workspace_id` (fk→workspaces, cascade), `name`
- `default_locale` (text, e.g. `en-us`), `supported_locales` (text[])
- `theme_id` (fk→site_themes, nullable) **or** inline `theme_tokens` (jsonb)
- `status` (enum: `draft` | `published` | `unpublished`)
- `published_version_id` (fk→site_versions, nullable) — the live pointer
- `seo_defaults` (jsonb: title template, description, og fileId, robots)
- `favicon_file_id`, `social_image_file_id` (fk→files)
- unique(`workspace_id`) for v1 (drop later for multi-site)

### `site_domains` — subdomains + custom domains (the routing key)
- `id`, `site_id` (fk), `workspace_id` (fk)
- `hostname` (citext, **globally unique**) — e.g. `bloomstudio.verix.app` or `www.bloom.com`
- `kind` (enum: `subdomain` | `custom`)
- `status` (enum: `pending` | `verifying` | `active` | `error`)
- `verification_token`, `ssl_status`, `is_primary` (bool)
- index(`hostname`) — hot path for host resolution

### `pages` — a page in the draft working set
- `id`, `site_id` (fk), `workspace_id` (fk)
- `path` (text, `""` = home, `about`, `services/haircuts`), `locale` (text)
- `title`, `seo` (jsonb: title, description, og fileId, noindex, canonical)
- `status` (enum: `draft` | `ready`), `position` (int, for nav ordering)
- unique(`site_id`, `path`, `locale`)

### `page_sections` — ordered, editable content blocks
- `id`, `page_id` (fk), `site_id` (fk), `workspace_id` (fk)
- `type_key` (text, registry key: `hero`, `services-grid`, …)
- `type_version` (int) — schema version of that section type
- `position` (numeric/fractional index — O(1) reorder for DnD)
- `props` (jsonb — validated per type by a Zod schema in the registry)
- `locale` (text), `is_visible` (bool)

### `site_versions` — immutable published/draft snapshots (versioning)
- `id`, `site_id` (fk), `workspace_id` (fk)
- `version_number` (int, monotonic per site)
- `status` (enum: `published` | `superseded` | `archived`)
- `label` (text, e.g. "Spring launch"), `created_by` (fk→users)
- `snapshot` (jsonb — full denormalized site: theme + pages[] + resolved sections + assets)
- `published_at`
- unique(`site_id`, `version_number`)

### `site_themes` — reusable theme token sets
- `id`, `workspace_id` (fk, **nullable** → system/global themes), `name`
- `tokens` (jsonb: color roles, typography scale, spacing, radii, shadows)
- `is_system` (bool), `preview_file_id`

### `site_templates` — starter blueprints (system + saved custom)
- `id`, `workspace_id` (nullable → system templates), `name`, `category` (industry)
- `definition` (jsonb — pages/sections blueprint), `preview_file_id`, `is_system`

### `page_section_refs` — dependency tracking (integrity + invalidation)
- `id`, `section_id` (fk→page_sections, cascade), `site_id`, `workspace_id`
- `ref_type` (enum: `service` | `file` | `page`), `ref_id` (uuid)
- Purpose: publish-time integrity validation, and cache invalidation when a
  referenced entity changes (for `live` sections). Kept in sync when props save.

**Section *types* are code-defined** (a registry in `src/website/sections/`),
**not** a table — see §6 for the tradeoff.

---

## 4. Relationships

```
workspace 1─1 site (v1; 1─N later)
site      1─N pages          1─N page_sections
site      1─N site_domains   (1 primary)
site      1─N site_versions  (site.published_version_id → one)
site      N─1 site_theme
page_section N─N services|files   (via jsonb props + page_section_refs)
site_template ──seeds──▶ pages + page_sections
```

- **Hard FKs** for structural ownership (site→pages→sections, site→versions,
  site→domains) → cascade delete, referential integrity, RLS scoping.
- **Soft references** (section → service/file) live inside `props` (jsonb) and
  are mirrored into `page_section_refs`. **Tradeoff:** jsonb gives schema
  flexibility as section types evolve (no migration per new field) at the cost
  of DB-level FK integrity; we recover integrity via **publish-time validation**
  + the refs table, and rendering never depends on the live row (snapshot froze
  it). Deleting a service flags affected draft sections but cannot break a
  published page.

---

## 5. Rendering pipeline (public site, SSR-first)

### Host resolution → dynamic routing
1. **Middleware (`proxy.ts`)** reads the `Host` header on every request.
   - App host (`app.verix.app`) → dashboard as today.
   - Any other host → look up `site_domains.hostname` (cached, §10) → get
     `{ siteId, publishedVersionId, defaultLocale }`; **rewrite** to the internal
     route `app/_site/[[...path]]` and pass `siteId`/host via request headers.
   - Unknown host → 404 "site not found".
2. **Public route** `app/_site/[[...path]]/page.tsx` (catch-all):
   - Reads `siteId` + path + locale (from headers / path prefix / domain-locale map).
   - Loads the **published snapshot** for `publishedVersionId` (single cached read).
   - Selects the page matching `path` + `locale` (fallback to `defaultLocale`; 404 if none).
   - Renders sections through the **SectionRenderer** (registry), wrapped in a
     `ThemeProvider` that injects theme tokens as CSS variables.
   - `generateMetadata()` builds title/description/canonical/OG + JSON-LD
     (`LocalBusiness`, `Service`, `BreadcrumbList`) from page SEO + business profile.

### SSR + SEO specifics
- Sections are **React Server Components** → full HTML at request time, crawlable,
  fast FCP. Interactivity (booking widget, contact form, carousels) ships as
  **client islands** hydrated selectively.
- Route handlers: `app/_site/sitemap.xml` (from published pages, paginated for
  large sites), `app/_site/robots.txt`, `app/_site/opengraph-image`.
- **Partial Prerendering (PPR):** static shell (marketing sections) prerendered;
  `live` islands stream at request time → SEO + freshness together.

### Draft preview (parity)
- Authenticated `website-builder/preview` renders the **draft** (normalized
  rows) using the **same registry components**, so preview ≡ published. Sharable
  via a **signed, expiring token** route (no auth leak) for stakeholders.

---

## 6. Component architecture — the Section Registry

The backbone that delivers *reuse*, *type safety*, and *DnD-readiness*.

**A section type is a code module** exporting a typed definition:
- `key` (`"hero"`) + `version` (schema version)
- `Component` — an RSC taking **resolved, typed props** + theme → HTML
- `schema` — a **Zod** schema for `props` (validation + editor-form generation)
- `editor` — field descriptors (or derived from schema) for the props panel
- `defaultProps`, `category`, `icon`, `preview`
- `dataMode`: `"static"` (use frozen snapshot) | `"live"` (fetch fresh, cached)

**`SectionRenderer`**: `(key, version, props) → registry lookup → validate →
render inside an error boundary`. Unknown/removed keys or invalid props render a
**graceful fallback**, never a white screen — critical because published
snapshots may reference section versions that later change.

**Why a code registry, not a DB `section_types` table:**
- ✅ End-to-end type safety, tree-shaking, versioning tied to deploys, best DX,
  no runtime component eval (no RCE surface).
- ❌ Adding a section type needs a deploy (no "no-code" new blocks).
- **Tradeoff accepted;** future path: a DB `section_registry` for *metadata /
  feature-flags / A-B* over code-defined components (hybrid), never for shipping
  executable code.

**Editing & DnD:** because a page is *data* (`{key, version, props}[]` ordered by
a fractional index) over a registry, the editor is list manipulation + a
schema-driven props panel. **Drag-and-drop is future work but requires no schema
change** — reorder = update `position`; add = insert registry default; the
architecture is DnD-ready today.

**Theme system:** themes are token sets (`site_themes.tokens`) surfaced as CSS
custom properties by `ThemeProvider`; sections consume tokens (never hard-coded
colors), so switching themes needs **no section changes and no recompile**.
Seeded from `workspaces.accentColor` + brand palette.

---

## 7. Publishing pipeline

1. **Edit** — editor autosaves draft rows; optimistic UI; optimistic-lock
   (`updated_at`/version counter) to detect concurrent edits.
2. **Publish** (server action, workspace-derived, rate-limited):
   1. **Validate** — every section's `props` against its Zod schema; every ref
      in `page_section_refs` (service/file exists + belongs to workspace); SEO &
      broken-link checks. Fail fast with actionable errors.
   2. **Compile** — resolve refs, embed theme tokens + responsive image variants,
      build the denormalized page/section tree → the **snapshot JSON**.
   3. **Persist** — insert `site_versions` (`version_number = max+1`, `published`).
   4. **Flip** (transaction) — `sites.published_version_id = new.id`,
      `status = published`, mark prior version `superseded`.
   5. **Invalidate** — `revalidateTag("site:{siteId}")` (+ per-host tags); ISR
      revalidate; optional cache warm of key pages.
   6. **Observe** — structured log with request-id; emit `site.published` event.
3. **Rollback** — repoint `published_version_id` to any prior version +
   revalidate. **Instant, no recompile** (versions are immutable).
4. **Unpublish** — `status = unpublished` → public route serves 404 /
   "coming soon"; versions retained.
5. **Draft history** — optional periodic draft snapshots for autosave/restore
   (pruned by retention).

**Why immutable versions:** trivial rollback, auditability, safe caching keyed by
`version_id`, and future version **diffing/scheduling**. **Tradeoff:** snapshot
storage grows with publishes → retention/pruning + archive to cold storage.

---

## 8. Storage strategy

| Data | Store | Rationale |
|---|---|---|
| Pages, sections, versions, themes, templates | **Postgres (Supabase) `jsonb`** | Transactional, RLS-scoped, relational to workspace/services/files; `jsonb` lets section schemas evolve without migrations. |
| Media (logo, favicon, OG, gallery) | **Supabase Storage** (S3-compatible), tracked in `files` | Reuse existing upload pipeline; CDN-served; public bucket for site assets, signed URLs for private. |
| Published snapshot | Postgres row (cached) → **optionally materialized to Edge Config/object storage** later | Single-row read is enough now; edge-materialization removes DB from the public hot path at scale. |

**Image management:** upload → `files` row → generate **responsive variants**
(AVIF/WebP, sizes) via Supabase image transforms or a transform step; sections
store `fileId`; publish resolves to `{cdnUrl, srcset, width, height, alt}` so the
renderer emits correct `<img>`/`next/image` with no CLS. External image URLs are
validated/proxied (anti-SSRF).

---

## 9. Folder structure (App Router)

```
app/
  (dashboard)/website-builder/        # authenticated editor (workspace-scoped)
    page.tsx  editor/  preview/  domains/  publish-dialog/
  _site/                              # PUBLIC multi-tenant render (host-resolved)
    [[...path]]/page.tsx              # catch-all renderer (reads snapshot)
    sitemap.xml/  robots.txt/  opengraph-image/
  api/website/                        # domain verify webhooks, publish hooks
src/server/website/                   # server layer (mirrors existing modules)
  validators/  services/             #   site/page/section/publish/domain services
  actions/                           #   server actions (getAuthorizedWorkspace)
  snapshot/                          #   compiler + snapshot types
src/website/
  sections/                          # SECTION REGISTRY (hero/, services-grid/, …)
  themes/                            # token definitions + CSS-var mapping
  render/                            # SectionRenderer, ThemeProvider, types
components/dashboard/website-builder/ # editor UI (canvas, section list, props panel,
                                      #   template picker, domain settings)
proxy.ts                             # host resolution + rewrite (extended)
```

Mirrors the established `validators → services → actions → client manager`
architecture used by every other Verix module.

---

## 10. Caching (layered)

1. **Host → site resolution** (runs every public request): cache the
   `hostname → {siteId, publishedVersionId}` map. Start with a short-TTL
   in-memory/`unstable_cache`; graduate to **Vercel Edge Config** (§13) to remove
   the DB from the hot path. Invalidate on domain/publish change.
2. **Published snapshot**: Next Data Cache tagged `site:{siteId}` /
   `siteversion:{id}`. Invalidate on publish/rollback/unpublish.
3. **Full-page ISR / CDN**: public pages cached at CDN, keyed by `host + path +
   locale`, tag-revalidated on publish.
4. **`live` sections**: excluded from the page cache or short `revalidate`
   (e.g. 60s), or streamed via PPR inside a cached static shell.

**Invalidation triggers:** publish, rollback, unpublish, domain change, theme
change → `revalidateTag`. A referenced service/file change invalidates only
sites with **`live`** sections that reference it (via `page_section_refs`);
`static` snapshots stay cached until re-publish — the intended behavior.

---

## 11. Security

- **Tenant isolation:** all builder tables `workspace_id`-scoped + **RLS**
  (workspace membership) like the rest of Verix; every editor action uses
  `getAuthorizedWorkspace()` — the client never supplies a workspace/site id it
  doesn't own.
- **Public read boundary:** the public renderer is unauthenticated but reads
  **only** the resolved host's `published_version_id` snapshot. Host→site is the
  trust boundary; snapshots are self-contained, so there's no join path to leak
  another tenant's data.
- **Host-header spoofing:** only serve hostnames present + `active` in
  `site_domains`; unknown hosts 404.
- **Custom domains:** DNS ownership verification (TXT/CNAME) *before* serving
  (prevents domain takeover); automated SSL; per-domain status machine.
- **XSS:** sections render structured props via React (auto-escaped). The one
  rich-text section sanitizes HTML **server-side** against an allowlist; no raw
  `dangerouslySetInnerHTML` elsewhere. Per-site CSP headers.
- **Uploads:** mime/size validation, dedicated asset domain (cookie isolation),
  signed URLs for private assets, future AV scan.
- **Abuse:** rate-limit publish + domain verification; signed, expiring preview
  tokens; plan-based quotas (pages, assets, bandwidth).

---

## 12. Performance

- **Zero-join public render** — denormalized snapshot → constant-time page build.
- **RSC + islands** — minimal client JS; only interactive sections hydrate.
- **Edge rendering** of public routes (global low latency) reading cached
  snapshots; **PPR** for static-shell + live-island pages.
- **Images** — responsive AVIF/WebP, explicit dimensions (no CLS), lazy except
  hero (`priority`), CDN-served.
- **Fractional indexing** for section order — O(1) reorder without rewriting rows.
- **Streaming SSR** for perceived speed on content-heavy pages.

---

## 13. Deployment strategy

- **Single Next.js app** serves both the dashboard (`app.verix.app`) and all
  public sites (`*.verix.app` + custom domains). Host-based routing in the proxy.
  - ✅ Shared code/registry, one deploy, simplest ops.
  - Alternative **multi-zone** (separate public deployment) for blast-radius
    isolation and independent scaling — a future option if traffic profiles
    diverge. **Tradeoff:** isolation/scaling vs. added ops + shared-code plumbing.
- **DNS/TLS:** wildcard `*.verix.app` (wildcard cert) for subdomains; custom
  domains onboarded via the platform **Domains API** (add → verify → auto-SSL).
- **Host map in Edge Config:** publish writes `hostname → {siteId, versionId}` to
  edge config so the middleware resolves hosts **without a DB round-trip**.
- **DB:** Supabase Postgres with the existing pooled client; **read replicas**
  for public-read scaling later.
- **Publish compilation:** synchronous for typical sites; move to an **async job
  queue** (QStash/Supabase queue) with progress + cache-warm when snapshots grow
  or need pre-warming.
- **CDN** for assets and cached pages; tag-based purge on publish.

---

## 14. Localization

- **Locale-scoped pages/sections** (`locale` column; unique `(site,path,locale)`);
  site has `default_locale` + `supported_locales`.
- Routing by **path prefix** (`/es/about`) or **domain/subdomain per locale**;
  missing translation **falls back** to default locale.
- Snapshot holds per-locale content; SEO emits `hreflang` alternates + localized
  sitemaps.
- **Tradeoff:** per-locale rows duplicate structure (simple, fast SSR) vs. a
  normalized translation layer (less duplication, more join complexity). Chosen:
  locale-scoped rows now; revisit a translation layer if locale × page counts
  explode (§15).

---

## 15. Future scalability concerns & tradeoffs

- **Snapshot growth** (big sites/many publishes): snapshot **per page** instead of
  per site; lazy-load page snapshots; archive old versions to object storage;
  retention/pruning of draft history.
- **Host resolution at scale:** Edge Config map (done in §13) instead of per-request
  DB lookups; cache stampede protection.
- **Many custom domains:** Domains-API limits, cert lifecycle, per-domain isolation
  and monitoring.
- **Section-type evolution:** snapshots pin `type_key + type_version`; the renderer
  must support **multiple versions** or migrate-on-read; plan a section-migration
  strategy so old published sites keep rendering after a schema change.
- **Multi-site / agency / reseller:** drop the `unique(workspace_id)` on `sites`;
  the schema already supports N sites per workspace and nested ownership.
- **Localization explosion:** locale × pages row growth → move to a translation
  layer + fallback graph.
- **Real-time collaboration + DnD:** current optimistic-locking is single-editor;
  concurrent editing needs CRDT/OT and presence.
- **Global read scaling & cost:** edge caching + read replicas; **plan-based
  quotas** (pages, storage, bandwidth, image transforms) to contain
  noisy-neighbor cost.
- **SEO at scale:** paginated sitemaps, per-domain robots, structured-data
  coverage as section library grows.

---

## 16. Decision log (summary of tradeoffs)

| Decision | Chosen | Rejected alternative | Why |
|---|---|---|---|
| Content model | Normalized draft → compiled snapshot | Pure normalized / pure JSON | Editable *and* fast/resilient public reads |
| Section types | Code registry (typed) | DB-defined dynamic blocks | Type-safety, perf, no RCE; deploy-coupled acceptable |
| Section props | `jsonb` + Zod + refs table | Strong columns per field | Schema evolution without migrations; integrity recovered at publish |
| Versioning | Immutable published versions | Mutable in-place publish | Instant rollback, audit, cacheable, diffable |
| Hosting | Single app, host-routing | Multi-zone split | Simplicity now; multi-zone is a known future lever |
| Freshness | Per-section `static`/`live` | All-frozen or all-live | Balances performance/resilience vs. currency |
| Localization | Locale-scoped rows | Translation layer | Simplicity/SSR speed now; revisit at scale |
| Host lookup | Edge Config map | DB per request | Removes DB from the hot path |

---

## 17. Phased delivery (suggested, non-binding)

1. **Foundations:** `sites`, `pages`, `page_sections`, `site_versions`, host
   resolution, subdomain routing, 4–5 core sections, one theme, publish + render.
2. **Editor & templates:** schema-driven props panel, template picker, image
   management, preview/publish/rollback UI, SEO fields, sitemap/robots.
3. **Domains & scale:** custom domains + verification + SSL, Edge Config host map,
   caching/PPR, localization, `live` sections.
4. **Advanced:** drag-and-drop, section presets, version diffing/scheduling,
   async publish + cache warm, collaboration.
```
