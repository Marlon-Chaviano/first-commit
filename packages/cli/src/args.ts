export interface ParsedArgs {
  command?: string;
  positionals: string[];
  /** --flag value / --flag=value. Repeated flags accumulate. */
  flags: Map<string, string[]>;
  /** Flags given without a value (--dry-run, -y). */
  switches: Set<string>;
}

const SWITCHES = new Set(["dry-run", "yes", "no-git", "no-skills", "help", "version", "blank", "only-defaults", "skip-skills", "upload", "allow-commands", "local", "force", "json", "offline", "keep", "verbose", "no-browser", "no-badge"]);
const ALIASES: Record<string, string> = { y: "yes", h: "help", v: "version" };

/**
 * Tiny argv parser. Kit options are dynamic (--styling, --backend...), so a
 * schema-driven parser doesn't fit: every --name takes a value unless it is a
 * known switch.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { positionals: [], flags: new Map(), switches: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--") || (arg.startsWith("-") && arg.length === 2)) {
      let name = arg.replace(/^--?/, "");
      let value: string | undefined;
      const eq = name.indexOf("=");
      if (eq !== -1) {
        value = name.slice(eq + 1);
        name = name.slice(0, eq);
      }
      name = ALIASES[name] ?? name;
      if (SWITCHES.has(name)) {
        out.switches.add(name);
        continue;
      }
      if (value === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("-")) throw new Error(`--${name} needs a value`);
        value = next;
        i++;
      }
      out.flags.set(name, [...(out.flags.get(name) ?? []), value]);
    } else if (!out.command) {
      out.command = arg;
    } else {
      out.positionals.push(arg);
    }
  }
  return out;
}

/** Values of a flag, splitting comma-separated lists. */
export function listFlag(args: ParsedArgs, name: string): string[] | undefined {
  const values = args.flags.get(name);
  if (!values) return undefined;
  return values.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}
