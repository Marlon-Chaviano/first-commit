import { buildInitCommand, defaultSelections, resolve } from "@kits/schema";

import { stackLogoKeys } from "@/features/stacks/stack-card";
import { ogCard } from "@/server/og";
import { getKitPage } from "@/server/registry";
import { getVerification } from "@/server/verifications/queries";

/** /og/kits/<kit> — the kit's Open Graph card: name, description, its stack as logos and the command. */
export async function GET(_request: Request, { params }: RouteContext<"/og/kits/[...slug]">) {
  const slug = (await params).slug.join("/");
  const page = await getKitPage(slug);
  // Private kits get no card: it would reveal that they exist.
  if (!page || page.meta.visibility !== "public") {
    return ogCard({ eyebrow: "Kit", title: "Kit not found", description: "Browse the kits on the site.", logos: [], command: "npx create-first-commit" }, { status: 404 });
  }
  const { kit, meta } = page;
  const selections = defaultSelections(kit);
  const resolved = resolve(kit, selections);
  const { verified } = await getVerification(slug, meta.version);
  return ogCard({
    eyebrow: meta.official ? "Official kit" : `Community kit${meta.owner ? ` by @${meta.owner.handle}` : ""}`,
    title: kit.title,
    description: kit.description,
    logos: stackLogoKeys(kit.tags, selections.options),
    command: buildInitCommand(slug, kit, selections).replace("@latest", ""),
    facts: [...(verified ? ["Verified"] : []), `${resolved.skills.length} skills`, ...(Object.keys(resolved.mcp).length ? [`${Object.keys(resolved.mcp).length} MCP`] : [])],
  });
}
