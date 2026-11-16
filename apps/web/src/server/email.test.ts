import { afterEach, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ env: { RESEND_API_KEY: "test-provider", EMAIL_FROM: "current@example.com" } }));
import { sendEmail } from "./email";

afterEach(() => vi.unstubAllGlobals());

it("uses provider idempotency and the frozen sender for newsletter retries", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await sendEmail({ from: "original@example.com", to: "reader@example.com", subject: "Release", text: "New feature" }, "newsletter/release/reader");
  const options = fetch.mock.calls[0]![1];
  expect(options.headers["Idempotency-Key"]).toBe("newsletter/release/reader/0");
  expect(JSON.parse(options.body).from).toBe("original@example.com");
});
