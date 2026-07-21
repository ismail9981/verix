import { and, asc, desc, eq, isNull, like, ne, sql } from "drizzle-orm";
import { db } from "../db/db";
import type { Executor } from "../db/executor";
import {
  buildings,
  customers,
  invoiceLineItems,
  invoices,
  payments,
  properties,
  rentalUnits,
  reservations,
} from "../db/schema";
import { assertCanAccessInvoice, assertInvoiceActionAllowed } from "../auth/rbac";
import { resolveActorTeamMemberId } from "./reservation.service";
import { getWorkspaceLocale } from "./rental-unit.service";
import { workspaceTodayDate } from "../validators/reservation";
import {
  computeLineItemAmountCents,
  computeOutstandingCents,
  deriveInvoiceStatus,
  deriveReservationPaymentStatus,
  formatInvoiceNumber,
  invoiceNumberPrefix,
  isDueDateOnOrAfterIssuance,
  isIdempotentPaymentReplay,
  isValidLineItemAmountSign,
  nextInvoiceSuffix,
  resolveInvoiceScope,
  workspaceInvoiceYear,
  type InvoiceDetail,
  type InvoiceLineItemDto,
  type InvoiceListItem,
  type IssueInvoiceInput,
  type LineItemInput,
  type PaymentDto,
  type PaymentType,
  type RecordPaymentInput,
  type VoidPaymentInput,
} from "../validators/invoice";
import type { PaymentMethodValue } from "../validators/payment";

/*
 * Invoice service — Sprint 14 Phase 2B. Covers invoice creation off a
 * reservation, read access, draft-only line-item CRUD, and issuance
 * (draft -> open, snapshot generation). Deliberately does NOT cover payment
 * recording, refunds, invoice/reservation balance synchronization, void, or
 * write-off — those are later phases layered on top of this file.
 *
 * Mirrors `reservation.service.ts`/`housekeeping.service.ts` exactly: every
 * query that may run inside a caller's transaction takes an `Executor`
 * (`db` or `tx`) explicitly rather than reaching for the module-level `db`,
 * and every business invariant already enforced at the database level
 * (line items draft-only, amount sign, reservation/currency/customer
 * consistency, non-negative total) is only ever given a friendly pre-check
 * here, never re-implemented as a second source of truth.
 */

export interface InvoiceActor {
  userId: string;
  role: string;
}

const LIST_COLUMNS = {
  id: invoices.id,
  workspaceId: invoices.workspaceId,
  reservationId: invoices.reservationId,
  customerId: invoices.customerId,
  customerName: customers.name,
  number: invoices.number,
  status: invoices.status,
  amountCents: invoices.amountCents,
  currency: invoices.currency,
  issuedAt: invoices.issuedAt,
  dueAt: invoices.dueAt,
  createdAt: invoices.createdAt,
};

const DETAIL_COLUMNS = {
  ...LIST_COLUMNS,
  customerNameSnapshot: invoices.customerNameSnapshot,
  customerEmailSnapshot: invoices.customerEmailSnapshot,
  propertyNameSnapshot: invoices.propertyNameSnapshot,
  buildingNameSnapshot: invoices.buildingNameSnapshot,
  unitNameSnapshot: invoices.unitNameSnapshot,
  checkInDateSnapshot: invoices.checkInDateSnapshot,
  checkOutDateSnapshot: invoices.checkOutDateSnapshot,
  notes: invoices.notes,
};

const LINE_ITEM_COLUMNS = {
  id: invoiceLineItems.id,
  type: invoiceLineItems.type,
  description: invoiceLineItems.description,
  quantity: invoiceLineItems.quantity,
  unitAmountCents: invoiceLineItems.unitAmountCents,
  amountCents: invoiceLineItems.amountCents,
  sortOrder: invoiceLineItems.sortOrder,
};

/** Every read joins the billed reservation's `staffId` — needed for the RBAC scope/access check, stripped back off before returning the public DTO. */
function listQuery(exec: Executor) {
  return exec
    .select({ ...LIST_COLUMNS, reservationStaffId: reservations.staffId })
    .from(invoices)
    .leftJoin(reservations, eq(reservations.id, invoices.reservationId))
    .leftJoin(customers, eq(customers.id, invoices.customerId));
}

function detailQuery(exec: Executor) {
  return exec
    .select({ ...DETAIL_COLUMNS, reservationStaffId: reservations.staffId })
    .from(invoices)
    .leftJoin(reservations, eq(reservations.id, invoices.reservationId))
    .leftJoin(customers, eq(customers.id, invoices.customerId));
}

type ListRow = Awaited<ReturnType<typeof listQuery>>[number];
type DetailRow = Awaited<ReturnType<typeof detailQuery>>[number];

function toListItem(row: ListRow): InvoiceListItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    reservationId: row.reservationId,
    customerId: row.customerId,
    customerName: row.customerName,
    number: row.number,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
  };
}

