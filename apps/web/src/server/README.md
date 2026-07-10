# Server (backend architecture)

Phase 2 infrastructure. No features, CRUD, API routes, or auth flows yet —
only the wiring the rest of the backend will build on.

## Layout

```
src/server/
  env.ts            Validated environment access (dotenv + Zod)
  db/
    db.ts           Drizzle client (postgres.js pool)
    schema/
      columns.ts    Reusable column helpers (id, timestamps, soft delete)
      enums.ts      Postgres enum types
      tables.ts     14 tables + inferred row types
      relations.ts  Drizzle relations (relational query API)
      index.ts      Barrel — schema surface for the client & drizzle-kit
  lib/
    supabase.ts     Server-side Supabase client (service role)
  auth/             (empty) auth helpers — later phase
  api/              (empty) route handlers / RPC — later phase
  services/         (empty) business logic — later phase
  validators/       (empty) Zod request/response schemas — later phase
```

## Environment

Copy `.env.example` → `.env` and fill in the values. `src/server/env.ts`
parses and validates them once at import and throws a readable error if any
are missing.

## Database scripts (Drizzle Kit)

```
npm run db:generate --workspace web   # SQL migrations from schema
npm run db:migrate  --workspace web   # apply migrations
npm run db:push     --workspace web   # push schema (dev)
npm run db:studio   --workspace web   # browse data
```
