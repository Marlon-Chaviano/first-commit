"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { buyKitAction, checkoutAction, onboardingAction, portalAction, refundAction, setPriceAction, type BillingTarget } from "./actions";

/** Runs an action that redirects to Stripe; shows the error if it returns one. */
function StripeButton({ action, children, variant = "default" }: { action: () => Promise<{ ok: false; error: string }>; children: React.ReactNode; variant?: "default" | "outline" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await action();
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      {pending ? "Opening Stripe…" : children}
    </Button>
  );
}

export const CheckoutButton = ({ target, children }: { target: BillingTarget; children: React.ReactNode }) => (
  <StripeButton action={() => checkoutAction(target)}>{children}</StripeButton>
);
export const PortalButton = ({ target }: { target: BillingTarget }) => (
  <StripeButton action={() => portalAction(target)} variant="outline">Manage subscription</StripeButton>
);
export const OnboardingButton = ({ children }: { children: React.ReactNode }) => (
  <StripeButton action={() => onboardingAction()} variant="outline">{children}</StripeButton>
);
export const BuyKitButton = ({ slug, children }: { slug: string; children: React.ReactNode }) => (
  <StripeButton action={() => buyKitAction(slug)}>{children}</StripeButton>
);

export function PriceForm({ slug, priceCents }: { slug: string; priceCents: number | null }) {
  const [value, setValue] = useState(priceCents ? (priceCents / 100).toFixed(2) : "");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setPriceAction(slug, value);
          if (r.ok) toast.success(value ? "Price saved" : "The kit is free again");
          else toast.error(r.error);
        });
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="free" aria-label="Price in euros" className="w-28 font-mono" />
      <span className="text-sm text-muted-foreground">€, one-time payment</span>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

export function RefundButton({ licenseId }: { licenseId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refundAction(licenseId);
          if (r.ok) toast.success("Refunded");
          else toast.error(r.error);
        })
      }
    >
      Refund
    </Button>
  );
}
