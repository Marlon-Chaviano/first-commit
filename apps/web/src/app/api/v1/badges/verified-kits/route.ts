import { getIndex } from "@/server/registry";
import { getVerification } from "@/server/verifications/queries";

/**
 * GET /api/v1/badges/verified-kits — shields.io endpoint badge for the README:
 * https://img.shields.io/endpoint?url=https://first-commit.dev/api/v1/badges/verified-kits
 * Official kits whose current version passed `create-first-commit test` on every platform.
 */
export async function GET() {
  const kits = await getIndex();
  const verified = (await Promise.all(kits.map((k) => getVerification(k.name, k.version)))).filter((v) => v.verified).length;
  return Response.json(
    { schemaVersion: 1, label: "verified kits", message: `${verified}/${kits.length}`, color: "black" },
    { headers: { "cache-control": "public, max-age=3600, s-maxage=3600" } },
  );
}
