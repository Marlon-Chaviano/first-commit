import { AUTHOR, BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/legal-page";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" }, title: "Terms", description: `${BRAND.name} terms of use. The service is free.` };

export default function TermsPage() {
  const mail = <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>;
  return (
    <LegalPage
      title="Terms of use"
      updated="2026-11-05"
      summary={
        <>
          <BrandName /> is free. There are no paid plans, paid kits or charges of any kind. Kits run commands on your machine, so review the plan the CLI shows
          before accepting it.
        </>
      }
    >
      <p>
        By using <BrandName /> (the website, API, MCP server and <code>{BRAND.cli}</code> CLI) you accept these terms. The service is run by {AUTHOR.name} as a
        personal open-source project ({mail}).
      </p>

      <h2>The service</h2>
      <p>
        <BrandName /> is a registry of workspace kits: templates that create a project with its dependencies, agent skills, MCP servers and agent rules.
        Installing a kit runs, on your machine, the commands that kit defines, and those commands install third-party software. The CLI shows you the full plan
        before running anything and asks for confirmation.
      </p>

      <h2>Price</h2>
      <p>
        Everything is free: using the website, installing kits, creating an account and publishing kits. We don&apos;t ask for payment details and nothing is
        charged automatically. If paid features are ever added, these terms will be updated first, they will be opt-in, and nothing that is free today will
        start costing money without your explicit agreement.
      </p>

      <h2>Accounts</h2>
      <p>
        You sign in with GitHub or Google and are responsible for what is published from your account. Keep your CLI tokens private; you can revoke them from
        your account page. To publish, your account must be able to access the kit&apos;s GitHub repository. Each account can publish a limited number of kits, to
        prevent spam.
      </p>

      <h2>Kits you publish</h2>
      <p>
        You keep all rights to your kits and are responsible for their content and for the software they install. By publishing a kit you allow us to host,
        display, index and distribute it to the people who install it. Kits must follow the <Link href="/content-policy">content policy</Link>.
      </p>

      <h2>Third-party software</h2>
      <p>
        Kits install frameworks, libraries, skills and MCP servers made by others, under their own licenses and terms. <BrandName /> doesn&apos;t control them.
        Official kits are tested, but community kits are the responsibility of their creators.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t abuse the API, try to break the service, get around its limits, or use it to distribute anything the content policy forbids.</p>

      <h2>No warranty and liability</h2>
      <p>
        The service and the kits are provided &quot;as is&quot;, without warranty of any kind. We don&apos;t guarantee that a kit works in your environment or is free
        of errors. To the extent the law allows, we aren&apos;t liable for damages that come from using the service or running a kit.
      </p>

      <h2>Suspension and closure</h2>
      <p>
        We can hide kits or suspend accounts that break these terms or the content policy. You can stop using the service and ask for your account to be deleted
        at any time (see the <Link href="/privacy">privacy policy</Link>). The project may change or shut down; if it does, it will be announced in the changelog
        in advance where possible.
      </p>

      <h2>Changes</h2>
      <p>If these terms change in a meaningful way, the date above changes and the update is announced in the changelog.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: {mail} or the <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}
