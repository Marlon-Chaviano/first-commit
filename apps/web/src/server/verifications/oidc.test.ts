import { VERIFICATION_AUDIENCE } from "@kits/schema";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { GITHUB_OIDC_ISSUER, verifyGithubToken } from "./oidc";

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, opts: { issuer?: string; audience?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(opts.issuer ?? GITHUB_OIDC_ISSUER)
      .setAudience(opts.audience ?? VERIFICATION_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  return { keys, sign };
}

describe("verifyGithubToken", () => {
  it("returns the signed repository and commit", async () => {
    const { keys, sign } = await setup();
    const token = await sign({ repository: "ana/kits", sha: "abc123", job_workflow_ref: "ana/kits/.github/workflows/v.yml@refs/heads/main" });
    await expect(verifyGithubToken(token, keys)).resolves.toEqual({
      repository: "ana/kits",
      sha: "abc123",
      workflowRef: "ana/kits/.github/workflows/v.yml@refs/heads/main",
    });
  });

  it("rejects another audience or issuer", async () => {
    const { keys, sign } = await setup();
    await expect(verifyGithubToken(await sign({ repository: "a/b", sha: "1" }, { audience: "otro" }), keys)).rejects.toThrow();
    await expect(verifyGithubToken(await sign({ repository: "a/b", sha: "1" }, { issuer: "https://evil.example" }), keys)).rejects.toThrow();
  });

  it("rejects a token signed with another key", async () => {
    const { keys } = await setup();
    const other = await setup();
    await expect(verifyGithubToken(await other.sign({ repository: "a/b", sha: "1" }), keys)).rejects.toThrow();
  });
});
