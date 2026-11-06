import { handleStripeEvent } from "@/server/billing";
import { env } from "@/server/env";
import { stripe } from "@/server/stripe";

/**
 * POST /api/webhooks/stripe — the source of truth for subscriptions and
 * purchases. Signature verified on the raw body; each event applied once.
 */
export async function POST(request: Request) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return new Response("Pagos desactivados", { status: 503 });
  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const applied = await handleStripeEvent(event);
    return Response.json({ received: true, duplicate: !applied });
  } catch (error) {
    // 500 makes Stripe retry later; the event id wasn't recorded, so the retry is applied.
    console.error("[stripe] webhook", event.type, error);
    return new Response("Error", { status: 500 });
  }
}
