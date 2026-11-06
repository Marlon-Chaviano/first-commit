import { BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DocsHeader } from "@/features/docs/docs-ui";
import { CONTACT_EMAIL } from "@/lib/site-nav";
import { MAX_KITS_PER_ACCOUNT } from "@/server/plans";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Quick answers about ${BRAND.name}: pricing, security, supported agents, telemetry and kits.`,
};

const FAQ: [string, string][] = [
  ["How much does it cost?", `Nothing. Creating projects, publishing kits and using the API are free. The only limit is anti-spam: ${MAX_KITS_PER_ACCOUNT} published kits per account.`],
  [
    "Which agents does it work with?",
    "Any agent that reads AGENTS.md or skills: Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf and OpenCode. You pick the agents when creating the project and the CLI installs the skills and MCP for each one.",
  ],
  [
    "Is it safe to run a kit?",
    "Before running anything, the CLI shows the full plan (every command, every file) and asks for confirmation. Official kits are checked by hash; verified ones passed a full install in GitHub Actions. With an unverified community kit, review the plan; in -y mode the CLI requires --allow-commands.",
  ],
  [
    "How is it different from create-next-app or a GitHub template?",
    "It runs the same official framework command, but also installs the stack you choose (auth, database, payments, UI…), the skills for your agent and the rules in AGENTS.md. And the project stays connected to the kit: update brings in its improvements and add adds pieces from the catalog.",
  ],
  [
    `What's the ${BRAND.name} pack?`,
    "A selection of general-purpose skills that work in any project (plan, debug methodically, verify before finishing, review, improve the architecture and find skills). It's on in every kit, and you can turn it off or drop individual skills.",
  ],
  ["Can I use it without a terminal?", "Yes. Every kit has a \"Prompt\" tab: copy a prompt, paste it into your agent and it runs the commands and explains each step."],
  [
    "What data does the CLI collect?",
    "It only counts installs anonymously (the kit, options and agents chosen) for the ranking. It never sends project names, paths or code. Turn it off with DO_NOT_TRACK=1.",
  ],
  ["How do I create my own kit?", `Inside a project you already like: ${cliCommand("create")}. It detects the framework, your libraries, skills and MCP, and writes the kit.json. Then ${cliCommand("test")} and ${cliCommand("publish")}.`],
  ["Can I have private kits for my company?", "Yes: organizations get a private registry (publish --org) and brand profiles with their colors, fonts, rules and documentation."],
  ["I found a bug or want to suggest a kit", `Open an issue on GitHub or write to ${CONTACT_EMAIL}.`],
];

export default function FaqDocs() {
  return (
    <>
      <DocsHeader title="FAQ">What people ask us most. If it isn&apos;t here, get in touch.</DocsHeader>
      <Accordion className="mt-8">
        {FAQ.map(([question, answer]) => (
          <AccordionItem key={question} value={question}>
            <AccordionTrigger className="text-base">{question}</AccordionTrigger>
            <AccordionContent className="text-pretty text-muted-foreground">{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
