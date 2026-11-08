import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

const event = () => ({
  type: "install",
  kit: "landing-next",
  kitVersion: "1.0.0",
  options: {},
  skills: [],
  agents: ["claude-code"],
  pm: "npm",
  cliVersion: "1.0.1",
  os: "linux",
  anonId: randomUUID(),
});

test("POST /api/v1/events accepts a valid install event", async ({ request }) => {
  const response = await request.post("/api/v1/events", { data: event() });
  expect(response.status()).toBe(202);
});

test("POST /api/v1/events rejects an invalid event", async ({ request }) => {
  const missingFields = await request.post("/api/v1/events", { data: { kit: "landing-next" } });
  expect(missingFields.status()).toBe(400);

  const notJson = await request.post("/api/v1/events", { data: "not json", headers: { "content-type": "application/json" } });
  expect(notJson.status()).toBe(400);
});
