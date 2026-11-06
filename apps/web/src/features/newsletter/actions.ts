"use server";

import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { z } from "zod";

import { keys } from "@/server/metrics/keys";
import { confirmSubscription, subscribe, unsubscribe } from "@/server/newsletter";
import { isLocalRedis, redis } from "@/server/redis";

const ratelimit = redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: `${keys.rateLimit}:newsletter` }) : null;

export type SubscribeState = { status: "idle" | "sent" | "already" | "error"; message?: string };

export async function subscribeAction(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Enter a valid email" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  try {
    if (ratelimit && !(await ratelimit.limit(ip)).success) return { status: "error", message: "Too many attempts, try again later" };
  } catch (error) {
    console.error("[newsletter] rate limiter unavailable", error);
  }
  try {
    const result = await subscribe(email.data);
    if (result === "unavailable") return { status: "error", message: "The newsletter isn't available right now" };
    return { status: result };
  } catch (error) {
    console.error("[newsletter]", error);
    return { status: "error", message: "Couldn't send the confirmation email" };
  }
}

export type LinkState = { status: "idle" | "done" | "invalid" };

/** The confirm and unsubscribe links only act on a click: email scanners open links, they don't submit forms. */
export async function confirmAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  return { status: (await confirmSubscription(String(form.get("token") ?? ""))) ? "done" : "invalid" };
}

export async function unsubscribeAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  const ok = await unsubscribe(String(form.get("id") ?? ""), String(form.get("sig") ?? ""));
  return { status: ok ? "done" : "invalid" };
}
