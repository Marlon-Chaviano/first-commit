"use server";

import { AUTHOR, BRAND } from "@kits/schema";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { z } from "zod";

import { sendEmail } from "@/server/email";
import { env } from "@/server/env";
import { keys } from "@/server/metrics/keys";
import { isLocalRedis, redis } from "@/server/redis";

const ratelimit = redis && !isLocalRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: `${keys.rateLimit}:contact` }) : null;

const messageSchema = z.object({
  email: z.email("Enter a valid email so I can reply"),
  subject: z.string().trim().min(3, "Add a subject").max(120, "Keep the subject under 120 characters"),
  message: z.string().trim().min(10, "Write a bit more").max(5000, "Keep the message under 5,000 characters"),
});

export type ContactState = { status: "idle" | "sent" | "error"; message?: string };

/** Quick message from /contact: emailed to the author, with the sender as reply-to. Nothing is stored. */
export async function sendContactAction(_prev: ContactState, form: FormData): Promise<ContactState> {
  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (String(form.get("website") ?? "")) return { status: "sent" };
  const parsed = messageSchema.safeParse({ email: form.get("email"), subject: form.get("subject"), message: form.get("message") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  try {
    if (ratelimit && !(await ratelimit.limit(ip)).success) return { status: "error", message: "Too many messages, try again in an hour" };
  } catch (error) {
    console.error("[contact] rate limiter unavailable", error);
  }

  const { email, subject, message } = parsed.data;
  try {
    const sent = await sendEmail({
      to: AUTHOR.email,
      replyTo: email,
      subject: `[${BRAND.name}] ${subject}`,
      text: `From: ${email}\n\n${message}`,
    });
    // Locally, without RESEND_API_KEY, the email is logged instead and that counts as sent.
    if (!sent && (env.RESEND_API_KEY || process.env.NODE_ENV === "production")) throw new Error("email not sent");
    return { status: "sent" };
  } catch (error) {
    console.error("[contact]", error);
    return { status: "error", message: `Couldn't send it. Write to ${AUTHOR.email} instead.` };
  }
}
