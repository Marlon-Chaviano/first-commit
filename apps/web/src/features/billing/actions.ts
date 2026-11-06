"use server";

import { redirect } from "next/navigation";

import {
  BillingError,
  createKitCheckout,
  createPortal,
  createSubscriptionCheckout,
  creatorOnboarding,
  refundLicense,
  setKitPrice,
  type Subject,
} from "@/server/billing";
import { getOrg, listMembers, orgCapabilities } from "@/server/orgs";
import { action, type Result } from "@/server/action";
import { fail } from "@/server/errors";
import type { TokenUser } from "@/server/tokens";

export type BillingTarget = { kind: "user" } | { kind: "org"; slug: string };

/** Who pays: the viewer (Pro) or an org they own (Equipos). Only owners manage an org's billing. */
async function resolveSubject(viewer: TokenUser, target: BillingTarget) {
  if (target.kind === "user") return { subject: { kind: "user", id: viewer.id } as Subject, seats: 1, back: "/account" };
  const org = await getOrg(target.slug);
  if (!org || !(await orgCapabilities(org, viewer)).canManageBilling) throw new BillingError(403, "Only an owner manages the plan");
  return { subject: { kind: "org", id: org.id } as Subject, seats: (await listMembers(org.id)).length, back: `/orgs/${org.slug}` };
}

/** Stripe actions end in a redirect to Stripe; they only come back with an error. */
const STRIPE = { failure: "Couldn't open the checkout" };

export async function checkoutAction(target: BillingTarget): Promise<Result<never>> {
  return action(STRIPE, async (viewer) => {
    const { subject, seats } = await resolveSubject(viewer, target);
    redirect(await createSubscriptionCheckout(viewer, subject, target.kind === "org" ? "team" : "pro", seats));
  });
}

export async function portalAction(target: BillingTarget): Promise<Result<never>> {
  return action(STRIPE, async (viewer) => {
    const { subject, back } = await resolveSubject(viewer, target);
    redirect(await createPortal(subject, back));
  });
}

export async function onboardingAction(): Promise<Result<never>> {
  return action(STRIPE, async (viewer) => redirect(await creatorOnboarding(viewer)));
}

export async function buyKitAction(slug: string): Promise<Result<never>> {
  return action(STRIPE, async (viewer) => redirect(await createKitCheckout(viewer, slug)));
}

export async function setPriceAction(slug: string, euros: string): Promise<Result> {
  return action({ failure: "Couldn't save the price" }, async (viewer) => {
    const trimmed = euros.trim().replace(",", ".");
    const cents = trimmed === "" || trimmed === "0" ? null : Math.round(Number(trimmed) * 100);
    if (cents !== null && !Number.isFinite(cents)) fail("Invalid price");
    await setKitPrice(viewer, slug, cents);
  });
}

export async function refundAction(licenseId: string): Promise<Result> {
  return action({ auth: "admin", failure: "Couldn't refund the purchase" }, () => refundLicense(licenseId));
}
