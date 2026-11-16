# Changelog emails

Each new entry in `registry/changelog.json` has a permanent `id`, a date, a title
and an `items` array. Keep the id when correcting copy: edits and redeployments
must not send another email. `notify: false` preserves historical entries without
mailing them again. Future-dated entries are ignored until their date.

`.github/workflows/newsletter.yml` listens for Vercel's successful commit status
on `main`, then calls the production `/api/cron/newsletter` endpoint. Its
`NEWSLETTER_CRON_SECRET` repository secret must match production `CRON_SECRET`.
The deployment commit header prevents a call from reaching the previous release
while the production alias is being updated. The workflow can also be run
manually on `main`; it retries failures and continues batches while work remains.
The existing QStash schedule is a fallback, not a second weekly digest.

Apply database migrations before deploying sender changes. `newsletter_releases`
stores each entry once. `newsletter_deliveries` snapshots the confirmed audience
and rendered messages, records accepted deliveries individually, and checks a
subscriber's current status before each send. Pending/unsubscribed addresses do
not receive updates. People joining later do not receive old releases.

Short database leases prevent overlapping jobs from claiming the same delivery.
No network call holds a database transaction open. Resend idempotency keys protect
retries when a provider response is lost; frozen payloads keep those requests
identical. Accepted deliveries stay recorded after the provider's deduplication
window expires. An uncertain attempt older than 23 hours stops for reconciliation
against Resend's logs instead of risking a duplicate. After confirming that the
provider did not accept it, an operator can reset that delivery's `first_attempt_at`
and retry the workflow; if it was accepted, record `sent_at` instead.

Production needs `DATABASE_URL`, `RESEND_API_KEY`, a verified `EMAIL_FROM`,
`BETTER_AUTH_SECRET` and `CRON_SECRET`. Missing services return 503 without claiming
an entry. Resend quota/rate errors fail the workflow visibly and leave unsent
deliveries available for retry. The existing free-tier email limit still applies.
No new Redis counters or Vercel cron jobs are used.

Tests use local Postgres and a mocked email provider:

```sh
KITS_INTEGRATION=1 DATABASE_URL=postgres://...@localhost:5432/newsletter_test \
  pnpm vitest run apps/web/src/server/newsletter-delivery.integration.test.ts
```
