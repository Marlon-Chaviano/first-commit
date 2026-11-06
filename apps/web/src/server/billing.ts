import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";

import { db } from "./db";
import { creatorAccounts, kits, kitVersions, licenses, orgMembers, orgs, stripeEvents, subscriptions, user } from "./db/schema";
import { env } from "./env";
import { type PlanId } from "./plans";
import { REGISTRY_TAG } from "./registry";
import { stripe } from "./stripe";
import type { TokenUser } from "./tokens";

export class BillingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Subject = { kind: "user"; id: string } | { kind: "org"; id: string };

const siteUrl = () => env.BETTER_AUTH_URL ?? "http://localhost:3200";
const ACTIVE = new Set(["active", "trialing", "past_due"]);

function requireStripe(): Stripe {
  if (!stripe || !db) throw new BillingError(503, "Payments aren't enabled on this server");
  return stripe;
}

const priceFor = (plan: Exclude<PlanId, "free">) => (plan === "pro" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_TEAM);

/** The user's plan from their subscription (orgs keep theirs in `orgs.plan`). */
export async function userPlan(userId: string): Promise<PlanId> {
  if (!db) return "free";
  const [row] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.subjectType, "user"), eq(subscriptions.subjectId, userId)))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return row && ACTIVE.has(row.status) ? (row.plan as PlanId) : "free";
}

async function existingCustomer(subject: Subject): Promise<string | undefined> {
  const [row] = await db!
    .select({ customerId: subscriptions.customerId })
    .from(subscriptions)
    .where(and(eq(subscriptions.subjectType, subject.kind), eq(subscriptions.subjectId, subject.id)))
    .limit(1);
  return row?.customerId;
}

/** Stripe Checkout for Pro (a user) or Equipos (an org, one seat per member). */
export async function createSubscriptionCheckout(viewer: TokenUser, subject: Subject, plan: Exclude<PlanId, "free">, seats = 1): Promise<string> {
  const s = requireStripe();
  const price = priceFor(plan);
  if (!price) throw new BillingError(503, `Falta STRIPE_PRICE_${plan.toUpperCase()}`);
  const metadata = { subjectType: subject.kind, subjectId: subject.id, plan };
  const customer = await existingCustomer(subject);
  const [account] = await db!.select({ email: user.email }).from(user).where(eq(user.id, viewer.id)).limit(1);
  const back = subject.kind === "org" ? `/orgs/${(await db!.select({ slug: orgs.slug }).from(orgs).where(eq(orgs.id, subject.id)))[0]?.slug}` : "/account";
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: Math.max(1, seats) }],
    ...(customer ? { customer } : { customer_email: account?.email }),
    client_reference_id: `${subject.kind}:${subject.id}`,
    metadata,
    // Copied onto the subscription, so every later subscription event knows its subject.
    subscription_data: { metadata },
    success_url: `${siteUrl()}${back}?pago=ok`,
    cancel_url: `${siteUrl()}${back}`,
  });
  if (!session.url) throw new BillingError(502, "Stripe didn't return the checkout URL");
  return session.url;
}

/** Customer Portal: change card, cancel, invoices. */
export async function createPortal(subject: Subject, returnPath: string): Promise<string> {
  const s = requireStripe();
  const customer = await existingCustomer(subject);
  if (!customer) throw new BillingError(404, "There's no subscription to manage");
  return (await s.billingPortal.sessions.create({ customer, return_url: `${siteUrl()}${returnPath}` })).url;
}

/** Equipos is per seat: called when members change. Best effort; the next webhook corrects `seats`. */
export async function syncSeats(orgId: string): Promise<void> {
  if (!stripe || !db) return;
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.subjectType, "org"), eq(subscriptions.subjectId, orgId)))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  if (!sub || !ACTIVE.has(sub.status)) return;
  const members = (await db.select({ u: orgMembers.userId }).from(orgMembers).where(eq(orgMembers.orgId, orgId))).length;
  if (members === sub.seats) return;
  try {
    const live = await stripe.subscriptions.retrieve(sub.id);
    const item = live.items.data[0];
    if (item) await stripe.subscriptions.update(sub.id, { items: [{ id: item.id, quantity: members }], proration_behavior: "create_prorations" });
  } catch (error) {
    console.error("[billing] couldn't update the seats", error);
  }
}

