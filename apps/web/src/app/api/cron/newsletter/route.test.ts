import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), send: vi.fn() }));
vi.mock("@/server/jobs/auth", () => ({ isAuthorizedJob: mocks.authorized }));
vi.mock("@/server/newsletter-delivery", () => ({ sendChangelogNotifications: mocks.send }));

import { POST } from "./route";

beforeEach(() => {
  mocks.authorized.mockReset().mockResolvedValue(true);
  mocks.send.mockReset().mockResolvedValue({ status: "sent", recipients: 1 });
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "new-commit");
});
afterEach(() => vi.unstubAllEnvs());

it("rejects unauthorized triggers without sending", async () => {
  mocks.authorized.mockResolvedValue(false);
  expect((await POST(new Request("https://example.com/api/cron/newsletter", { method: "POST" }))).status).toBe(401);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("waits for the requested deployment to reach production", async () => {
  const response = await POST(new Request("https://example.com/api/cron/newsletter", { method: "POST", headers: { "x-deployment-commit": "other-commit" } }));
  expect(response.status).toBe(409);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("sends from the requested production commit", async () => {
  const response = await POST(new Request("https://example.com/api/cron/newsletter", { method: "POST", headers: { "x-deployment-commit": "new-commit" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "sent", recipients: 1 });
});

it("makes missing email configuration a visible, retryable failure", async () => {
  mocks.send.mockResolvedValue({ status: "skipped", reason: "no email provider", recipients: 0 });
  expect((await POST(new Request("https://example.com/api/cron/newsletter", { method: "POST" }))).status).toBe(503);
});
