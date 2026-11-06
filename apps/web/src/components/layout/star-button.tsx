import { REPO_URL } from "@kits/schema";
import { StarIcon } from "lucide-react";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { getRepoStars } from "@/server/github";

/** "★ Star 1.2k" — links to the repo, where GitHub handles the star itself. */
export async function StarButton() {
  const stars = await getRepoStars();
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      render={<a href={REPO_URL} target="_blank" rel="noreferrer" aria-label={`Star on GitHub${stars !== null ? ` (${stars})` : ""}`} />}
      className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
    >
      <TechIcon id="github" label="GitHub" className="size-4" />
      {stars !== null ? (
        <span className="flex items-center gap-1 font-mono text-xs tabular-nums">
          <StarIcon className="size-3" />
          {formatCount(stars)}
        </span>
      ) : (
        <span className="hidden sm:inline">Star</span>
      )}
    </Button>
  );
}
