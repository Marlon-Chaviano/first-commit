import { BRAND } from "@kits/schema";

/**
 * Who may publish a verification for a kit:
 *   official kit ("mobile-expo")      → only the registry repository
 *   community kit ("owner/repo/path") → only that repository
 */
export function canVerify(kit: string, repository: string): boolean {
  const repo = repository.toLowerCase();
  if (!kit.includes("/")) return repo === BRAND.repo.toLowerCase();
  const [owner, name] = kit.toLowerCase().split("/");
  return `${owner}/${name}` === repo;
}
