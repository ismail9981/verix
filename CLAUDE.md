# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

Verix is an AI-first SaaS platform that helps businesses build, launch, and grow online (website builder + booking/CRM/payments for a workspace). Prioritize scalability, maintainability, accessibility, and developer experience.

## Repo layout

Turborepo + npm workspaces monorepo.

- `apps/web` — the actual product (Next.js 16, React 19). Almost all real logic lives here.
- `apps/docs` — a mostly-stock Next.js app from the turborepo starter template; not actively developed.
- `packages/ui` — shared React component library (`@repo/ui`).
- `packages/eslint-config`, `packages/typescript-config` — shared lint/tsconfig presets consumed via `@repo/eslint-config`, `@repo/typescript-config`.

## Commands

Run from repo root (Turborepo fans out to workspaces):

```sh
npm run dev            # turbo run dev (all apps)
npm run build          # turbo run build
npm run lint           # turbo run lint
npm run check-types    # turbo run check-types
npm run format         # prettier --write on **/*.{ts,tsx,md}
```

Scope to just `web` with a filter, e.g. `npx turbo run dev --filter=web`, or `cd apps/web` and use its scripts directly:

```sh
cd apps/web
npm run dev             # next dev --port 3000
npm run lint            # eslint --max-warnings 0
npm run check-types     # next typegen && tsc --noEmit
npm test                # vitest run (all tests)
npx vitest run src/website/render/snapshot.test.ts   # single test file
npx vitest run -t "some test name"                    # by test name
```

Database (Drizzle, from `apps/web`):

```sh
npm run db:generate     # SQL migrations from schema
npm run db:migrate      # apply migrations
npm run db:push         # push schema directly (dev)
npm run db:studio       # browse data
npm run db:seed         # tsx src/server/db/seed.ts
```

**Before completing any task**: run `check-types` and `lint` (scoped to `web` if only that app changed) and report what changed, why, which files were touched, and any follow-ups.

## CI

`.github/workflows/ci.yml` runs `turbo run check-types lint test build --filter=web` on push/PR, with placeholder env values (no real DB/Supabase contacted — public routes are dynamic, tests are pure). Keep new tests dependency-free (no real db/env) if they need to run in this suite; see `apps/web/vitest.config.ts`.

## Architecture (`apps/web`)

### Tenancy & auth

`workspaces` is the tenant root; nearly every DB row carries a `workspace_id` (cascade delete). A Supabase-authenticated user is linked to a `public.users` row by email and resolved to the workspace they own or are an active member of, provisioning a workspace on first sign-in — see `src/server/auth/workspace.ts` (`getAuthorizedWorkspace`). **Server Actions must derive the workspace from the session via this helper, never trust a client-supplied `workspaceId`.**

- `src/server/auth/session.ts` — Supabase session/user access.
- `src/server/auth/rbac.ts` — pure, dependency-free RBAC primitives (`assertOwnerRole`, `assertNotSelf`, `assertNotLastOwner`), unit-tested in `rbac.test.ts`.
- `src/server/auth/authorize.ts` — composes session + rbac (e.g. `requireOwner()`) for use in Server Actions.
- `src/server/auth/middleware.ts` — Supabase session refresh + route protection, invoked from root `proxy.ts` (Next 16's renamed middleware).
- `src/server/db/rls.sql` — Postgres Row Level Security policies backing tenant isolation at the DB layer.

`proxy.ts` (root) runs per-request: assigns/propagates an `x-request-id`, rate-limits auth-mutation POSTs (`src/server/observability/rate-limit.ts`), then refreshes the session and enforces route protection.

### Server Actions pattern

Feature logic is organized as `validators/<feature>.ts` (Zod schemas) → `services/<feature>.service.ts` (business logic, DB access) → `actions/<feature>.ts` (Server Actions, the only layer client components call). All Server Actions return the shared `FormActionResult` shape (`status`/`message`/`fieldErrors`) from `src/server/actions/action-result.ts`; use `zodFieldErrors()` to convert a `ZodError` into that shape.

Features follow this triad consistently: payment, website, workspace, customer, analytics, settings, team, booking, domain, service, auth.

### Database

Drizzle ORM + Postgres (`src/server/db/db.ts`, schema in `src/server/db/schema/`):
- `tables.ts` — all tables, declared so a table only references tables above it (acyclic FK graph); tenancy comment at the top explains the workspace-scoped model.
- `columns.ts` — reusable column helpers (`primaryId`, `timestamps`, `softDelete` — most tables soft-delete via a `deleted_at` column rather than hard-deleting).
- `enums.ts`, `relations.ts`, `index.ts` (barrel, the schema surface for the client and drizzle-kit).

`src/server/env.ts` validates all env vars (`DATABASE_URL`, `SUPABASE_*`) through Zod at import time and throws a readable error if anything's missing — see `apps/web/.env.example` for the full list. `drizzle.config.ts` reads the connection string through this same module.

### Website builder / renderer (`src/website/`)

The core product domain — building and rendering a customer's site — is split into independent, mostly-pure subsystems:

- `sections/` — a **registry** of section types (hero, about, services, contact). Each section is defined once (`sections/define.ts` + one file per section) and registered by key in `sections/registry.ts` (`getSection`/`hasSection`/`listSections`), avoiding switch statements over section type. Client-safe: no server-only imports, so editors can consume it directly.
- `templates/` — a similar registry for whole-site templates (`templates/registry.ts`, `templates/installer.ts` to apply one to a workspace, `templates/export-model.ts`/`template-preview-model.ts` for editor previews).
- `theme/` — design tokens and theme registry (`theme/tokens.ts`, `theme/registry.ts`, `theme/resolve.ts`, `theme/css-vars.ts`), plus a React `theme-provider.tsx`.
- `render/` — the **publishing pipeline**: turns a stored site + page + sections into a rendered snapshot. Key files: `snapshot.ts` (snapshot schema), `resolve-snapshot-section.ts` (version-aware section resolution), `site-metadata.ts`, `snapshot-renderer.tsx`, `section-error-boundary.tsx`/`section-fallback.tsx` for per-section render isolation. This is the part covered most heavily by `apps/web/vitest.config.ts`'s pure, dependency-free test suite.
- `builder/` — editor-side state for the drag/drop, in-progress editing experience (`editor-state.ts`, `position.ts`, `use-section-editor.ts`), backing the UI in `components/dashboard/website-builder/builder/`.

When adding a new section or template type, register it in the corresponding `registry.ts` rather than branching on type elsewhere — that's the pattern the rest of the codebase relies on.

### App Router structure (`app/`)

Route groups: `(auth)` (login/register/forgot/reset password), `(dashboard)` (the authenticated product surface: ai, analytics, bookings, business-profile, crm, dashboard, payments, settings, team, website-builder), `(public)/site/[siteId]` (public rendering of a published customer site), plus `auth/confirm` (Supabase auth callback). Components mirror this under `components/dashboard/<feature>/`.

## Architecture Rules

- Never duplicate code; prefer composition over inheritance; build reusable components; keep files focused on one responsibility.
- Never modify unrelated files.
- Reuse existing design tokens (`src/website/theme/`) and shared UI components (`@repo/ui`, `components/dashboard/ui/`).
- Keep strict TypeScript; keep accessibility in mind; use semantic HTML.

## UI Rules

- Mobile first, responsive by default.
- Consistent spacing and typography via design tokens.
