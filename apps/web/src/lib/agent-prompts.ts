import { BRAND, cliCommand, KITS_SKILL } from "@kits/schema";

/**
 * Prompts for people who don't use a terminal: they paste one into their agent
 * (Claude Code, Cursor, Codex…) and the agent does the work, explaining each step.
 * Every prompt starts by installing the first-commit skill, which teaches the agent the CLI.
 */
const [skillRepo, skillName] = KITS_SKILL.split("@") as [string, string];
const INSTALL_SKILL = `npx skills@latest add ${skillRepo} --skill ${skillName}`;
const TONE = "I'm not technical: explain in plain words what you'll do at each step and ask me before installing anything.";

/** Start a new project, with a given kit or letting the agent recommend one. */
export function newProjectPrompt(kit?: { title: string; command: string }): string {
  const choose = kit
    ? `2. I'll use the "${kit.title}" kit. Show me what it will install without running anything:\n   ${kit.command} --dry-run`
    : `2. Ask me what I want to build (who it's for and what it should do) and recommend the kit that fits best. You can list the kits with:\n   ${cliCommand("list")}\n   Then show me what it will install, without running anything:\n   ${cliCommand("<kit> my-project --dry-run")}`;
  return `I want to start a new project in this folder with ${BRAND.name} (${BRAND.siteUrl}). ${TONE}

1. Install the ${BRAND.name} skill so you know how to use it:
   ${INSTALL_SKILL}
${choose}
3. When I say yes, create the project with the same command, without --dry-run and with --yes.
4. Read the project's AGENTS.md and follow its first steps. Tell me which accounts or keys I need to create myself and how to get them.`;
}

/** Turn the current project into a reusable kit (and publish it if they want). */
export function createKitPrompt(): string {
  return `I want to turn this project into a ${BRAND.name} kit so I can start my next projects the same way. ${TONE}

1. Install the ${BRAND.name} skill:
   ${INSTALL_SKILL}
2. Create the kit from this folder, answering whatever you can work out yourself; only ask me for the name and description:
   ${cliCommand("create")}
3. Explain what the kit includes (dependencies, skills, options) and, if you think something should be removed or added, suggest it.
4. Check that it works: ${cliCommand("test ./kit")}
5. If I want to share it, help me publish it with ${cliCommand("login")} and ${cliCommand("publish ./kit")}.`;
}

/** Capture a company's colors, fonts and rules as a brand profile. */
export function brandPrompt(): string {
  return `I want to save my company's identity (colors, fonts and design rules) to use it in all my projects with ${BRAND.name}. ${TONE}

1. Install the ${BRAND.name} skill:
   ${INSTALL_SKILL}
2. If this project already has the brand, detect it: ${cliCommand("brand detect")}
   If I only have the website or the logo, ask me for them and get the colors and fonts from there (you can use the extract-design-system skill). Write the result to brand.json in the format described at ${BRAND.siteUrl}/docs/brands.
3. Show me the colors and fonts you found and correct them with me.
4. Apply it to this project: ${cliCommand("brand ./brand.json")}`;
}
