/**
 * This browser's newsletter state, so the changelog shows "you're subscribed" instead of the form.
 * A convenience only: the source of truth is newsletter_subscribers.
 */
export const NEWSLETTER_COOKIE = "first-commit-newsletter";

export type NewsletterStatus = "confirmed" | "pending" | null;

export const parseNewsletterStatus = (value: string | undefined): NewsletterStatus =>
  value === "confirmed" || value === "pending" ? value : null;
