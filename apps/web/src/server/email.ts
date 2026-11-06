import "server-only";

import { BRAND } from "@kits/schema";

import { env } from "./env";

export interface Email {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Where replies go (the contact form uses the sender's address). */
  replyTo?: string;
  /** List-Unsubscribe and similar. */
  headers?: Record<string, string>;
}

const from = () => env.EMAIL_FROM ?? `${BRAND.name} <onboarding@resend.dev>`;

/**
 * Sends through Resend's REST API. Without RESEND_API_KEY it logs the email
 * (local development) and returns false, so nothing ever depends on email.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  return (await sendEmails([email])) > 0;
}

/** Up to 100 per request (Resend batch). Returns how many were accepted. */
export async function sendEmails(emails: Email[]): Promise<number> {
  if (!emails.length) return 0;
  if (!env.RESEND_API_KEY) {
    for (const e of emails) console.info(`[email] (no RESEND_API_KEY) → ${e.to}: ${e.subject}\n${e.text ?? ""}`);
    return 0;
  }
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    // Resend's REST API spells it reply_to.
    const chunk = emails.slice(i, i + 100).map(({ replyTo, ...e }) => ({ from: from(), ...e, ...(replyTo ? { reply_to: replyTo } : {}) }));
    const res = await fetch(chunk.length === 1 ? "https://api.resend.com/emails" : "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    sent += chunk.length;
  }
  return sent;
}