function toDetail(row: DetailRow, lineItems: InvoiceLineItemDto[], netPaidCents: number): InvoiceDetail {
  return {
    ...toListItem(row),
    customerNameSnapshot: row.customerNameSnapshot,
    customerEmailSnapshot: row.customerEmailSnapshot,
    propertyNameSnapshot: row.propertyNameSnapshot,
    buildingNameSnapshot: row.buildingNameSnapshot,
    unitNameSnapshot: row.unitNameSnapshot,
    checkInDateSnapshot: row.checkInDateSnapshot,
    checkOutDateSnapshot: row.checkOutDateSnapshot,
    notes: row.notes,
    lineItems,
    netPaidCents,
    outstandingCents: computeOutstandingCents(row.amountCents, netPaidCents),
  };
}

/**
 * The single source of truth for an invoice's net-paid balance — mirrors
 * `enforce_invoice_payment_integrity`'s own arithmetic exactly (`type='charge'`
 * minus `type='refund'`, not soft-deleted, `status='paid'`). Every read (the
 * `InvoiceDetail` DTO) and every write (`syncInvoiceAndReservationStatus`,
 * `recordPayment`'s overpayment pre-check) computes this the same one way —
 * never re-derived inline elsewhere.
 */
async function getInvoiceNetPaidCents(
  exec: Executor,
  workspaceId: string,
  invoiceId: string,
): Promise<number> {
  const rows = await exec
    .select({
      netPaidCents: sql<number>`coalesce(sum(case when ${payments.type} = 'charge' then ${payments.amountCents} else -${payments.amountCents} end), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.workspaceId, workspaceId),
        isNull(payments.deletedAt),
        eq(payments.status, "paid"),
      ),
    );
  return rows[0]?.netPaidCents ?? 0;
}

async function fetchDetailRow(exec: Executor, workspaceId: string, invoiceId: string): Promise<DetailRow> {
  const found = await detailQuery(exec).where(
    and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)),
  );
  const row = found[0];
  if (!row) throw new Error("Invoice not found.");
  return row;
}

async function fetchLineItems(exec: Executor, invoiceId: string): Promise<InvoiceLineItemDto[]> {
  return exec
    .select(LINE_ITEM_COLUMNS)
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceLineItems.sortOrder), asc(invoiceLineItems.createdAt));
}

/** Owner/manager bypass without a DB round-trip, mirroring `reservation.service.ts`'s `resolveScope`. */
async function resolveActorTeamMemberIdOrNull(
  exec: Executor,
  workspaceId: string,
  actor: InvoiceActor,
): Promise<string | null> {
  if (actor.role === "owner" || actor.role === "manager") return null;
  return resolveActorTeamMemberId(exec, workspaceId, actor.userId);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listInvoices(workspaceId: string, actor: InvoiceActor): Promise<InvoiceListItem[]> {
  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  const scope = resolveInvoiceScope(actor.role, actorTeamMemberId);
  if (scope.kind === "none") return [];

  const where = [eq(invoices.workspaceId, workspaceId)];
  if (scope.kind === "assigned") {
    where.push(eq(reservations.staffId, scope.teamMemberId));
  }

  const found = await listQuery(db)
    .where(and(...where))
    .orderBy(desc(invoices.createdAt));
  return found.map(toListItem);
}

export async function getInvoice(
  workspaceId: string,
  invoiceId: string,
  actor: InvoiceActor,
): Promise<InvoiceDetail> {
  const row = await fetchDetailRow(db, workspaceId, invoiceId);
  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  assertCanAccessInvoice({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedStaffId: row.reservationStaffId,
  });

  const [lineItems, netPaidCents] = await Promise.all([
    fetchLineItems(db, invoiceId),
    getInvoiceNetPaidCents(db, workspaceId, invoiceId),
  ]);
  return toDetail(row, lineItems, netPaidCents);
}

/**
 * Looks up the reservation's own `staffId` and enforces access *before*
 * checking whether an invoice exists, so an employee outside a reservation's
 * assignment can't distinguish "no invoice yet" from "not authorized" —
 * both simply throw the same `AuthorizationError`.
 */
export async function getReservationInvoice(
  workspaceId: string,
  reservationId: string,
  actor: InvoiceActor,
): Promise<InvoiceDetail | null> {
  const reservationRows = await db
    .select({ staffId: reservations.staffId })
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.workspaceId, workspaceId)));
  const reservationRow = reservationRows[0];
  if (!reservationRow) throw new Error("Reservation not found.");

  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  assertCanAccessInvoice({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedStaffId: reservationRow.staffId,
  });

  const found = await detailQuery(db).where(
    and(
      eq(invoices.reservationId, reservationId),
      eq(invoices.workspaceId, workspaceId),
      ne(invoices.status, "void"),
    ),
  );
  const row = found[0];
  if (!row) return null;

  const [lineItems, netPaidCents] = await Promise.all([
    fetchLineItems(db, row.id),
    getInvoiceNetPaidCents(db, workspaceId, row.id),
  ]);
  return toDetail(row, lineItems, netPaidCents);
}

// ---------------------------------------------------------------------------
// Invoice creation off a reservation
// ---------------------------------------------------------------------------

/**
 * Serializes invoice-number generation for one workspace/year behind a
 * transaction-scoped Postgres advisory lock (`pg_advisory_xact_lock` —
 * auto-released at COMMIT/ROLLBACK, no manual unlock needed). This replaces
 * a prior count-based `count(*) + 1` design that was unsafe under
 * concurrency in two independent ways: (1) two transactions racing to create
 * invoices for different reservations could compute the identical
 * "next" number, and the resulting `invoices_workspace_number_uq` violation
 * was never actually retried — Drizzle wraps every driver error in a
 * `DrizzleQueryError` with the real Postgres code at `error.cause.code`, not
 * `error.code`, so the old retry check never matched a real violation; and
 * (2) even with that fixed, Postgres aborts an entire transaction after any
 * failed statement, so a same-transaction retry can't work without a
 * `SAVEPOINT` anyway. An advisory lock sidesteps both: only one transaction
 * at a time computes and reserves a number for a given workspace/year, so no
 * retry is ever needed. `hashtextextended` turns the `workspaceId:year` key
 * into a stable bigint lock key; the arbitrary `0` seed just needs to be
 * consistent, since nothing else in this codebase takes advisory locks.
 */
async function acquireInvoiceNumberLock(exec: Executor, workspaceId: string, year: number): Promise<void> {
  await exec.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${workspaceId}:${year}`}, 0))`);
}

/** Must be called only while `acquireInvoiceNumberLock` is held for the same `workspaceId`/`year`. */
async function generateInvoiceNumber(exec: Executor, workspaceId: string, year: number): Promise<string> {
  const prefix = invoiceNumberPrefix(year);
  const existing = await exec
    .select({ number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.workspaceId, workspaceId), like(invoices.number, `${prefix}%`)));

  const suffix = nextInvoiceSuffix(
    existing.map((row) => row.number),
    prefix,
  );
  return formatInvoiceNumber(year, suffix);
}

/**
 * Idempotent select -> insert(`onConflictDoNothing`) -> reselect, mirroring
 * `ensureCheckoutCleaningTask` exactly against `invoices_reservation_active_uq`
 * (this part is unrelated to invoice numbering and needs no lock — the DB's
 * own partial unique index is already race-safe). Internal-only: no
 * independent RBAC check — the caller must already have authorized whatever
 * reservation change is triggering invoice creation. Seeds one `stay` line
 * item priced at the reservation's `priceCents`, skipped entirely when
 * that's `0` (a comped/free stay) since a zero-amount non-discount line item
 * would violate `invoice_line_items_amount_sign_ck`.
 */
export async function ensureInvoiceForReservation(
  tx: Executor,
  workspaceId: string,
  reservationId: string,
): Promise<string> {
  const existing = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.reservationId, reservationId),
        eq(invoices.workspaceId, workspaceId),
        ne(invoices.status, "void"),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const reservationRows = await tx
    .select({
      customerId: reservations.customerId,
      currency: reservations.currency,
      priceCents: reservations.priceCents,
    })
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.workspaceId, workspaceId)));
  const reservation = reservationRows[0];
  if (!reservation) throw new Error("Reservation not found.");

  const { timezone } = await getWorkspaceLocale(tx, workspaceId);
  const year = workspaceInvoiceYear(timezone);

  await acquireInvoiceNumberLock(tx, workspaceId, year);
  const number = await generateInvoiceNumber(tx, workspaceId, year);

  const inserted = await tx
    .insert(invoices)
    .values({
      workspaceId,
      customerId: reservation.customerId,
      reservationId,
      number,
      status: "draft",
      currency: reservation.currency,
    })
    .onConflictDoNothing({
      target: invoices.reservationId,
      where: sql`${invoices.reservationId} is not null and ${invoices.status} <> 'void'`,
    })
    .returning({ id: invoices.id });

  if (inserted[0]) {
    if (reservation.priceCents > 0) {
      await tx.insert(invoiceLineItems).values({
        workspaceId,
        invoiceId: inserted[0].id,
        type: "stay",
        description: "Stay charge",
        quantity: 1,
        unitAmountCents: reservation.priceCents,
        amountCents: reservation.priceCents,
      });
    }
    return inserted[0].id;
  }

  // Lost the reservation-uniqueness race — another writer created it first.
  const again = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.reservationId, reservationId),
        eq(invoices.workspaceId, workspaceId),
        ne(invoices.status, "void"),
      ),
    )
    .limit(1);
  if (again[0]) return again[0].id;

  throw new Error("Could not create the invoice.");
}

// ---------------------------------------------------------------------------
// Draft-only line items
// ---------------------------------------------------------------------------

interface LockedInvoice {
  reservationId: string | null;
  customerId: string | null;
}

/**
 * Loads an invoice with `SELECT ... FOR UPDATE`, holding the row lock for
 * the rest of the caller's transaction, then checks its status — status is
 * verified *after* the lock is acquired, so a concurrent transaction that
 * already holds the lock (another line-item mutation, or `issueInvoice`)
 * must commit or roll back before this SELECT even returns, and by the time
 * it does, `row.status` reflects the truly-current, post-that-transaction
 * value. This is what actually serializes concurrent line-item mutations
 * and issuance attempts on the same invoice — a plain unlocked `SELECT`
 * (the prior implementation) only checked status at one instant and left a
 * window for another transaction to change it before this one's write
 * lands.
 */
async function lockDraftInvoice(
  exec: Executor,
  workspaceId: string,
  invoiceId: string,
  notDraftMessage: string,
): Promise<LockedInvoice> {
  const found = await exec
    .select({ status: invoices.status, reservationId: invoices.reservationId, customerId: invoices.customerId })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
    .for("update");
  const row = found[0];
  if (!row) throw new Error("Invoice not found.");
  if (row.status !== "draft") throw new Error(notDraftMessage);
  return { reservationId: row.reservationId, customerId: row.customerId };
}

const LINE_ITEMS_NOT_DRAFT_ERROR = "Cannot modify line items on an invoice that is not in draft status.";

function assertValidLineItemSign(input: LineItemInput, amountCents: number): void {
  if (!isValidLineItemAmountSign(input.type, amountCents)) {
    throw new Error(
      input.type === "discount"
        ? "A discount line item must reduce the invoice total."
        : "This line item must add a positive amount to the invoice total.",
    );
  }
}

export async function addLineItem(
  workspaceId: string,
  invoiceId: string,
  input: LineItemInput,
  actor: InvoiceActor,
): Promise<InvoiceLineItemDto> {
  assertInvoiceActionAllowed(actor.role, "editLineItems");

  return db.transaction(async (tx) => {
    await lockDraftInvoice(tx, workspaceId, invoiceId, LINE_ITEMS_NOT_DRAFT_ERROR);

    const amountCents = computeLineItemAmountCents(input.type, input.quantity, input.unitAmount);
    assertValidLineItemSign(input, amountCents);

    const inserted = await tx
      .insert(invoiceLineItems)
      .values({
        workspaceId,
        invoiceId,
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        unitAmountCents: Math.round(input.unitAmount * 100),
        amountCents,
      })
      .returning(LINE_ITEM_COLUMNS);

    const row = inserted[0];
    if (!row) throw new Error("Could not create the line item.");
    return row;
  });
}

export async function updateLineItem(
  workspaceId: string,
  invoiceId: string,
  lineItemId: string,
  input: LineItemInput,
  actor: InvoiceActor,
): Promise<InvoiceLineItemDto> {
  assertInvoiceActionAllowed(actor.role, "editLineItems");

  return db.transaction(async (tx) => {
    await lockDraftInvoice(tx, workspaceId, invoiceId, LINE_ITEMS_NOT_DRAFT_ERROR);

    const amountCents = computeLineItemAmountCents(input.type, input.quantity, input.unitAmount);
    assertValidLineItemSign(input, amountCents);

    const updated = await tx
      .update(invoiceLineItems)
      .set({
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        unitAmountCents: Math.round(input.unitAmount * 100),
        amountCents,
      })
      .where(and(eq(invoiceLineItems.id, lineItemId), eq(invoiceLineItems.invoiceId, invoiceId)))
      .returning(LINE_ITEM_COLUMNS);

    const row = updated[0];
    if (!row) throw new Error("Line item not found.");
    return row;
  });
}

export async function removeLineItem(
  workspaceId: string,
  invoiceId: string,
  lineItemId: string,
  actor: InvoiceActor,
): Promise<void> {
  assertInvoiceActionAllowed(actor.role, "editLineItems");

  await db.transaction(async (tx) => {
    await lockDraftInvoice(tx, workspaceId, invoiceId, LINE_ITEMS_NOT_DRAFT_ERROR);

    const deleted = await tx
      .delete(invoiceLineItems)
      .where(and(eq(invoiceLineItems.id, lineItemId), eq(invoiceLineItems.invoiceId, invoiceId)))
      .returning({ id: invoiceLineItems.id });

    if (!deleted[0]) throw new Error("Line item not found.");
  });
}

// ---------------------------------------------------------------------------
// Issuance (draft -> open, snapshot generation)
// ---------------------------------------------------------------------------

interface IssuanceSnapshot {
  customerNameSnapshot: string | null;
  customerEmailSnapshot: string | null;
  propertyNameSnapshot: string | null;
  buildingNameSnapshot: string | null;
  unitNameSnapshot: string | null;
  checkInDateSnapshot: string | null;
  checkOutDateSnapshot: string | null;
}

/**
 * Deliberately a small, dedicated join here rather than reusing
 * `rental-unit.service.ts`'s `getRentalUnit` — that function excludes
 * soft-deleted units and additionally resolves the workspace's locale and
 * covering-reservation status, neither of which apply to a point-in-time
 * issuance snapshot, and its "unit not found" semantics would incorrectly
 * fail issuance for a reservation whose unit was deactivated afterward.
 */
async function fetchUnitSnapshotNames(
  exec: Executor,
  unitId: string,
): Promise<{ unitName: string | null; buildingName: string | null; propertyName: string | null }> {
  const found = await exec
    .select({
      unitName: rentalUnits.name,
      buildingName: buildings.name,
      propertyName: properties.name,
    })
    .from(rentalUnits)
    .innerJoin(buildings, eq(buildings.id, rentalUnits.buildingId))
    .innerJoin(properties, eq(properties.id, rentalUnits.propertyId))
    .where(eq(rentalUnits.id, unitId));
  return found[0] ?? { unitName: null, buildingName: null, propertyName: null };
}

interface IssuanceSnapshotResult {
  snapshot: IssuanceSnapshot;
  /** The reservation's *current* customer — authoritative, may differ from the invoice's own (possibly stale) `customerId`. */
  customerId: string | null;
}

/**
 * Reads the customer through the reservation (its current, authoritative
 * `customerId`) rather than from `invoices.customerId` — the invoice's own
 * copy is only ever set once, back when the draft invoice was first created
 * (`ensureInvoiceForReservation`), and can go stale if the reservation's
 * customer is reassigned afterward. Joining through the reservation here
 * means the snapshot — and the `customerId` this function returns for the
 * caller to write back onto the invoice — always reflects what the
 * reservation actually says *right now*, inside the same locked transaction
 * that performs the issuance.
 */
async function buildIssuanceSnapshot(
  exec: Executor,
  workspaceId: string,
  reservationId: string | null,
): Promise<IssuanceSnapshotResult> {
  const snapshot: IssuanceSnapshot = {
    customerNameSnapshot: null,
    customerEmailSnapshot: null,
    propertyNameSnapshot: null,
    buildingNameSnapshot: null,
    unitNameSnapshot: null,
    checkInDateSnapshot: null,
    checkOutDateSnapshot: null,
  };
  let customerId: string | null = null;

  if (reservationId) {
    const rows = await exec
      .select({
        customerId: reservations.customerId,
        customerName: customers.name,
        customerEmail: customers.email,
        unitId: reservations.unitId,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .innerJoin(customers, and(eq(customers.id, reservations.customerId), eq(customers.workspaceId, workspaceId)))
      .where(and(eq(reservations.id, reservationId), eq(reservations.workspaceId, workspaceId)));
    const row = rows[0];
    if (row) {
      customerId = row.customerId;
      snapshot.customerNameSnapshot = row.customerName;
      snapshot.customerEmailSnapshot = row.customerEmail;
      snapshot.checkInDateSnapshot = row.checkInDate;
      snapshot.checkOutDateSnapshot = row.checkOutDate;

      const unit = await fetchUnitSnapshotNames(exec, row.unitId);
      snapshot.propertyNameSnapshot = unit.propertyName;
      snapshot.buildingNameSnapshot = unit.buildingName;
      snapshot.unitNameSnapshot = unit.unitName;
    }
  }

  return { snapshot, customerId };
}

const ISSUE_NOT_DRAFT_ERROR = "Only a draft invoice can be issued.";

/**
 * draft -> open. Freezes the customer/property/unit/date snapshots so a
 * later rename never rewrites what an already-issued bill displayed — line
 * items are simultaneously locked from further mutation by the DB's
 * `enforce_invoice_line_items_draft_only` trigger, so `amountCents` is
 * equally frozen from this point on.
 */
export async function issueInvoice(
  workspaceId: string,
  invoiceId: string,
  input: IssueInvoiceInput,
  actor: InvoiceActor,
): Promise<InvoiceDetail> {
  assertInvoiceActionAllowed(actor.role, "issue");

  return db.transaction(async (tx) => {
    // `lockDraftInvoice` takes `SELECT ... FOR UPDATE` and checks status
    // *after* acquiring the lock — this is what actually prevents two
    // concurrent `issueInvoice` calls (e.g. a double-clicked "Issue" button)
    // from both succeeding: the second call's SELECT blocks until the first
    // call's transaction commits or rolls back, and only then observes the
    // now-current `status`.
    const locked = await lockDraftInvoice(tx, workspaceId, invoiceId, ISSUE_NOT_DRAFT_ERROR);

    const { timezone } = await getWorkspaceLocale(tx, workspaceId);
    if (input.dueAt) {
      const issuanceDate = workspaceTodayDate(timezone);
      if (!isDueDateOnOrAfterIssuance(input.dueAt, issuanceDate)) {
        throw new Error("Due date cannot be before the invoice's issuance date.");
      }
    }

    // Deliberately no minimum-total requirement here — issuing a zero (or
    // fully-discounted) invoice is intentional. A complimentary or fully
    // comped stay still gets a real, issued invoice for record-keeping even
    // though nothing is owed; do not add a positive-total check.
    const { snapshot, customerId } = await buildIssuanceSnapshot(tx, workspaceId, locked.reservationId);

    // Defense in depth on top of the row lock above: even though this
    // transaction already holds the only lock on this invoice row, the
    // status is re-asserted directly in the `UPDATE`'s `WHERE` clause and
    // the result checked via `RETURNING`, so a bug anywhere upstream of this
    // point (e.g. a future caller that reuses `buildIssuanceSnapshot`
    // without going through `lockDraftInvoice`) can never silently issue a
    // non-draft invoice.
    const updated = await tx
      .update(invoices)
      .set({
        status: "open",
        issuedAt: new Date(),
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        // Resyncs the invoice's own `customerId` to the reservation's
        // current customer (see `buildIssuanceSnapshot`'s doc comment) —
        // falls back to whatever was already stored only when there's no
        // reservation to derive it from.
        customerId: customerId ?? locked.customerId,
        ...snapshot,
      })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId), eq(invoices.status, "draft")))
      .returning({ id: invoices.id });

    if (!updated[0]) throw new Error(ISSUE_NOT_DRAFT_ERROR);

    const detailRow = await fetchDetailRow(tx, workspaceId, invoiceId);
    const lineItems = await fetchLineItems(tx, invoiceId);
    // A draft invoice can never have payments (the payment-integrity trigger
    // requires status open/paid before any insert) — this is always 0 here,
    // computed rather than hardcoded so there's exactly one code path.
    const netPaidCents = await getInvoiceNetPaidCents(tx, workspaceId, invoiceId);
    return toDetail(detailRow, lineItems, netPaidCents);
  });
}

// ---------------------------------------------------------------------------
// Payments (Sprint 15 Phase 1) — manual charges only. No gateway, no pending
// state: every invoice-linked payment is inserted already `status='paid'`,
// `type='charge'` (`enforce_payment_immutability` blocks any status edit
// afterward, matching `payments`'s own documented Phase-1 design). Refunds
// (`type='refund'`) are schema/trigger-ready but have no consuming service
// yet — deliberately deferred, not this phase's scope.
// ---------------------------------------------------------------------------

const PAYMENT_COLUMNS = {
  id: payments.id,
  workspaceId: payments.workspaceId,
  invoiceId: payments.invoiceId,
  type: payments.type,
  amountCents: payments.amountCents,
  currency: payments.currency,
  method: payments.method,
  actorTeamMemberId: payments.actorTeamMemberId,
  paidAt: payments.paidAt,
  notes: payments.notes,
  voidedAt: payments.deletedAt,
  createdAt: payments.createdAt,
};

interface PaymentRowShape {
  id: string;
  workspaceId: string;
  invoiceId: string | null;
  type: PaymentType;
  amountCents: number;
  currency: string;
  method: PaymentMethodValue;
  actorTeamMemberId: string | null;
  paidAt: Date | null;
  notes: string | null;
  voidedAt: Date | null;
  createdAt: Date;
}

function toPaymentDto(row: PaymentRowShape): PaymentDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    // Every caller either inner-joined through `invoices` (only matches
    // invoice-linked rows) or just inserted/updated a row it set `invoiceId`
    // on itself — non-null in practice even though the column is nullable
    // for the unrelated booking-payments domain.
    invoiceId: row.invoiceId as string,
    type: row.type,
    amountCents: row.amountCents,
    currency: row.currency,
    method: row.method,
    actorTeamMemberId: row.actorTeamMemberId,
    paidAt: row.paidAt,
    notes: row.notes,
    voidedAt: row.voidedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Every read that needs RBAC scoping joins through to the billed
 * reservation's `staffId` — one query shape, reused by `getPayment`,
 * `listInvoicePayments`, and `listPayments` rather than each re-deriving its
 * own join. The `innerJoin` to `invoices` is also what excludes every
 * booking-payment row (`invoiceId is null`) from ever appearing here.
 */
function paymentListQuery(exec: Executor) {
  return exec
    .select({ ...PAYMENT_COLUMNS, reservationStaffId: reservations.staffId })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(reservations, eq(reservations.id, invoices.reservationId));
}

/**
 * Recomputes and, if changed, writes both `invoices.status` and the billed
 * reservation's `paymentStatus` from the current net-paid balance — the one
 * place either derived field is ever written, called at the end of every
 * mutation that changes the payment ledger (`recordPayment`, `voidPayment`).
 * Computes `netPaidCents` exactly once via `getInvoiceNetPaidCents` and
 * shares it across both writes, rather than each deriving its own sum.
 *
 * Locks the invoice row first (`SELECT ... FOR UPDATE`) so that if this call
 * blocks behind a concurrent payment/void on the same invoice, it re-reads
 * the truly-current status/amount — and then computes `netPaidCents` fresh,
 * inside that same now-current view — rather than applying a value computed
 * before the block. That "recompute only after the lock resolves" ordering
 * is exactly what closed the equivalent race in `lockDraftInvoice` during
 * Phase 2B's review; a plain unlocked read here would reintroduce it.
 * Never touches a terminal (`draft`/`void`/`written_off`) invoice status.
 */
async function syncInvoiceAndReservationStatus(
  exec: Executor,
  workspaceId: string,
  invoiceId: string,
): Promise<void> {
  const locked = await exec
    .select({
      status: invoices.status,
      amountCents: invoices.amountCents,
      reservationId: invoices.reservationId,
    })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
    .for("update");
  const invoiceRow = locked[0];
  if (!invoiceRow) return;

  const netPaidCents = await getInvoiceNetPaidCents(exec, workspaceId, invoiceId);

  if (invoiceRow.status === "open" || invoiceRow.status === "paid") {
    const nextStatus = deriveInvoiceStatus(invoiceRow.amountCents, netPaidCents);
    if (nextStatus !== invoiceRow.status) {
      await exec.update(invoices).set({ status: nextStatus }).where(eq(invoices.id, invoiceId));
    }
  }

  if (invoiceRow.reservationId) {
    const nextReservationStatus = deriveReservationPaymentStatus(invoiceRow.amountCents, netPaidCents);
    const reservationRows = await exec
      .select({ paymentStatus: reservations.paymentStatus })
      .from(reservations)
      .where(and(eq(reservations.id, invoiceRow.reservationId), eq(reservations.workspaceId, workspaceId)))
      .for("update");
    const reservationRow = reservationRows[0];
    if (reservationRow && reservationRow.paymentStatus !== nextReservationStatus) {
      await exec
        .update(reservations)
        .set({ paymentStatus: nextReservationStatus })
        .where(eq(reservations.id, invoiceRow.reservationId));
    }
  }
}

const PAYMENT_NOT_PAYABLE_ERROR = "Cannot record a payment against an invoice that is not open.";
const IDEMPOTENCY_KEY_REUSED_ERROR = "This idempotency key was already used for a different payment request.";
const UNIQUE_VIOLATION = "23505";
const IDEMPOTENCY_CONSTRAINT = "payments_workspace_idempotency_uq";

/**
 * Drizzle wraps every driver error in `DrizzleQueryError`, which puts the
 * real Postgres error at `.cause` — `error.code` is always `undefined`.
 * Confirmed the hard way during Phase 2B's review: an earlier check against
 * `error.code` silently never matched a real violation, breaking a retry
 * path entirely. Checks the specific constraint name (not just the bare
 * `23505` code) so an unrelated unique-violation on this table is never
 * misread as an idempotent retry.
 */
function isIdempotencyConflict(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } })?.cause;
  return cause?.code === UNIQUE_VIOLATION && cause?.constraint_name === IDEMPOTENCY_CONSTRAINT;
}

/**
 * Records a manual charge against an open (or already-paid, for a
 * corrective top-up) invoice. `status='paid'`/`type='charge'` always —
 * Phase 1 has no gateway, so there is no pending state to model.
 *
 * Locks the invoice row (`FOR UPDATE`, scoped to just `invoices` even though
 * the query joins `reservations` for the RBAC check) before computing the
 * overpayment pre-check — this is a friendly pre-check only; the real,
 * race-safe guarantee is `enforce_invoice_payment_integrity`'s own
 * `FOR UPDATE` on the same row, which this lock is compatible with (same
 * transaction re-acquiring a lock it already holds is a no-op, never a
 * deadlock).
 *
 * The idempotency-conflict recovery (below) deliberately happens *outside*
 * `db.transaction()`, in the `catch` around the whole call — not inside it.
 * Postgres aborts an entire transaction after any failed statement; a
 * same-transaction recovery query after the failed `INSERT` would itself
 * fail with "current transaction is aborted" (confirmed live while building
 * this). Letting the transaction's own callback throw lets `db.transaction`
 * issue its `ROLLBACK` first, so the recovery `SELECT` runs against a clean
 * connection afterward — the exact fix already applied once this session to
 * the invoice-numbering retry loop, applied here from the start.
 */
export async function recordPayment(
  workspaceId: string,
  invoiceId: string,
  input: RecordPaymentInput,
  actor: InvoiceActor,
): Promise<PaymentDto> {
  assertInvoiceActionAllowed(actor.role, "recordPayment");

  try {
    return await db.transaction(async (tx) => {
      const invoiceRows = await tx
        .select({
          status: invoices.status,
          currency: invoices.currency,
          amountCents: invoices.amountCents,
          customerId: invoices.customerId,
          reservationStaffId: reservations.staffId,
        })
        .from(invoices)
        .leftJoin(reservations, eq(reservations.id, invoices.reservationId))
        .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)))
        .for("update", { of: invoices });
      const invoiceRow = invoiceRows[0];

      // Enumeration-safe ordering (mirrors `getReservationInvoice`): the RBAC
      // check runs *before* the not-found throw, keyed off the row's own
      // staffId when it exists and `null` when it doesn't. A `null`
      // `assignedStaffId` never equals a resolved `actorTeamMemberId`, so a
      // scoped (employee) actor gets the identical `AuthorizationError`
      // whether the invoice is missing, cross-workspace, or simply not
      // theirs — only an owner/manager (who always pass this check) ever
      // reaches the honest "not found" below.
      const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(tx, workspaceId, actor);
      assertCanAccessInvoice({
        role: actor.role,
        actorTeamMemberId: actorTeamMemberId ?? "",
        assignedStaffId: invoiceRow?.reservationStaffId ?? null,
      });
      if (!invoiceRow) throw new Error("Invoice not found.");

      if (invoiceRow.status !== "open" && invoiceRow.status !== "paid") {
        throw new Error(PAYMENT_NOT_PAYABLE_ERROR);
      }

      const amountCents = Math.round(input.amount * 100);
      const netPaidCents = await getInvoiceNetPaidCents(tx, workspaceId, invoiceId);
      if (netPaidCents + amountCents > invoiceRow.amountCents) {
        throw new Error(
          `Payment of ${amountCents} cents would exceed the invoice balance (already ${netPaidCents} of ${invoiceRow.amountCents} cents).`,
        );
      }

      // Recorded regardless of role — owner/manager included, whenever a
      // team-member row resolves for them. This is "who performed the
      // action," distinct from `actorTeamMemberId`'s use just above for the
      // RBAC *assignment* check (which only applies to employees).
      const recordedByTeamMemberId =
        actorTeamMemberId ?? (await resolveActorTeamMemberId(tx, workspaceId, actor.userId));

      const inserted = await tx
        .insert(payments)
        .values({
          workspaceId,
          invoiceId,
          customerId: invoiceRow.customerId,
          type: "charge",
          amountCents,
          currency: invoiceRow.currency,
          method: input.method,
          status: "paid",
          paidAt: new Date(),
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
          actorTeamMemberId: recordedByTeamMemberId,
        })
        .returning(PAYMENT_COLUMNS);

      await syncInvoiceAndReservationStatus(tx, workspaceId, invoiceId);

      const row = inserted[0];
      if (!row) throw new Error("Could not record the payment.");
      return toPaymentDto(row);
    });
  } catch (error) {
    // The raw Postgres unique-violation must never reach the caller once
    // it's been identified as an idempotency conflict — from here on this
    // branch either returns the original payment (a true replay) or throws
    // `IDEMPOTENCY_KEY_REUSED_ERROR`, never the driver error itself.
    if (isIdempotencyConflict(error)) {
      const existingRows = await db
        .select(PAYMENT_COLUMNS)
        .from(payments)
        .where(and(eq(payments.workspaceId, workspaceId), eq(payments.idempotencyKey, input.idempotencyKey)));
      const existing = existingRows[0];
      // `existing.invoiceId` is nullable at the schema level only for the
      // unrelated booking-payments leg (see `toPaymentDto`'s identical
      // cast) — a row found via this workspace+idempotencyKey lookup was
      // just inserted by `recordPayment` itself, so it's always set here.
      if (
        existing &&
        isIdempotentPaymentReplay(
          { invoiceId: existing.invoiceId as string, amountCents: existing.amountCents, method: existing.method },
          { invoiceId, amountCents: Math.round(input.amount * 100), method: input.method },
        )
      ) {
        return toPaymentDto(existing);
      }
      throw new Error(IDEMPOTENCY_KEY_REUSED_ERROR);
    }
    throw error;
  }
}

const PAYMENT_ALREADY_VOIDED_ERROR = "This payment has already been voided.";

/**
 * Soft-deletes a mistaken charge — the correction path for Phase 1 (a full
 * customer refund is a separate, deferred feature; see the file header).
 * `reason` is appended to the payment's own `notes` rather than overwriting
 * it, preserving whatever was recorded at creation. Owner/manager only —
 * `assertInvoiceActionAllowed` already rejects every other role before any
 * DB work happens.
 */
export async function voidPayment(
  workspaceId: string,
  paymentId: string,
  input: VoidPaymentInput,
  actor: InvoiceActor,
): Promise<PaymentDto> {
  assertInvoiceActionAllowed(actor.role, "voidPayment");

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ invoiceId: payments.invoiceId, deletedAt: payments.deletedAt, notes: payments.notes })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.workspaceId, workspaceId)))
      .for("update");
    const row = rows[0];
    if (!row || !row.invoiceId) throw new Error("Payment not found.");
    if (row.deletedAt) throw new Error(PAYMENT_ALREADY_VOIDED_ERROR);

    const notes = row.notes ? `${row.notes}\n\nVoided: ${input.reason}` : `Voided: ${input.reason}`;

    const updated = await tx
      .update(payments)
      .set({ deletedAt: new Date(), notes })
      .where(and(eq(payments.id, paymentId), eq(payments.workspaceId, workspaceId), isNull(payments.deletedAt)))
      .returning(PAYMENT_COLUMNS);
    const updatedRow = updated[0];
    if (!updatedRow) throw new Error(PAYMENT_ALREADY_VOIDED_ERROR);

    await syncInvoiceAndReservationStatus(tx, workspaceId, row.invoiceId);

    return toPaymentDto(updatedRow);
  });
}

export async function getPayment(
  workspaceId: string,
  paymentId: string,
  actor: InvoiceActor,
): Promise<PaymentDto> {
  const rows = await paymentListQuery(db).where(
    and(eq(payments.id, paymentId), eq(payments.workspaceId, workspaceId)),
  );
  const row = rows[0];

  // Enumeration-safe ordering — see `recordPayment`'s identical comment.
  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  assertCanAccessInvoice({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedStaffId: row?.reservationStaffId ?? null,
  });
  if (!row) throw new Error("Payment not found.");

  return toPaymentDto(row);
}

export async function listInvoicePayments(
  workspaceId: string,
  invoiceId: string,
  actor: InvoiceActor,
): Promise<PaymentDto[]> {
  // A scoped (non-`fetchDetailRow`) existence lookup — `fetchDetailRow`
  // throws immediately on a missing row and is shared with out-of-scope
  // `getInvoice`/`issueInvoice`, so it isn't reused here; enumeration-safe
  // ordering (see `recordPayment`) needs the RBAC check to run first.
  const invoiceRows = await detailQuery(db).where(
    and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)),
  );
  const invoiceRow = invoiceRows[0];

  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  assertCanAccessInvoice({
    role: actor.role,
    actorTeamMemberId: actorTeamMemberId ?? "",
    assignedStaffId: invoiceRow?.reservationStaffId ?? null,
  });
  if (!invoiceRow) throw new Error("Invoice not found.");

  const rows = await paymentListQuery(db)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.workspaceId, workspaceId)))
    .orderBy(asc(payments.createdAt));
  return rows.map(toPaymentDto);
}

export async function listPayments(workspaceId: string, actor: InvoiceActor): Promise<PaymentDto[]> {
  const actorTeamMemberId = await resolveActorTeamMemberIdOrNull(db, workspaceId, actor);
  const scope = resolveInvoiceScope(actor.role, actorTeamMemberId);
  if (scope.kind === "none") return [];

  const where = [eq(payments.workspaceId, workspaceId)];
  if (scope.kind === "assigned") {
    where.push(eq(reservations.staffId, scope.teamMemberId));
  }

  const rows = await paymentListQuery(db)
    .where(and(...where))
    .orderBy(desc(payments.createdAt));
  return rows.map(toPaymentDto);
}
