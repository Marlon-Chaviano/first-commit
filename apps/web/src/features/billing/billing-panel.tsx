import { PLANS, type PlanId } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";

import type { BillingTarget } from "./actions";
import { CheckoutButton, PortalButton } from "./buttons";

/** Current plan and the way to change it. Server component: the buttons are the client part. */
export function BillingPanel({ subject, plan, canManage, seats = 1 }: { subject: BillingTarget; plan: PlanId; canManage: boolean; seats?: number }) {
  const target = subject.kind === "org" ? PLANS.team : PLANS.pro;
  const paid = plan !== "free";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[PLANS.free, target].map((p) => (
          <div key={p.label} className="flex flex-col gap-2 rounded-lg border p-4" data-current={PLANS[plan] === p || undefined}>
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">{p.label}</span>
              <span className="font-mono text-sm text-muted-foreground">{p.price}</span>
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {p.features.map((f) => (
                <li key={f}>— {f}</li>
              ))}
            </ul>
            {PLANS[plan] === p && <p className="label-mono">Current plan</p>}
          </div>
        ))}
      </div>
      {!billingEnabled ? (
        <p className="text-sm text-muted-foreground">Payments aren&apos;t enabled on this server yet.</p>
      ) : !canManage ? (
        <p className="text-sm text-muted-foreground">Only {subject.kind === "org" ? "an owner" : "the account holder"} can change the plan.</p>
      ) : paid ? (
        <PortalButton target={subject} />
      ) : (
        <div className="flex items-center gap-3">
          <CheckoutButton target={subject}>Upgrade to {target.label}</CheckoutButton>
          {subject.kind === "org" && <span className="text-sm text-muted-foreground">{seats} {seats === 1 ? "member" : "members"}: adjusts as people are added or removed.</span>}
        </div>
      )}
    </div>
  );
}
