import { buildInitCommand, resolve } from "@kits/schema";

import { stackLogoKeys } from "@/features/stacks/stack-card";
import { ogCard } from "@/server/og";
import { getStack } from "@/server/stacks";

/** /og/stacks/<stack> — a stack's Open Graph card: the recipe as logos and its exact command. */
export async function GET(_request: Request, { params }: RouteContext<"/og/stacks/[slug]">) {
  const page = await getStack((await params).slug);
  if (!page) return ogCard({ eyebrow: "Stack", title: "Stack not found", description: "Browse the stacks on the site.", logos: [], command: "npx create-first-commit" }, { status: 404 });
  const { stack, kit, selections } = page;
  const resolved = resolve(kit, selections);
  return ogCard({
    eyebrow: "Stack",
    title: stack.title,
    description: stack.description,
    logos: stackLogoKeys(kit.tags, selections.options),
    command: buildInitCommand(kit.name, kit, selections).replace("@latest", ""),
    facts: [`${resolved.skills.length} skills`, ...(Object.keys(resolved.mcp).length ? [`${Object.keys(resolved.mcp).length} MCP`] : [])],
  });
}
