import { splitKitRef, verificationReportSchema } from "@kits/schema";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { db } from "@/server/db";
import { kitVerifications } from "@/server/db/schema";
import { canVerify } from "@/server/verifications/authorize";
import { verifyGithubToken } from "@/server/verifications/oidc";
import { getVerification, verificationTag } from "@/server/verifications/queries";

/**
 * POST /api/v1/verifications — a `create-first-commit test --upload` report from GitHub Actions.
 * Authenticated by the job's OIDC token: repository and commit come from GitHub's
 * signature, so a report can only verify kits of the repository that ran it.
 */
export async function POST(request: NextRequest) {
  if (!db) return Response.json({ error: "Verificaciones no disponibles (sin base de datos)" }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Falta el token OIDC de GitHub" }, { status: 401 });
  let claims;
  try {
    claims = await verifyGithubToken(token);
  } catch {
    return Response.json({ error: "Token OIDC no válido" }, { status: 401 });
  }

  const parsed = verificationReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Informe no válido" }, { status: 400 });
  const report = parsed.data;
  const kit = splitKitRef(report.kit).base;
  if (!canVerify(kit, claims.repository)) {
    return Response.json({ error: `${claims.repository} no puede verificar ${kit}` }, { status: 403 });
  }

  await db.insert(kitVerifications).values({
    kit,
    version: report.version,
    ok: report.ok,
    platform: report.platform,
    repository: claims.repository,
    commitSha: claims.sha,
    workflowRef: claims.workflowRef,
    report,
  });
  revalidateTag(verificationTag(kit), { expire: 0 });
  return Response.json({ kit, version: report.version, ok: report.ok }, { status: 201 });
}

/** GET /api/v1/verifications?kit=mobile-expo&version=1.0.0 — used by the CLI before installing. */
export async function GET(request: NextRequest) {
  const kit = request.nextUrl.searchParams.get("kit");
  const version = request.nextUrl.searchParams.get("version");
  if (!kit || !version) return Response.json({ error: "Faltan kit y version" }, { status: 400 });
  return Response.json(await getVerification(splitKitRef(kit).base, version));
}
