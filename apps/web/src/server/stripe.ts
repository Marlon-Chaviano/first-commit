import "server-only";

import Stripe from "stripe";

import { env } from "./env";

/** Null when Stripe isn't configured: billing UI shows "unavailable" and nothing is charged. */
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      ...(env.STRIPE_API_URL
        ? (() => {
            // stripe-mock for local tests: same API, canned responses, no account needed.
            const url = new URL(env.STRIPE_API_URL);
            return { host: url.hostname, port: url.port, protocol: url.protocol.replace(":", "") as "http" | "https" };
          })()
        : {}),
    })
  : null;

export const billingEnabled = Boolean(stripe);
