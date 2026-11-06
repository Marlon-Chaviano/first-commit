import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join, relative, resolve } from "node:path";

import * as p from "@clack/prompts";
import { BRAND, cliCommand } from "@kits/schema";
import pc from "picocolors";

import type { ParsedArgs } from "./args";

const configDir = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "kits");
const credentialsPath = () => join(configDir(), "credentials.json");
export const apiUrl = () => process.env.KITS_API_URL ?? BRAND.siteUrl;

interface Credentials {
  token: string;
  api: string;
}

/** KITS_TOKEN (CI) or the token saved by `create-first-commit login` for this registry. */
export async function getToken(): Promise<string | null> {
  if (process.env.KITS_TOKEN) return process.env.KITS_TOKEN;
  if (!existsSync(credentialsPath())) return null;
  const saved = JSON.parse(await readFile(credentialsPath(), "utf8")) as Credentials;
  return saved.api === apiUrl() ? saved.token : null;
}

/** `token: ""` sends no credentials at all (login requests). */
async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const token = init.token ?? (await getToken());
  return fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
}

/** Opens a URL in the default browser; false when it can't (SSH, no desktop), so the caller prints it. */
function openBrowser(url: string): boolean {
  if (process.env.SSH_CONNECTION || process.env.CI) return false;
  const [command, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(command, args as string[], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function saveCredentials(token: string): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await writeFile(credentialsPath(), JSON.stringify({ token, api: apiUrl() } satisfies Credentials, null, 2));
  await chmod(credentialsPath(), 0o600);
}

/** Who the saved token (or KITS_TOKEN) belongs to; null if there's none or it stopped working. */
async function currentUser(token?: string): Promise<{ handle: string; role?: string } | null> {
  if (!(token ?? (await getToken()))) return null;
  const res = await api("/api/v1/me", { token }).catch(() => null);
  return res?.ok ? ((await res.json()) as { handle: string; role?: string }) : null;
}

/**
 * `create-first-commit login` — in a terminal it opens the browser: the person checks that the code
 * matches and authorizes, and the CLI receives a token on its own. `--token kits_…` (or KITS_TOKEN)
 * skips the browser, for CI and servers without one.
 */
export async function login(args: ParsedArgs, guard: <T>(v: T) => Exclude<T, symbol>): Promise<void> {
  const given = args.flags.get("token")?.[0] ?? process.env.KITS_TOKEN;
  if (given) {
    const me = await currentUser(given);
    if (!me) throw new Error(`That token is invalid or was revoked. Create one at ${apiUrl()}/account/tokens`);
    await saveCredentials(given);
    console.log(`${pc.green("✓")} Logged in as ${pc.bold(`@${me.handle}`)} ${pc.dim(`· ${apiUrl()}`)}`);
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error(`No terminal to log in from. Pass a token: ${cliCommand("login --token kits_…")} (create one at ${apiUrl()}/account/tokens)`);
  }

  p.intro(pc.bgWhite(pc.black(" login ")));
  const already = await currentUser();
  if (already && !guard(await p.confirm({ message: `You're already logged in as @${already.handle}. Log in again?`, initialValue: false }))) {
    p.outro("Nothing changed.");
    return;
  }

  const start = await api("/api/v1/cli/login", { method: "POST", token: "", body: JSON.stringify({ device: `${hostname().replace(/\.local$/, "")} (${process.platform})` }) }).catch(
    (error: Error) => {
      throw new Error(`Couldn't reach ${apiUrl()}: ${error.message}`);
    },
  );
  const session = (await start.json().catch(() => ({}))) as { id?: string; code?: string; secret?: string; url?: string; interval?: number; expiresIn?: number; error?: string };
  if (!start.ok || !session.id || !session.code || !session.secret || !session.url) throw new Error(session.error ?? `The server answered ${start.status}`);

  const opened = !args.switches.has("no-browser") && openBrowser(session.url);
  p.note(`${pc.bold(session.code.split("").join(" "))}\n\n${opened ? "Opened in your browser. " : ""}${pc.dim(opened ? "If it didn't open:" : "Open:")} ${pc.underline(session.url)}`, "Your code");
  p.log.message(pc.dim("Check that the browser shows the same code, then authorize."));

  const spinner = p.spinner();
  spinner.start("Waiting for you to authorize in the browser");
  const deadline = Date.now() + (session.expiresIn ?? 600) * 1000;
  while (Date.now() < deadline) {
    await sleep((session.interval ?? 2) * 1000);
    const res = await api("/api/v1/cli/login/poll", { method: "POST", token: "", body: JSON.stringify({ id: session.id, secret: session.secret }) }).catch(() => null);
    if (!res || res.status === 202) continue; // still waiting (or a network hiccup: try again)
    if (res.status === 403) {
      spinner.error("Login denied in the browser");
      throw new Error("Denied. Run login again if that was a mistake.");
    }
    if (res.status === 410) break;
    const data = (await res.json()) as { token?: string; handle?: string | null };
    if (!res.ok || !data.token) break;
    await saveCredentials(data.token);
    spinner.stop(`Logged in as ${pc.bold(`@${data.handle ?? "you"}`)}`);
    p.outro(`${pc.dim("Token saved in")} ${credentialsPath()}\n${pc.dim("Revoke it any time at")} ${apiUrl()}/account/tokens`);
    return;
  }
  spinner.error("The code expired");
  throw new Error("The code is valid for 10 minutes. Run login again.");
}

/** `logout` revokes the token on the server too, then forgets it here. */
export async function logout(): Promise<void> {
  const token = existsSync(credentialsPath()) ? ((JSON.parse(await readFile(credentialsPath(), "utf8")) as Credentials).token ?? null) : null;
  if (!token) {
    console.log(pc.dim("You weren't logged in."));
    return;
  }
  const revoked = await api("/api/v1/me/token", { method: "DELETE", token })
    .then((r) => r.ok || r.status === 404)
    .catch(() => false);
  await rm(credentialsPath(), { force: true });
  console.log(
    revoked
      ? `${pc.green("✓")} Logged out ${pc.dim("· the token was revoked")}`
      : `${pc.green("✓")} Logged out here. ${pc.yellow("The server couldn't be reached:")} revoke the token at ${apiUrl()}/account/tokens`,
  );
}

export async function whoami(): Promise<void> {
  const me = await currentUser();
  if (!me) throw new Error(`You're not logged in. Run: ${cliCommand("login")}`);
  const source = process.env.KITS_TOKEN ? "KITS_TOKEN" : credentialsPath();
  console.log(`${pc.bold(`@${me.handle}`)}${me.role === "admin" ? pc.dim(" (admin)") : ""}\n${pc.dim(`${apiUrl()} · token from ${source}`)}`);
}

/**
 * `create-first-commit publish [dir]` — publishes the kit at the current commit. The commit
 * must be pushed: the server downloads exactly what is on GitHub.
 */
export async function publish(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.positionals[0] ?? ".");
  if (!existsSync(join(dir, "kit.json"))) throw new Error(`No kit.json in ${dir}`);
  if (!(await getToken())) throw new Error(`Log in first: ${cliCommand("login")}`);

  let body: Record<string, string>;
  if (args.switches.has("local")) {
    // Development servers only (DEV_LOGIN): publish straight from this folder.
    body = { local: dir };
  } else {
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    let root: string;
    try {
      root = git("rev-parse", "--show-toplevel");
    } catch {
      throw new Error("The kit must be in a git repository published on GitHub");
    }
    const remote = git("remote", "get-url", "origin");
    const repo = remote.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
    if (!repo) throw new Error(`The "origin" remote isn't on GitHub: ${remote}`);
    if (git("status", "--porcelain", "--", dir)) throw new Error("There are uncommitted changes in the kit folder");
    const sha = git("rev-parse", "HEAD");
    if (!git("branch", "-r", "--contains", sha)) throw new Error("The current commit isn't on GitHub: push first");
    body = { repo, path: relative(root, dir), ref: sha };
  }

  // --org acme: into the organization's private registry (members only).
  const org = args.flags.get("org")?.[0];
  if (org) body.org = org;

  const spinner = p.spinner();
  spinner.start(org ? `Validating and publishing to ${org} (private)` : "Validating and publishing");
  const res = await api("/api/v1/kits", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { slug?: string; version?: string; error?: string };
  if (!res.ok) {
    spinner.error("Not published");
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  spinner.stop(`Published ${pc.bold(`${data.slug}@${data.version}`)}`);
  console.log(`  ${cliCommand(`${data.slug}`)}\n  ${apiUrl()}/kits/${data.slug}`);
}
