import { cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";

import { PromptBlock } from "@/components/shared/prompt-block";
import { Cmd, Code, CodeBlock, DocsHeader, Fields, H2, P } from "@/features/docs/docs-ui";
import { brandPrompt } from "@/lib/agent-prompts";

export const metadata: Metadata = {
  title: "Brand profiles",
  description: "A company's colors, fonts, interface rules and documentation, applied to any kit with --brand.",
};

const EXAMPLE = `{
  "name": "web",
  "title": "Acme",
  "colors": { "primary": "#e11d48", "primaryForeground": "#ffffff", "background": "#ffffff", "foreground": "#0a0a0a" },
  "fonts": { "sans": "Inter" },
  "radius": "0.75rem",
  "voice": "Friendly and direct.",
  "rules": ["Primary buttons always use the primary color", "Lucide icons, never emojis"],
  "docs": { "style-guide.md": "# Style guide\\n\\n…" }
}`;

export default function BrandsDocs() {
  return (
    <>
      <DocsHeader title="Brand profiles">
        If you build several projects for the same client or for your company, save its identity once (colors, fonts, interface
        rules, voice and documentation) and apply it to any kit. The agent follows it from the first commit, without you explaining it every time.
      </DocsHeader>

      <H2 id="prompt">Prompt</H2>
      <P>Paste this prompt into your agent: it detects the brand (from the project, the website or the logo), reviews it with you and applies it.</P>
      <div className="mt-3">
        <PromptBlock text={brandPrompt()} />
      </div>

      <H2 id="create">Create a profile</H2>
      <P>
        In <Link className="underline underline-offset-4" href="/brands">Brand profiles</Link>, with a live preview.
        It can be yours or an organization&apos;s (all its members use it). A local file works too:
      </P>
      <CodeBlock code={EXAMPLE} />
      <P>
        Only have the client&apos;s website? Ask your agent to extract the colors and fonts with the{" "}
        <Code>extract-design-system</Code> skill and write the <Code>brand.json</Code>.
      </P>

      <H2 id="use">Use it</H2>
      <Cmd>{cliCommand("landing-next --brand acme/web")}</Cmd>
      <P>In an existing project (also to update it when the profile changes):</P>
      <Cmd>{cliCommand("brand acme/web")}</Cmd>
      <Cmd>{cliCommand("brand ./brand.json")}</Cmd>

      <H2 id="what-it-writes">What it writes</H2>
      <Fields
        rows={[
          ["docs/brand/BRAND.md", "Colors, typography, shape, voice and rules, for people and agents."],
          ["docs/brand/tokens.json", "The same values as design tokens, for projects that aren't web (mobile, emails…)."],
          ["docs/brand/*.md", "The company documentation you added to the profile."],
          ["Global stylesheet", "--brand-* variables and the shadcn/ui ones (--primary, --background…) at the end of the file, in a block that's rewritten on update."],
          ["AGENTS.md", "A block with the rules: use only the brand's tokens, fonts and voice."],
        ]}
      />
      <P>
        Anything you write outside those blocks is left alone. The project remembers the profile in <Code>kits.lock</Code>: just run{" "}
        <Code>{cliCommand("brand")}</Code> to bring in the new version.
      </P>
    </>
  );
}
