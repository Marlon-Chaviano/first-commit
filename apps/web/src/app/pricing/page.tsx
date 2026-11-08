import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PLANS } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description: "Free for public kits. Pro for creators, and Teams for a private registry with policies checked in CI.",
};

export default function PricingPage() {
  // Everything is free until billing is configured: there's nothing to price.
  if (!billingEnabled) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Using kits, publishing public kits, and the CLI, the MCP and the skill are free, and will stay free.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Object.entries(PLANS).map(([id, plan]) => (
          <div key={id} className="flex flex-col gap-4 rounded-lg border p-6">
            <div>
              <h2 className="font-semibold">{plan.label}</h2>
              <p className="mt-1 font-mono text-2xl">{plan.price}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
              {plan.features.map((f) => (
                <li key={f}>— {f}</li>
              ))}
            </ul>
            <Button variant={id === "free" ? "outline" : "default"} nativeButton={false} render={<Link href={id === "team" ? "/orgs/new" : id === "pro" ? "/account" : "/"} />}>
              {id === "free" ? "Get started" : id === "team" ? "Create organization" : "Upgrade to Pro"}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Paid kits: the creator sets the price and gets paid into their Stripe account, minus a platform fee.
      </p>
    </div>
  );
}
