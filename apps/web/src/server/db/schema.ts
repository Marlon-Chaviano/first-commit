import type { VerificationReport } from "@kits/schema";
import { boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Raw install events: the source of every counter (ranking, trending, uniques, breakdowns). Redis only buffers them. */
export const installEvents = pgTable(
  "install_events",
  {
    id: uuid("id").primaryKey(),
    kit: text("kit").notNull(),
    /** install | update | add */
    eventType: text("event_type").notNull().default("install"),
    kitVersion: text("kit_version"),
    official: boolean("official").notNull(),
    options: jsonb("options").$type<Record<string, string[]>>().notNull(),
    skills: text("skills").array().notNull(),
    agents: text("agents").array().notNull(),
    pm: text("pm").notNull(),
    cliVersion: text("cli_version").notNull(),
    os: text("os"),
    anonId: uuid("anon_id").notNull(),
    country: text("country"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("install_events_kit_created_idx").on(t.kit, t.createdAt)],
);

/** Daily rollup per kit, upserted by the flush job. Feeds history charts and analytics. */
export const kitStatsDaily = pgTable(
  "kit_stats_daily",
  {
    kit: text("kit").notNull(),
    day: date("day").notNull(),
    installs: integer("installs").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kit, t.day] })],
);

/**
 * Reports from `create-first-commit test --upload`, signed by GitHub OIDC. `repository` and
 * `commitSha` come from the verified token, never from the request body.
 */
export const kitVerifications = pgTable(
  "kit_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kit: text("kit").notNull(),
    version: text("version").notNull(),
    ok: boolean("ok").notNull(),
    platform: text("platform").notNull(),
    repository: text("repository").notNull(),
    commitSha: text("commit_sha").notNull(),
    workflowRef: text("workflow_ref"),
    report: jsonb("report").$type<VerificationReport>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("kit_verifications_kit_version_idx").on(t.kit, t.version, t.createdAt)],
);

/** "Denunciar este kit". Reviewed by hand (admin panel in phase 3). */
export const kitReports = pgTable(
  "kit_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kit: text("kit").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    contact: text("contact"),
    /** Salted hash of the reporter IP, to spot abuse without storing the IP. */
    ipHash: text("ip_hash"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("kit_reports_kit_idx").on(t.kit, t.createdAt)],
);

/**
 * Registry: official kits (synced from registry/, owner null) and community
 * kits published by users. The slug is the install name: "mobile-expo" or "ana/landing".
 */
export const kits = pgTable(
  "kits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    official: boolean("official").notNull().default(false),
    /** "owner/repo" on GitHub and the folder of kit.json inside it ("" = root). */
    repo: text("repo").notNull(),
    path: text("path").notNull().default(""),
    /** active | hidden (admin) | retired (owner) */
    status: text("status").notNull().default("active"),
    latestVersion: text("latest_version").notNull(),
    /** Denormalized from the latest version for listings and search. */
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    tags: text("tags").array().notNull().default([]),
    /** Main language (LANGUAGES id), from the latest version. */
    language: text("language").notNull().default("typescript"),
    /** public: listed and installable by anyone. org: only members of `orgId` (private registry). */
    visibility: text("visibility").notNull().default("public"),
    orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    /** Premium kits: one-time price in cents (null = free). The files need a license to download. */
    priceCents: integer("price_cents"),
    /** Set by an admin: shown in "Destacados" on the home page and in the newsletter. */
    featuredAt: timestamp("featured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("kits_owner_idx").on(t.ownerId), index("kits_status_idx").on(t.status)],
);

/** Every published version is immutable: manifest + commit + integrity hash. */
export const kitVersions = pgTable(
  "kit_versions",
  {
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    commitSha: text("commit_sha").notNull(),
    /** kit.json with `extends` already resolved (catalog libraries not expanded). */
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
    integrity: text("integrity").notNull(),
    /** Private kits only: the kit folder (packDir), served to members instead of GitHub. */
    archive: bytea("archive"),
    publishedById: text("published_by_id").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.kitId, t.version] })],
);

/** Tokens for the CLI (`create-first-commit login`) and CI. Only the hash is stored; the prefix helps users tell them apart. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

/** Newsletter with double opt-in: pending until the email link is clicked. */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /** pending | confirmed | unsubscribed */
  status: text("status").notNull().default("pending"),
  /** Random secret for the confirm and unsubscribe links; stored as SHA-256. */
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

/** One row per digest sent, so the weekly job never sends the same week twice. */
export const newsletterIssues = pgTable("newsletter_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** ISO week, e.g. "2026-W45". */
  week: text("week").notNull().unique(),
  subject: text("subject").notNull(),
  recipients: integer("recipients").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Organizations: a team with members and a private registry. The slug is the
 * namespace of its kits ("acme/backend"), like a user's handle.
 */
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** free | team. Private kits need "team" (set by Stripe webhooks, phase 7 billing). */
  plan: text("plan").notNull().default("free"),
  /** Libraries every project must use / must not use; `create-first-commit doctor` enforces them. */
  policy: jsonb("policy").$type<{ required: string[]; forbidden: string[] }>().notNull().default({ required: [], forbidden: [] }),
  /** Company domain proven with a one-time code sent to a work email when the org was created. Null for orgs created before. */
  verifiedDomain: text("verified_domain"),
  verifiedEmail: text("verified_email"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Pending one-time codes for "create an organization": one row per user, replaced on every new code. */
export const orgEmailVerifications = pgTable("org_email_verifications", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  /** SHA-256 of the 6-digit code. */
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** owner: billing and members · admin: members and kits · member: install and publish */
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("org_members_user_idx").on(t.userId)],
);

/**
 * Stripe subscriptions (Pro for a user, Equipos for an org), kept in sync by
 * webhooks: they're the source of truth, never the redirect after checkout.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(), // sub_…
    /** user | org */
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    customerId: text("customer_id").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    seats: integer("seats").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("subscriptions_subject_idx").on(t.subjectType, t.subjectId)],
);

/** Webhook idempotency: an event id is processed once, however often Stripe retries it. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(), // evt_…
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Creators' Stripe Connect (Express) accounts, to receive the money of premium kits. */
export const creatorAccounts = pgTable("creator_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A purchase of a premium kit: lets that user download every version of it. */
export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => kits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** active | refunded | disputed */
    status: text("status").notNull().default("active"),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull(),
    checkoutSessionId: text("checkout_session_id").notNull().unique(),
    paymentIntentId: text("payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("licenses_user_kit_idx").on(t.userId, t.kitId), index("licenses_payment_idx").on(t.paymentIntentId)],
);

/**
 * Brand profiles: a company's colors, fonts, UI rules and docs, applied to any
 * kit with `--brand <slug>`. Private: owned by a user ("ana/acme") or an org
 * ("acme/web", readable by its members).
 */
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Browser login for the CLI (`create-first-commit login`): the terminal shows a code, the person
 * approves it on the website, and the CLI picks up a fresh token by polling with its secret.
 * Rows live for 10 minutes and are deleted once used.
 */
export const cliLoginRequests = pgTable("cli_login_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** What the person compares between terminal and browser, e.g. "BCDF-2345". */
  userCode: text("user_code").notNull().unique(),
  /** SHA-256 of the secret only the CLI knows: approving needs the code, collecting the token needs this. */
  secretHash: text("secret_hash").notNull(),
  /** pending | approved | denied */
  status: text("status").notNull().default("pending"),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  /** "macbook (darwin)", shown on the approval page and used to name the token. */
  device: text("device").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
