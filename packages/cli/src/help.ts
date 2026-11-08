import { AGENTS, BRAND } from "@kits/schema";
import pc from "picocolors";

const CLI = `npx ${BRAND.cli}`;

type Row = [usage: string, what: string];

/** `command <args> [optional]`: the command in cyan, its arguments dimmed, like the site's code. */
const usage = (text: string) => text.replace(/^(\S+)/, (c) => pc.cyan(c)).replace(/(<[^>]+>|\[[^\]]+\])/g, (a) => pc.dim(a));

function section(title: string, rows: Row[], width: number): string {
  return `${pc.bold(title)}\n${rows.map(([u, what]) => `  ${usage(u)}${" ".repeat(Math.max(2, width - u.length))}${what}`).join("\n")}`;
}

const START: Row[] = [
  ["<kit> [name]", "create a project from a kit (no kit: pick one)"],
  ["list", "the official kits"],
  ["info <kit>", "a kit's options and skills"],
];
const PROJECT: Row[] = [
  ["update [version]", "bring in the kit's improvements (never touches files you changed)"],
  ["add <library|skill>", "add sentry, posthog… or owner/repo@skill"],
  ["doctor [--json]", "check that the project still follows its rules"],
  ["brand <owner/name>", "apply a brand profile (colors, fonts, logo, rules)"],
  ["brand detect [folder]", "write a brand.json from a project's styles"],
];
const CREATORS: Row[] = [
  ["create [folder]", "turn a project into a kit (--blank <name> for an empty one)"],
  ["test [kit]", "install and build the kit with several option combinations"],
  ["publish [folder]", "publish the kit at the current commit (--org <org> for a private one)"],
];
const ACCOUNT: Row[] = [
  ["login", "log in from the browser (--token kits_… in CI)"],
  ["logout", "log out and revoke the token"],
  ["whoami", "who you're logged in as"],
  ["mcp", "MCP server for agents (stdio)"],
];
const CREATE_OPTIONS: Row[] = [
  ["--<option> <value>", "pick one of the kit's options (see info <kit>)"],
  ["--agent <a,b>", `agents: ${AGENTS.map((a) => a.id).join(", ")}`],
  ["--pm <npm|pnpm|bun>", "package manager"],
  ["--brand <owner/name>", "start with a brand profile (or ./brand.json)"],
  ["--skill <owner/repo@skill>", "add a skill (repeatable); --no-skill removes one, --no-skills all"],
  ["--dry-run", "show the plan without running anything"],
  ["--verbose", "show every command's output instead of the progress bar"],
  ["--no-git", "skip the initial commit"],
  ["--no-badge", "don't add the \"Started with first-commit\" badge to README.md"],
  ["-y, --yes", "no questions: use the defaults (--allow-commands for unverified kits)"],
];

const EXAMPLES = [
  `${CLI}`,
  `${CLI} saas-next-supabase my-app --payments stripe`,
  `${CLI} landing-next site --brand acme/web --agent claude-code,cursor`,
  `${CLI} ana/landing --dry-run`,
];

/** `--help`: what someone needs at a glance, grouped by what they're doing. */
export function helpText(version: string): string {
  const width = Math.max(...[...START, ...PROJECT, ...CREATORS, ...ACCOUNT, ...CREATE_OPTIONS].map(([u]) => u.length)) + 3;
  return [
    "",
    `${pc.bold(BRAND.name)} ${pc.dim(`v${version}`)}  ${pc.dim("workspaces ready to build with your agent")}`,
    "",
    `${pc.bold("Usage")}  ${CLI} ${pc.dim("<command> [options]")}`,
    "",
    section("Start", START, width),
    "",
    section("Inside a project", PROJECT, width),
    "",
    section("Create and publish kits", CREATORS, width),
    "",
    section("Account and agents", ACCOUNT, width),
    "",
    section("Options when creating", CREATE_OPTIONS, width),
    "",
    `${pc.bold("Examples")}`,
    ...EXAMPLES.map((e) => `  ${pc.dim("$")} ${e}`),
    "",
    pc.dim(`Kits: mobile-expo (official) · user/repo[/path] (GitHub) · ./path (local).  Docs: ${BRAND.siteUrl}/docs/cli`),
    pc.dim("Installs are counted anonymously (kit, options, agents). Turn it off with DO_NOT_TRACK=1."),
    "",
  ].join("\n");
}

/** Edit distance, for "Did you mean…?" on a mistyped kit or command. */
export function closest(input: string, candidates: string[], max = 3): string[] {
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0]!;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j]!;
        row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length]!;
  };
  return candidates
    .map((c) => ({ c, d: c.includes(input) || input.includes(c) ? 1 : distance(input, c) }))
    .filter(({ c, d }) => d <= Math.max(2, Math.floor(c.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ c }) => c);
}

const COMMAND_HELP: Record<string, { usage: string; what: string; options: Row[] }> = {
  create: {
    usage: "create [folder]",
    what: "Reads a project (framework, libraries, skills, MCP…) and writes a kit.json you can publish.",
    options: [
      ["--out <folder>", "where to write the kit (default ./kit)"],
      ["--name, --title, --description, --category", "fill in the kit's details without questions"],
      ["--include <paths>", "your own files to copy, comma-separated"],
      ["--base \"<command>\"", "the command that creates the project, if the framework isn't recognized"],
      ["--blank <name>", "an empty kit to write by hand"],
      ["-y, --yes", "no questions"],
    ],
  },
  test: {
    usage: "test [kit]",
    what: "Installs and builds the kit with several option combinations, then runs its checks.",
    options: [
      ["--only-defaults", "test only the defaults"],
      ["--max <n>", "maximum number of combinations"],
      ["--timeout <min>", "maximum time per command (20)"],
      ["--report <file>", "where to write the report (kits-test-report.json)"],
      ["--skip-skills", "don't check that the skills exist"],
      ["--keep", "keep the test projects (deleted by default)"],
      ["--upload", "send the signed report (GitHub Actions only)"],
    ],
  },
  login: {
    usage: "login",
    what: "Opens the browser: check that the code matches the terminal's and authorize. The token is saved for this registry.",
    options: [
      ["--token <kits_…>", "use a token instead of the browser (CI, servers); also KITS_TOKEN"],
      ["--no-browser", "print the link instead of opening it"],
    ],
  },
};

/** `<command> --help` for commands with their own options; null when there's nothing beyond the main help. */
export function commandHelp(command: string): string | null {
  const help = COMMAND_HELP[command];
  if (!help) return null;
  const width = Math.max(...help.options.map(([u]) => u.length)) + 3;
  return ["", `${pc.bold("Usage")}  ${CLI} ${usage(help.usage)}`, "", help.what, "", section("Options", help.options, width), ""].join("\n");
}
