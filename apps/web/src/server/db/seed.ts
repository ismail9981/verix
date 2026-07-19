import { db } from "./db";
import { settings, users, workspaces } from "./schema";

/*
 * Minimal seed: inserts one demo user, workspace, and settings row so the
 * Business Profile feature has "the existing workspace" to load and edit.
 * Idempotent — does nothing if a workspace already exists.
 *
 * Run with: npm run db:seed --workspace web
 */
async function seed() {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) {
    console.log("A workspace already exists — skipping seed.");
    return;
  }

  const [user] = await db
    .insert(users)
    .values({
      email: "owner@bloomstudio.com",
      fullName: "Bloom Studio Owner",
      emailVerified: true,
    })
    .returning();

  const [workspace] = await db
    .insert(workspaces)
    .values({
      ownerId: user!.id,
      name: "Bloom Studio",
      slug: "bloom-studio",
      email: "hello@bloomstudio.com",
      phone: "+1 (415) 555-0142",
      website: "https://bloomstudio.com",
      timezone: "america-los_angeles",
      currency: "USD",
      language: "en-us",
    })
    .returning();

  await db.insert(settings).values({ workspaceId: workspace!.id });

  console.log(`Seeded workspace "${workspace!.name}" (${workspace!.slug}).`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
