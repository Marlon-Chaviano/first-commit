import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { CreateOrgForm } from "@/features/orgs/create-org-form";

export const metadata: Metadata = { title: "New organization", robots: { index: false } };

export default function NewOrgPage() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link href="/account/orgs" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        Organizations
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">New organization</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          A private registry for your team: kits with your stack, your AGENTS.md rules and your MCP servers. To create one, verify a work email from your
          company&apos;s domain.
        </p>
      </div>
      <CreateOrgForm />
    </div>
  );
}
