"use server";

import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { z } from "zod";

import { keys } from "@/server/metrics/keys";
import { subscribe } from "@/server/newsletter";
import { isLocalRedis, redis } from "@/server/redis";

const ratelimit = redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: `${keys.rateLimit}:newsletter` }) : null;

export type SubscribeState = { status: "idle" | "sent" | "already" | "error"; message?: string };

export async function subscribeAction(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Escribe un email válido" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  try {
    if (ratelimit && !(await ratelimit.limit(ip)).success) return { status: "error", message: "Demasiados intentos, prueba más tarde" };
  } catch (error) {
    console.error("[newsletter] rate limiter no disponible", error);
  }
  try {
    const result = await subscribe(email.data);
    if (result === "unavailable") return { status: "error", message: "La newsletter no está disponible ahora mismo" };
    return { status: result };
  } catch (error) {
    console.error("[newsletter]", error);
    return { status: "error", message: "No se pudo enviar el email de confirmación" };
  }
}
