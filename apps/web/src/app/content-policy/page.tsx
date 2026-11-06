import { AUTHOR, BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/legal-page";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = { title: "Content policy", description: `Which kits can be published on ${BRAND.name} and how reports are handled.` };

export default function ContentPolicyPage() {
  return (
    <LegalPage
      title="Content policy"
      updated="2026-11-05"
      summary={<>A kit runs commands on the machine of whoever installs it, and it gives instructions to their coding agent. That&apos;s why these rules are strict.</>}
    >
      <h2>Not allowed</h2>
      <ul>
        <li>Malware, backdoors, crypto miners, or commands that do something other than what the kit describes.</li>
        <li>Collecting or sending credentials, environment variables, source code or personal data.</li>
        <li>Skills, MCP servers or AGENTS.md rules that tell the agent to skip the user&apos;s confirmation, disable safeguards or act against the user&apos;s interests.</li>
        <li>Impersonating another person, company or project, or using their brand to mislead.</li>
        <li>Illegal content, or content that infringes licenses, copyrights, trademarks or other third-party rights.</li>
        <li>Hateful, harassing or sexually explicit content.</li>
        <li>Spam: empty or duplicate kits, or kits created only to promote links.</li>
      </ul>

      <h2>Expected</h2>
      <ul>
        <li>The kit&apos;s title and description say honestly what it installs.</li>
        <li>Commands are visible in the kit&apos;s manifest, not downloaded and run from hidden sources.</li>
        <li>Skills and libraries come from their official sources.</li>
      </ul>

      <h2>Reporting and enforcement</h2>
      <p>
        Anyone can report a kit from its page, without an account. Reports are reviewed by an admin, who can hide the kit: it stops appearing on <BrandName />{" "}
        and can no longer be installed from the registry. Serious or repeated violations lead to account suspension. Kits that put users at risk are hidden as
        soon as the report is confirmed.
      </p>
      <p>
        To appeal a decision, or to report something urgent, write to <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a> or use the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}
