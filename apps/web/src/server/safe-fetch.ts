import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a user-supplied URL without letting it reach our own network (SSRF):
 * http(s) on standard ports only, every hop's host must resolve to a public
 * address, redirects are followed by hand, with a timeout and a size cap.
 */
export class UnsafeUrlError extends Error {}

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivate(mapped[1]!) : false;
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Solo direcciones http o https");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Puerto no permitido");
  if (url.username || url.password) throw new UnsafeUrlError("La dirección no puede llevar usuario ni contraseña");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new UnsafeUrlError(`No se encuentra ${url.hostname}`);
  if (addresses.some((a) => isPrivate(a.address))) throw new UnsafeUrlError("Esa dirección no es pública");
}

export async function safeFetchText(input: string, { maxBytes = 1_000_000, timeoutMs = 8000, accept = "text/html,text/css,*/*" } = {}): Promise<{ url: string; text: string }> {
  let url = new URL(input);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { accept, "user-agent": "Mozilla/5.0 (compatible; brand-detector)" } });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`${url.hostname} respondió ${res.status}`);
    // Read at most maxBytes, then stop downloading.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { url: url.toString(), text: new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes)) };
  }
  throw new Error("Demasiadas redirecciones");
}
