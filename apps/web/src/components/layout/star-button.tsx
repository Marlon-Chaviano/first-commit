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
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<a href={REPO_URL} target="_blank" rel="noreferrer" aria-label={`Dar una estrella en GitHub${stars !== null ? ` (${stars})` : ""}`} />}
      className="gap-1.5"
    >
      <TechIcon id="github" label="GitHub" className="size-3.5" />
      <span className="hidden sm:inline">Star</span>
      <StarIcon className="size-3.5 text-muted-foreground sm:hidden" />
      {stars !== null && <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatCount(stars)}</span>}
    </Button>
  );
}
