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
import { getOrg, listMembers, roleIn } from "@/server/orgs";
import { getViewer, isAdmin } from "@/server/session";

type Result = { ok: false; error: string };
export type BillingTarget = { kind: "user" } | { kind: "org"; slug: string };

/** Who pays: the viewer (Pro) or an org they own (Equipos). Only owners manage an org's billing. */
async function resolveSubject(target: BillingTarget) {
  const viewer = await getViewer();
  if (!viewer) throw new BillingError(401, "Log in first");
  if (target.kind === "user") return { viewer, subject: { kind: "user", id: viewer.id } as Subject, seats: 1, back: "/account" };
  const org = await getOrg(target.slug);
  if (!org || (await roleIn(org.id, viewer.id)) !== "owner") throw new BillingError(403, "Only an owner manages the plan");
  return { viewer, subject: { kind: "org", id: org.id } as Subject, seats: (await listMembers(org.id)).length, back: `/orgs/${org.slug}` };
}

async function go(fn: () => Promise<string>): Promise<Result> {
  let url: string;
  try {
    url = await fn();
  } catch (error) {
    if (error instanceof BillingError) return { ok: false, error: error.message };
    console.error("[billing]", error);
    return { ok: false, error: "Couldn't open the checkout" };
  }
  redirect(url);
}

export async function checkoutAction(target: BillingTarget): Promise<Result> {
  return go(async () => {
    const { viewer, subject, seats } = await resolveSubject(target);
    return createSubscriptionCheckout(viewer, subject, target.kind === "org" ? "team" : "pro", seats);
  });
}

export async function portalAction(target: BillingTarget): Promise<Result> {
  return go(async () => {
    const { subject, back } = await resolveSubject(target);
    return createPortal(subject, back);
  });
}

export async function onboardingAction(): Promise<Result> {
  return go(async () => {
    const viewer = await getViewer();
    if (!viewer) throw new BillingError(401, "Log in first");
    return creatorOnboarding(viewer);
  });
}

export async function buyKitAction(slug: string): Promise<Result> {
  return go(async () => {
    const viewer = await getViewer();
    if (!viewer) throw new BillingError(401, "Log in to buy");
    return createKitCheckout(viewer, slug);
  });
}

export async function setPriceAction(slug: string, euros: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Log in first" };
  const trimmed = euros.trim().replace(",", ".");
  const cents = trimmed === "" || trimmed === "0" ? null : Math.round(Number(trimmed) * 100);
  if (cents !== null && !Number.isFinite(cents)) return { ok: false, error: "Invalid price" };
  try {
    await setKitPrice(viewer, slug, cents);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof BillingError ? error.message : "No se pudo guardar" };
  }
}

export async function refundAction(licenseId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isAdmin(await getViewer())) return { ok: false, error: "No tienes permiso" };
  try {
    await refundLicense(licenseId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof BillingError ? error.message : "No se pudo reembolsar" };
  }
}
