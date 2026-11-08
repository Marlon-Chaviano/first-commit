"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { confirmSubscription, subscribe, unsubscribe } from "@/server/newsletter";
import { clientIp, rateLimit } from "@/server/rate-limit";

import { NEWSLETTER_COOKIE, type NewsletterStatus } from "./status";

const limit = rateLimit("newsletter", 5, "1 h");

async function rememberStatus(status: NewsletterStatus) {
  const jar = await cookies();
  if (status) jar.set(NEWSLETTER_COOKIE, status, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  else jar.delete(NEWSLETTER_COOKIE);
}

export type SubscribeState = { status: "idle" | "sent" | "already" | "error"; message?: string };

export async function subscribeAction(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Enter a valid email" };
  if (!(await limit.allow(clientIp(await headers())))) return { status: "error", message: "Too many attempts, try again later" };
  try {
    const result = await subscribe(email.data);
    if (result === "unavailable") return { status: "error", message: "The newsletter isn't available right now" };
    await rememberStatus(result === "already" ? "confirmed" : "pending");
    return { status: result };
  } catch (error) {
    console.error("[newsletter]", error);
    return { status: "error", message: "Couldn't send the confirmation email" };
  }
}

export type LinkState = { status: "idle" | "done" | "invalid" };

/** The confirm and unsubscribe links only act on a click: email scanners open links, they don't submit forms. */
export async function confirmAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  const ok = await confirmSubscription(String(form.get("token") ?? ""));
  if (ok) await rememberStatus("confirmed");
  return { status: ok ? "done" : "invalid" };
}

export async function unsubscribeAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  const ok = await unsubscribe(String(form.get("id") ?? ""), String(form.get("sig") ?? ""));
  if (ok) await rememberStatus(null);
  return { status: ok ? "done" : "invalid" };
}
