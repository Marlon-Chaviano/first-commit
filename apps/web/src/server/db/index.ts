import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import * as schema from "./schema";

// `prepare: false` keeps it compatible with transaction poolers (Neon, Supabase, PgBouncer).
export const db = env.DATABASE_URL
  ? drizzle(postgres(env.DATABASE_URL, { prepare: false, max: 5 }), { schema })
  : null;
