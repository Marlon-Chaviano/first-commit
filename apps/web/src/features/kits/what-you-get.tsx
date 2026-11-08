import { parseSkillRef, type Kit, type Resolved } from "@kits/schema";
import { BotIcon, ClockIcon, LayersIcon } from "lucide-react";

import { StackLogos, stackLogoKeys } from "@/features/stacks/stack-card";

import { FitBadges } from "./fit-badges";

/**
 * "What you get", above the configurator: the stack as logos, what the agent gets (skills, MCP,
 * AGENTS.md rules) and how long until it's ready. For the kit's defaults; the configurator below
 * changes them.
 */
export function WhatYouGet({ kit, resolved, options, installMinutes }: { kit: Kit; resolved: Resolved; options: Record<string, string[]>; installMinutes: number | null }) {
  const picks = resolved.chosen.flatMap((c) => c.choices.filter((ch) => ch.id !== "none").map((ch) => ch.label));
  const skills = resolved.skills.map((ref) => parseSkillRef(ref).skill);
  const mcp = Object.keys(resolved.mcp);

  return (
    <section aria-labelledby="what-you-get" className="flex flex-col gap-4">
      <h2 id="what-you-get" className="label-mono">
        What you get
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3 md:items-stretch">
        <Card icon={LayersIcon} title="The stack">
          <StackLogos keys={stackLogoKeys(kit.tags, options)} size="lg" />
          {picks.length > 0 && <FitBadges names={picks} variant="outline" className="min-h-[3.75rem] flex-1" />}
        </Card>

        <Card icon={BotIcon} title="For your agent">
          <p className="text-sm text-pretty text-muted-foreground">
            <span className="font-medium text-foreground">{skills.length} skills</span>
            {mcp.length > 0 && (
              <>
                , <span className="font-medium text-foreground">{mcp.length} MCP</span> ({mcp.join(", ")})
              </>
            )}{" "}
            and the project&apos;s rules in <code className="font-mono text-foreground">AGENTS.md</code>.
          </p>
          {/* At least two rows; the rest of the height comes from the tallest fixed content in the row. */}
          <FitBadges names={skills} className="min-h-[3.75rem] flex-1" />
        </Card>

        <Card icon={ClockIcon} title="Ready in">
          {installMinutes ? (
            <>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                ~{installMinutes} min
              </p>
              <p className="text-sm text-pretty text-muted-foreground">Measured in CI with the defaults, including the install and the first build. Faster with a warm package cache.</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold tracking-tight">A few minutes</p>
              <p className="text-sm text-pretty text-muted-foreground">Most of it is installing dependencies and skills. Add --dry-run to see every step first.</p>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof LayersIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </p>
      {children}
    </div>
  );
}
