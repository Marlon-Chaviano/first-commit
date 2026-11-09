import { BRAND } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/api" },
  title: "API",
  description: `The ${BRAND.name} public API: kits, recommendations, skills and the remote MCP server.`,
};

const BASE = `${BRAND.siteUrl}/api/v1`;

export default function ApiDocs() {
  return (
    <>
      <DocsHeader title="API">
        A read-only JSON API to search kits and ask for recommendations, plus a remote MCP server for agents. No key needed.
        Base URL: <Code>{BASE}</Code>.
      </DocsHeader>

      <H2 id="kits">Kits</H2>
      <Fields
        rows={[
          ["GET /kits", <>Official and community kits. Filters: <Code>q</Code> (text), <Code>category</Code> and <Code>official=1|0</Code>.</>],
          ["GET /kits/<slug>", <>Where to download a community kit and its integrity hash. <Code>?version=</Code> for a specific version.</>],
          ["GET /verifications", <>Whether a version passed <Code>test</Code>: <Code>?kit=mobile-expo&amp;version=1.3.0</Code>.</>],
        ]}
      />
      <CodeBlock code={`curl "${BASE}/kits?q=stripe&official=1"`} />

      <H2 id="recommend">Recommend a kit</H2>
      <Fields rows={[["POST /recommend", <>Body <Code>{"{ \"description\": \"…\" }"}</Code>. Returns the kit, the options and the reasons. Limit: 24 per day per IP, shared with the <Code>recommend_kit</Code> tool of the remote MCP server.</>]]} />
      <CodeBlock
        code={`curl -X POST ${BASE}/recommend \\
  -H "content-type: application/json" \\
  -d '{ "description": "Booking SaaS with payments and emails" }'`}
      />

      <H2 id="skills">Skills</H2>
      <Fields rows={[["GET /skills?q=", "Searches skills on skills.sh (at least 2 characters). The configurator uses it to add skills."]]} />

      <H2 id="mcp">Remote MCP server</H2>
      <P>
        For agents that speak MCP over HTTP: search kits, see their options, recommend and plan the install. It&apos;s read-only; to
        create the project, the agent runs the command it returns (or uses the local <Code>{BRAND.cli} mcp</Code> server).
      </P>
      <CodeBlock code={`claude mcp add --transport http ${BRAND.name} ${BRAND.siteUrl}/mcp`} />
      <P>
        More ways to use it from your agent in <Link href="/docs/agents" className="text-foreground underline underline-offset-4">From your agent</Link>.
      </P>

      <H2 id="account">With your account</H2>
      <P>
        Publishing kits (<Code>POST /kits</Code>), reading brand profiles and downloading private kits need a session or an{" "}
        <Code>Authorization: Bearer kits_…</Code> token you create in <Link href="/account" className="text-foreground underline underline-offset-4">your account</Link>.
        The CLI handles it for you with <Code>login</Code>.
      </P>
    </>
  );
}
