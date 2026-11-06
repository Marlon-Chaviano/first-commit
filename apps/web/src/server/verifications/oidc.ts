import "server-only";

import { VERIFICATION_AUDIENCE } from "@kits/schema";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const githubKeys = createRemoteJWKSet(new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`));

/** The claims kits relies on; GitHub signs them, so they can't be forged by the uploader. */
export interface GithubClaims {
  repository: string;
  sha: string;
  workflowRef?: string;
}

/** Verifies a GitHub Actions OIDC token. `keys` is injectable for tests. */
export async function verifyGithubToken(token: string, keys: JWTVerifyGetKey = githubKeys): Promise<GithubClaims> {
  const { payload } = await jwtVerify(token, keys, { issuer: GITHUB_OIDC_ISSUER, audience: VERIFICATION_AUDIENCE });
  if (typeof payload.repository !== "string" || typeof payload.sha !== "string") {
    throw new Error("The token doesn't include repository or sha");
  }
  return {
    repository: payload.repository,
    sha: payload.sha,
    workflowRef: typeof payload.job_workflow_ref === "string" ? payload.job_workflow_ref : undefined,
  };
}
