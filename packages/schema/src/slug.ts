/**
 * "Acme Inc." → "acme-inc": lowercase letters, numbers and single hyphens, accents dropped.
 * The one slug rule for brands, organizations, anchors and CLI-generated names.
 */
export function slugify(text: string, max = 60): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");
}

/** Project folder names the CLI accepts: letters, numbers, dots, hyphens and underscores. */
export const isProjectName = (name: string) => /^[\w.-]+$/.test(name);