// ── Premium kits ─────────────────────────────────────────────────────────────

/** Stripe Connect Express onboarding for a creator. Returns the URL to complete it. */
export async function creatorOnboarding(viewer: TokenUser): Promise<string> {
  const s = requireStripe();
  let [row] = await db!.select().from(creatorAccounts).where(eq(creatorAccounts.userId, viewer.id)).limit(1);
  if (!row) {
    const account = await s.accounts.create({ type: "express", metadata: { userId: viewer.id }, capabilities: { card_payments: { requested: true }, transfers: { requested: true } } });
    [row] = await db!.insert(creatorAccounts).values({ userId: viewer.id, stripeAccountId: account.id }).returning();
  }
  const link = await s.accountLinks.create({
    account: row!.stripeAccountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl()}/account?cobros=reintentar`,
    return_url: `${siteUrl()}/account?cobros=ok`,
  });
  return link.url;
}

export async function creatorStatus(userId: string) {
  if (!db) return null;
  return (await db.select().from(creatorAccounts).where(eq(creatorAccounts.userId, userId)).limit(1))[0] ?? null;
}

/** Owner sets (or removes) a one-time price. Needs a Connect account that can take charges. */
export async function setKitPrice(viewer: TokenUser, slug: string, priceCents: number | null): Promise<void> {
  requireStripe();
  const [kit] = await db!.select().from(kits).where(eq(kits.slug, slug)).limit(1);
  if (!kit || kit.ownerId !== viewer.id) throw new BillingError(404, "Kit not found");
  if (kit.visibility !== "public") throw new BillingError(400, "Only public kits can be sold");
  if (priceCents !== null) {
    // Versions published before archives existed are downloaded from GitHub: they can't be sold.
    const [latest] = await db!.select({ archived: sql<boolean>`${kitVersions.archive} is not null` }).from(kitVersions).where(and(eq(kitVersions.kitId, kit.id), eq(kitVersions.version, kit.latestVersion))).limit(1);
    if (!latest?.archived) throw new BillingError(400, "Publish the kit again (a new version) before setting a price");
    if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 100_000) throw new BillingError(400, "The price goes from €1 to €1,000");
    const account = await creatorStatus(viewer.id);
    if (!account?.chargesEnabled) throw new BillingError(400, "Finish setting up payouts first (Stripe Connect)");
  }
  await db!.update(kits).set({ priceCents, updatedAt: new Date() }).where(eq(kits.id, kit.id));
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  revalidateTag(`kit:${slug}`, { expire: 0 });
}

/** Can this user download a premium kit? Owner, admins and buyers with an active license. */
export async function hasLicense(kitId: string, userId: string | null | undefined): Promise<boolean> {
  if (!db || !userId) return false;
  const [row] = await db
    .select({ id: licenses.id })
    .from(licenses)
    .where(and(eq(licenses.kitId, kitId), eq(licenses.userId, userId), eq(licenses.status, "active")))
    .limit(1);
  return Boolean(row);
}

export const platformFee = (amount: number) => Math.round((amount * env.PLATFORM_FEE_PERCENT) / 100);

/** Checkout for a premium kit: the money goes to the creator minus the platform fee (destination charge). */
export async function createKitCheckout(viewer: TokenUser, slug: string): Promise<string> {
  const s = requireStripe();
  const [row] = await db!
    .select({ kit: kits, account: creatorAccounts })
    .from(kits)
    .leftJoin(creatorAccounts, eq(creatorAccounts.userId, kits.ownerId))
    .where(eq(kits.slug, slug))
    .limit(1);
  if (!row?.kit.priceCents || row.kit.status !== "active") throw new BillingError(404, "This kit isn't for sale");
  if (!row.account?.chargesEnabled) throw new BillingError(503, "The creator can't receive payments yet");
  if (row.kit.ownerId === viewer.id || (await hasLicense(row.kit.id, viewer.id))) throw new BillingError(409, "You already have this kit");
  const amount = row.kit.priceCents;
  const metadata = { kind: "kit", kitId: row.kit.id, userId: viewer.id };
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "eur", unit_amount: amount, product_data: { name: row.kit.title, description: `${slug} en kits` } }, quantity: 1 }],
    metadata,
    payment_intent_data: { application_fee_amount: platformFee(amount), transfer_data: { destination: row.account.stripeAccountId }, metadata },
    success_url: `${siteUrl()}/kits/${slug}?compra=ok`,
    cancel_url: `${siteUrl()}/kits/${slug}`,
  });
  if (!session.url) throw new BillingError(502, "Stripe didn't return the checkout URL");
  return session.url;
}

/** Admin: full refund, taking the money back from the creator and returning the fee. Revokes the license. */
export async function refundLicense(licenseId: string): Promise<void> {
  const s = requireStripe();
  const [license] = await db!.select().from(licenses).where(eq(licenses.id, licenseId)).limit(1);
  if (!license?.paymentIntentId) throw new BillingError(404, "Purchase not found");
  await s.refunds.create({ payment_intent: license.paymentIntentId, reverse_transfer: true, refund_application_fee: true });
  await db!.update(licenses).set({ status: "refunded" }).where(eq(licenses.id, license.id));
}

export async function listPurchases(limit = 100) {
  if (!db) return [];
  return db
    .select({ license: licenses, kit: kits.slug, buyer: user.handle })
    .from(licenses)
    .innerJoin(kits, eq(licenses.kitId, kits.id))
    .innerJoin(user, eq(licenses.userId, user.id))
    .orderBy(desc(licenses.createdAt))
    .limit(limit);
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/**
 * Applies one verified Stripe event. Idempotent: the event id is recorded in
 * the same transaction as its effects, so a retry (or a concurrent delivery)
 * does nothing. Returns false for an event already processed.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (!db) throw new BillingError(503, "No database");
  return db.transaction(async (tx) => {
    const claimed = await tx.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvents.id });
    if (!claimed.length) return false;

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const { subjectType, subjectId, plan } = sub.metadata;
        if (!subjectType || !subjectId || !plan) break; // Not one of ours.
        const item = sub.items.data[0];
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        const values = {
          subjectType,
          subjectId,
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          plan,
          status,
          seats: item?.quantity ?? 1,
          currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
          updatedAt: new Date(event.created * 1000),
        };
        // Events can arrive out of order: an older one never overwrites a newer state.
        const applied = await tx
          .insert(subscriptions)
          .values({ id: sub.id, ...values })
          .onConflictDoUpdate({ target: subscriptions.id, set: values, setWhere: sql`${subscriptions.updatedAt} <= excluded.updated_at` })
          .returning({ id: subscriptions.id });
        if (applied.length && subjectType === "org") await tx.update(orgs).set({ plan: ACTIVE.has(status) ? plan : "free" }).where(eq(orgs.id, subjectId));
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "payment" || session.metadata?.kind !== "kit" || session.payment_status !== "paid") break;
        const amount = session.amount_total ?? 0;
        await tx
          .insert(licenses)
          .values({
            kitId: session.metadata.kitId!,
            userId: session.metadata.userId!,
            amountCents: amount,
            feeCents: platformFee(amount),
            checkoutSessionId: session.id,
            paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
          })
          .onConflictDoNothing();
        break;
      }
      case "charge.refunded":
      case "charge.dispute.created": {
        const object = event.data.object;
        const paymentIntent = "payment_intent" in object ? object.payment_intent : null;
        const id = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
        if (!id) break;
        const refunded = event.type === "charge.refunded" && "refunded" in object && object.refunded;
        if (event.type === "charge.dispute.created" || refunded) {
          await tx
            .update(licenses)
            .set({ status: event.type === "charge.refunded" ? "refunded" : "disputed" })
            .where(and(eq(licenses.paymentIntentId, id), inArray(licenses.status, ["active"])));
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object;
        await tx
          .update(creatorAccounts)
          .set({ chargesEnabled: account.charges_enabled ?? false, payoutsEnabled: account.payouts_enabled ?? false, updatedAt: new Date() })
          .where(eq(creatorAccounts.stripeAccountId, account.id));
        break;
      }
    }
    return true;
  });
}
