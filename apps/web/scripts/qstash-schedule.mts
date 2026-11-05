/**
 * Creates (or updates) the QStash schedules: draining the install queue and the weekly newsletter.
 *
 *   Production: QSTASH_TOKEN=… SITE_URL=https://<dominio> pnpm qstash:schedule
 *   Local:      QSTASH_DEV=1 SITE_URL=http://localhost:3200 pnpm qstash:schedule
 *
 * Every 10 minutes = 144 messages a day, well inside QStash's free tier.
 * Counters are real-time in Redis already; Postgres only needs the durable copy.
 */
import { Client } from "@upstash/qstash";
import { config } from "dotenv";

config({ path: ".env.local" });

const JOBS = [
  { id: "kits-flush-events", path: "/api/cron/flush-events", cron: process.env.FLUSH_CRON ?? "*/10 * * * *" },
  // Monday 09:00 UTC: 4 messages a month.
  { id: "kits-newsletter", path: "/api/cron/newsletter", cron: process.env.NEWSLETTER_CRON ?? "0 9 * * 1" },
];
const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("Falta SITE_URL (p. ej. https://tu-dominio o http://localhost:3200)");

const dev = process.env.QSTASH_DEV === "1" || process.env.QSTASH_DEV === "true";
if (!dev && !process.env.QSTASH_TOKEN) throw new Error("Falta QSTASH_TOKEN (o usa QSTASH_DEV=1 en local)");
const client = dev ? new Client({ devMode: true }) : new Client({ token: process.env.QSTASH_TOKEN! });

for (const job of JOBS) {
  const destination = new URL(job.path, siteUrl).toString();
  // Same scheduleId = update in place, so running this twice never duplicates the job.
  await client.schedules.create({ scheduleId: job.id, destination, cron: job.cron, method: "POST", retries: 3 });
  console.log(`✓ Schedule "${job.id}": ${job.cron} → POST ${destination}`);
}
