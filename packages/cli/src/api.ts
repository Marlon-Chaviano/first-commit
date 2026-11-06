import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { BRAND } from "@kits/schema";

/**
 * The CLI's one client for the registry's HTTP API: base URL, token, user agent, timeout and JSON
 * all live here. It never throws: a network failure is `{ ok: false, status: 0 }`, so each caller only
 * decides what its endpoint's statuses mean (a 402 is a paid kit, a 404 in doctor is "not an org").
 */

/** The registry the CLI talks to; KITS_API_URL points it at another one (e.g. http://localhost:3200). */
export const apiUrl = () => process.env.KITS_API_URL ?? BRAND.siteUrl;

export const configDir = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "kits");
export const credentialsPath = () => join(configDir(), "credentials.json");

export interface Credentials {
  token: string;
  api: string;
}

/** KITS_TOKEN (CI) or the token saved by `login` for this registry. */
export async function getToken(): Promise<string | null> {
  if (process.env.KITS_TOKEN) return process.env.KITS_TOKEN;
  if (!existsSync(credentialsPath())) return null;
  const saved = JSON.parse(await readFile(credentialsPath(), "utf8")) as Credentials;
  return saved.api === apiUrl() ? saved.token : null;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error?: string; body?: Record<string, unknown> };

export interface ApiOptions {
  method?: "GET" | "POST" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  /** "saved" (default): the saved token or KITS_TOKEN, if any. "none": no credentials. Or a token. */
  auth?: "saved" | "none" | string;
  timeoutMs?: number;
  /** "json" (default) or "buffer" (kit archives). */
  as?: "json" | "buffer";
}

let fetcher: typeof fetch = (...args) => fetch(...args);

/** Tests only: answer requests with a fake instead of the network. */
export function useFetch(fake: typeof fetch): () => void {
  const previous = fetcher;
  fetcher = fake;
  return () => {
    fetcher = previous;
  };
}

export async function api<T = unknown>(path: string, { method = "GET", body, auth = "saved", timeoutMs = 10_000, as = "json" }: ApiOptions = {}): Promise<ApiResult<T>> {
  const token = auth === "saved" ? await getToken() : auth === "none" ? null : auth;
  let res: Response;
  try {
    res = await fetcher(`${apiUrl()}${path}`, {
      method,
      headers: {
        "user-agent": BRAND.cli,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { ok: false, status: 0, error: `Couldn't reach ${apiUrl()}: ${(error as Error).message}` };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: false, status: res.status, error: typeof data.error === "string" ? data.error : undefined, body: data };
  }
  if (res.status === 204) return { ok: true, status: 204, data: undefined as T };
  const data = as === "buffer" ? (Buffer.from(await res.arrayBuffer()) as T) : ((await res.json().catch(() => null)) as T);
  return { ok: true, status: res.status, data };
}
