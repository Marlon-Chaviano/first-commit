import { buildInitCommand, resolve } from "@kits/schema";

import { stackLogoKeys } from "@/features/stacks/stack-card";
import { ogCard } from "@/server/og";
import { getKitPage } from "@/server/registry";
import { getSharedConfig } from "@/server/share";

/** /og/k/<id> — a shared configuration's card: the kit, the stack that was picked and its exact command. */
export async function GET(_request: Request, { params }: RouteContext<"/og/k/[id]">) {
  const shared = await getSharedConfig((await params).id);
  const page = shared ? await getKitPage(shared.kit) : null;
  if (!shared || !page || page.meta.visibility !== "public") {
    return ogCard({ eyebrow: "Shared setup", title: "Link not found", description: "Browse the kits on the site.", logos: [], command: "npx create-first-commit" }, { status: 404 });
  }
  const resolved = resolve(page.kit, shared.selections);
  const picks = resolved.chosen.flatMap((c) => c.choices.filter((ch) => ch.id !== "none").map((ch) => ch.label));
  return ogCard({
    eyebrow: "Shared setup",
    title: page.kit.title,
    description: picks.length ? picks.join(" · ") : page.kit.description,
    logos: stackLogoKeys(page.kit.tags, shared.selections.options),
    command: buildInitCommand(shared.kit, page.kit, shared.selections, shared.name ?? undefined).replace("@latest", ""),
    facts: [`${resolved.skills.length} skills`, ...(Object.keys(resolved.mcp).length ? [`${Object.keys(resolved.mcp).length} MCP`] : [])],
  });
}
