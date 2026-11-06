import { AUTHOR, BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/legal-page";
import { BrandName } from "@/components/shared/brand-name";

export const metadata: Metadata = { title: "Privacy", description: `What data ${BRAND.name} collects, why, who processes it and how to delete it.` };

export default function PrivacyPage() {
  const mail = <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>;
  return (
    <LegalPage
      title="Privacy policy"
      updated="2026-11-05"
      summary={
        <>
          <BrandName /> is a free, personal open-source project. It doesn&apos;t sell data, show ads or use tracking cookies, and the CLI&apos;s install counts are
          anonymous. You can ask for your data to be deleted at any time.
        </>
      }
    >
      <p>
        This policy covers <BrandName />: the website at {new URL(BRAND.siteUrl).host}, its public API, its MCP server and the <code>{BRAND.cli}</code> CLI. It is run by{" "}
        {AUTHOR.name}, who is responsible for your data and can be reached at {mail}.
      </p>

      <h2>Signing in with GitHub or Google</h2>
      <p>An account is optional: browsing, the configurator and the CLI work without one. If you sign in, we receive:</p>
      <ul>
        <li>
          <strong>GitHub</strong> (scopes <code>read:user</code> and <code>user:email</code>): your name, email address, profile picture and GitHub username, plus
          an access token. The token is stored only to read your username and, when you publish a kit, to check that you can access the repository it comes
          from. It is never used to write to GitHub.
        </li>
        <li>
          <strong>Google</strong> (scopes <code>openid</code>, <code>email</code> and <code>profile</code>): your name, email address and profile picture.
        </li>
      </ul>
      <p>
        We use this only to identify you, show your profile picture and username, and attribute the kits and organizations you create. We don&apos;t access
        anything else in your GitHub or Google account, and we don&apos;t send you email because you signed in.
      </p>
      <p>
        <BrandName />&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Google user data is never sold, used for advertising, used to train AI models or shared with anyone except
        the service providers listed below, who process it only to run <BrandName />.
      </p>

      <h2>What you publish</h2>
      <p>
        Kits you publish (their manifest, files and version history), your username and your public profile are public by design. Kits limited to an
        organization are visible only to its members. CLI tokens you create are stored only as a hash.
      </p>

      <h2>CLI telemetry</h2>
      <p>
        When you install, update or add a kit, the CLI sends: the kit and its version, the options and skills chosen, the agents, the package manager, the CLI
        version, the operating system and a random ID generated on your machine. It never sends project names, paths, code or anything that identifies you.
        Our hosting provider tells us the country the request comes from; the IP address isn&apos;t stored with the event. This data feeds the public ranking and
        each kit&apos;s statistics. It isn&apos;t sent in CI, for kits installed from a local folder, or when <code>DO_NOT_TRACK=1</code> or{" "}
        <code>KITS_TELEMETRY=0</code> is set.
      </p>

      <h2>Newsletter</h2>
      <p>
        If you subscribe, we store your email address and its status. Nothing is sent until you confirm from the email we send you, and confirmation links
        expire after 7 days. Every issue has an unsubscribe link, and mail apps that support one-click unsubscribe can use it directly.
      </p>

      <h2>Contact form and reports</h2>
      <ul>
        <li>
          Messages sent from the <Link href="/contact">contact page</Link> are emailed to {AUTHOR.name} with your email address as the reply-to. They aren&apos;t
          stored in our database.
        </li>
        <li>When you report a kit we store the reason, your description, an optional contact and a salted hash of your IP address (to detect abuse without keeping the IP).</li>
        <li>
          The <strong>Describe your project</strong> recommender, when enabled, sends only the text you write to Anthropic to suggest a kit. Without it, the
          suggestion is made on our server.
        </li>
        <li>The brand importer fetches only the website address you enter, to read its colors and fonts.</li>
      </ul>

      <h2>Abuse protection</h2>
      <p>
        To limit spam, the API, newsletter, reports and contact form count requests per IP address in short-lived counters (one hour at most) that expire on
        their own. Our hosting provider may keep standard request logs for a short period.
      </p>

      <h2>Cookies and local storage</h2>
      <p>Only the session cookie that keeps you signed in. No analytics, advertising or third-party tracking cookies.</p>

      <h2>Service providers</h2>
      <ul>
        <li>Vercel: hosting.</li>
        <li>Neon: database (accounts, kits, subscribers, statistics).</li>
        <li>Upstash: event queue, rate-limit counters and scheduled jobs.</li>
        <li>Resend: sending email (newsletter, confirmations, contact messages).</li>
        <li>GitHub and Google: sign-in. GitHub also hosts the source of the kits.</li>
        <li>Anthropic: the optional recommender, only the description you write.</li>
      </ul>
      <p>We don&apos;t use any payment provider: <BrandName /> doesn&apos;t charge for anything.</p>

      <h2>How long we keep data</h2>
      <ul>
        <li>Account data and OAuth tokens: until you delete your account. Sessions expire on their own.</li>
        <li>Newsletter: until you unsubscribe or ask us to delete it.</li>
        <li>Reports: as long as needed to moderate the kit.</li>
        <li>Telemetry: kept for statistics. It is anonymous, so it can&apos;t be linked to you or deleted per person.</li>
      </ul>

      <h2>Your rights and deleting your data</h2>
      <p>
        Write to {mail} from the email address of your account to get a copy of your data, correct it or delete your account. Deletion covers your account,
        OAuth tokens, sessions, CLI tokens and newsletter subscription, and is done within 30 days. Kits you published are removed or transferred, as you prefer.
        You can also revoke <BrandName />&apos;s access at any time from your GitHub settings (Applications) or your Google account (Third-party connections).
      </p>

      <h2>Children</h2>
      <p><BrandName /> is a developer tool and isn&apos;t directed at children under 16.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a meaningful way, the date above changes and the update is announced in the changelog.</p>
    </LegalPage>
  );
}
