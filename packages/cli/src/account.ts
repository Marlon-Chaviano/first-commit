import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
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

/** KITS_TOKEN (CI) wins over the saved login. */
/** KITS_TOKEN (CI) or the token saved by `create-first-commit login` for this registry. */
export async function getToken(): Promise<string | null> {
  if (process.env.KITS_TOKEN) return process.env.KITS_TOKEN;
  if (!existsSync(credentialsPath())) return null;
  const saved = JSON.parse(await readFile(credentialsPath(), "utf8")) as Credentials;
  return saved.api === apiUrl() ? saved.token : null;
}

async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const token = init.token ?? (await getToken());
  return fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
}

/** `create-first-commit login [--token kits_…]` — tokens are created at <site>/cuenta. */
export async function login(args: ParsedArgs, guard: <T>(v: T) => Exclude<T, symbol>): Promise<void> {
  let token = args.flags.get("token")?.[0] ?? process.env.KITS_TOKEN;
  if (!token) {
    if (!process.stdin.isTTY) throw new Error("Pasa el token con --token o KITS_TOKEN");
    p.log.info(`Crea un token en ${apiUrl()}/cuenta`);
    token = guard(await p.password({ message: "Pega tu token (kits_…)" }));
  }
  const res = await api("/api/v1/me", { token });
  if (!res.ok) throw new Error("El token no es válido o ha sido revocado");
  const me = (await res.json()) as { handle: string };
  await mkdir(configDir(), { recursive: true });
  await writeFile(credentialsPath(), JSON.stringify({ token, api: apiUrl() } satisfies Credentials, null, 2));
  await chmod(credentialsPath(), 0o600);
  console.log(`${pc.green("✓")} Sesión iniciada como ${pc.bold(me.handle)} en ${apiUrl()}`);
}

export async function logout(): Promise<void> {
  await rm(credentialsPath(), { force: true });
  console.log("Sesión cerrada.");
}

export async function whoami(): Promise<void> {
  const res = await api("/api/v1/me");
  if (!res.ok) throw new Error(`No has iniciado sesión. Ejecuta: ${cliCommand("login")}`);
  const me = (await res.json()) as { handle: string; role: string };
  console.log(`${me.handle}${me.role === "admin" ? pc.dim(" (admin)") : ""} · ${apiUrl()}`);
}

/**
 * `create-first-commit publish [dir]` — publishes the kit at the current commit. The commit
 * must be pushed: the server downloads exactly what is on GitHub.
 */
export async function publish(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.positionals[0] ?? ".");
  if (!existsSync(join(dir, "kit.json"))) throw new Error(`No hay kit.json en ${dir}`);
  if (!(await getToken())) throw new Error(`Inicia sesión primero: ${cliCommand("login")}`);

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
      throw new Error("El kit debe estar en un repositorio git publicado en GitHub");
    }
    const remote = git("remote", "get-url", "origin");
    const repo = remote.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1];
    if (!repo) throw new Error(`El remoto "origin" no es de GitHub: ${remote}`);
    if (git("status", "--porcelain", "--", dir)) throw new Error("Hay cambios sin commitear en la carpeta del kit");
    const sha = git("rev-parse", "HEAD");
    if (!git("branch", "-r", "--contains", sha)) throw new Error("El commit actual no está en GitHub: haz push primero");
    body = { repo, path: relative(root, dir), ref: sha };
  }

  // --org acme: into the organization's private registry (members only).
  const org = args.flags.get("org")?.[0];
  if (org) body.org = org;

  const spinner = p.spinner();
  spinner.start(org ? `Validando y publicando en ${org} (privado)` : "Validando y publicando");
  const res = await api("/api/v1/kits", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { slug?: string; version?: string; error?: string };
  if (!res.ok) {
    spinner.error("No se publicó");
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  spinner.stop(`Publicado ${pc.bold(`${data.slug}@${data.version}`)}`);
  console.log(`  ${cliCommand(`${data.slug}`)}\n  ${apiUrl()}/kits/${data.slug}`);
}
