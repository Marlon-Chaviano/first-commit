import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangelogEntry } from "./newsletter";
import { EmailDeliveryError } from "./email";

const state = vi.hoisted(() => ({
  entries: [] as ChangelogEntry[],
  send: vi.fn().mockResolvedValue(true),
  env: {
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://kits:kits@localhost:5433/kits",
    RESEND_API_KEY: "test-provider",
    EMAIL_FROM: "test@example.com",
    BETTER_AUTH_URL: "https://example.com",
  },
}));
vi.mock("./env", () => ({ env: state.env }));
vi.mock("./email", async (importOriginal) => ({ ...await importOriginal<typeof import("./email")>(), sendEmail: state.send }));
vi.mock("./newsletter", () => ({
  getChangelog: async () => state.entries,
  unsubscribeUrl: (id: string) => `https://example.com/unsubscribe/${id}`,
  oneClickUnsubscribeUrl: (id: string) => `https://example.com/api/unsubscribe/${id}`,
}));
vi.mock("node:timers/promises", () => ({ setTimeout: async () => {} }));

describe.skipIf(process.env.KITS_INTEGRATION !== "1")("changelog newsletter (Postgres)", () => {
  let m: {
    sender: typeof import("./newsletter-delivery");
    db: NonNullable<typeof import("./db")["db"]>;
    schema: typeof import("./db/schema");
    orm: typeof import("drizzle-orm");
  };
  const releaseIds: string[] = [];
  const subscriberIds: string[] = [];
  const entry = (extra: Partial<ChangelogEntry> = {}): ChangelogEntry => {
    const id = `test-${randomUUID()}`;
    releaseIds.push(id);
    return { id, date: new Date().toISOString().slice(0, 10), title: "A new release", items: ["A feature"], notify: true, ...extra };
  };
  const subscriber = async (status = "confirmed") => {
    const id = randomUUID();
    subscriberIds.push(id);
    await m.db.insert(m.schema.newsletterSubscribers).values({ id, email: `${id}@example.com`, tokenHash: id, status });
    return id;
  };
  const deliveries = () => m.db.select().from(m.schema.newsletterDeliveries).where(m.orm.inArray(m.schema.newsletterDeliveries.releaseId, releaseIds));

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(state.env.DATABASE_URL).hostname)) throw new Error("Newsletter integration tests require local Postgres");
    m = { sender: await import("./newsletter-delivery"), db: (await import("./db")).db!, schema: await import("./db/schema"), orm: await import("drizzle-orm") };
  });
  const cleanup = async () => {
    if (!m) return;
    if (releaseIds.length) await m.db.delete(m.schema.newsletterReleases).where(m.orm.inArray(m.schema.newsletterReleases.id, releaseIds));
    if (subscriberIds.length) await m.db.delete(m.schema.newsletterSubscribers).where(m.orm.inArray(m.schema.newsletterSubscribers.id, subscriberIds));
  };
  beforeEach(async () => {
    await cleanup();
    releaseIds.length = 0;
    subscriberIds.length = 0;
    state.entries = [];
    state.send.mockReset().mockResolvedValue(true);
    state.env.RESEND_API_KEY = "test-provider";
  });
  afterAll(cleanup);

  it("sends each new entry in the same week only to confirmed subscribers, once", async () => {
    const id = await subscriber();
    await subscriber("pending");
    await subscriber("unsubscribed");
    state.entries = [entry(), entry({ notify: false }), entry({ date: "2099-01-01" })];
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ status: "sent", recipients: 1 });
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ to: `${id}@example.com` }), expect.stringContaining(state.entries[0]!.id));
    state.entries[0]!.title = "Edited title";
    await subscriber();
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ status: "skipped", recipients: 0 });
    state.entries.unshift(entry());
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ status: "sent", recipients: 2 });
    expect(state.send).toHaveBeenCalledTimes(3);
  });

  it("retries a failure using the same frozen body and key without repeating accepted recipients", async () => {
    await subscriber();
    await subscriber();
    state.entries = [entry()];
    state.send.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Resend unavailable"));
    await expect(m.sender.sendChangelogNotifications()).rejects.toThrow("Resend unavailable");
    const failed = state.send.mock.calls[1];
    expect((await deliveries()).filter((row) => row.sentAt)).toHaveLength(1);
    state.entries[0]!.items = ["Edited after the failure"];
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ status: "sent", recipients: 1 });
    expect(state.send.mock.calls[2]).toEqual(failed);
    expect((await deliveries()).every((row) => row.sentAt)).toBe(true);
  });

  it("does not claim a release without a provider", async () => {
    await subscriber();
    state.entries = [entry()];
    state.env.RESEND_API_KEY = "";
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ reason: "no email provider" });
    expect(await deliveries()).toHaveLength(0);
    state.env.RESEND_API_KEY = "test-provider";
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ recipients: 1 });
  });

  it("honors unsubscribe between attempts", async () => {
    const id = await subscriber();
    state.entries = [entry()];
    state.send.mockRejectedValueOnce(new Error("unavailable"));
    await expect(m.sender.sendChangelogNotifications()).rejects.toThrow();
    await m.db.update(m.schema.newsletterSubscribers).set({ status: "unsubscribed" }).where(m.orm.eq(m.schema.newsletterSubscribers.id, id));
    await m.sender.sendChangelogNotifications();
    expect(state.send).toHaveBeenCalledTimes(1);
    expect((await deliveries())[0]!.skippedAt).not.toBeNull();
  });

  it("claims a delivery once when jobs overlap", async () => {
    await subscriber();
    state.entries = [entry()];
    await Promise.all([m.sender.sendChangelogNotifications(), m.sender.sendChangelogNotifications()]);
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it("does not blindly resend an uncertain attempt after provider deduplication expires", async () => {
    await subscriber();
    state.entries = [entry()];
    state.send.mockRejectedValueOnce(new Error("timeout"));
    await expect(m.sender.sendChangelogNotifications()).rejects.toThrow("timeout");
    await m.db.update(m.schema.newsletterDeliveries).set({ firstAttemptAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }).where(m.orm.eq(m.schema.newsletterDeliveries.releaseId, state.entries[0]!.id));
    await expect(m.sender.sendChangelogNotifications()).rejects.toThrow("needs reconciliation");
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it("allows later retries after the provider explicitly rejects a quota-limited send", async () => {
    await subscriber();
    state.entries = [entry()];
    state.send.mockRejectedValueOnce(new EmailDeliveryError(429, "quota exceeded"));
    await expect(m.sender.sendChangelogNotifications()).rejects.toThrow("quota exceeded");
    expect((await deliveries())[0]!.firstAttemptAt).toBeNull();
    expect(await m.sender.sendChangelogNotifications()).toMatchObject({ status: "sent", recipients: 1 });
  });
});
