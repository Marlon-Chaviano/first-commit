import { setTimeout as delay } from "node:timers/promises";

import { BRAND } from "../packages/schema/src/brand.ts";

if (!process.env.CRON_SECRET) throw new Error("Missing NEWSLETTER_CRON_SECRET repository secret");
const endpoint = new URL("/api/cron/newsletter", BRAND.siteUrl);

for (let attempt = 0; attempt < 20; attempt++) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        ...(process.env.DEPLOYMENT_COMMIT ? { "x-deployment-commit": process.env.DEPLOYMENT_COMMIT } : {}),
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (response.status === 401 || response.status === 403) throw new Error("Newsletter authorization failed");
    if (response.ok) {
      const result = await response.json();
      console.log(JSON.stringify(result));
      if (result.status !== "pending") process.exit(0);
    } else {
      console.warn(`Newsletter attempt ${attempt + 1}: HTTP ${response.status}`);
    }
  } catch (error) {
    if (error.message === "Newsletter authorization failed") throw error;
    console.warn(`Newsletter attempt ${attempt + 1}: ${error.message}`);
  }
  await delay(30_000);
}
throw new Error("Newsletter delivery did not complete; inspect the production job and retry this workflow");
