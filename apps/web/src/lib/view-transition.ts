/** A view-transition-name for a kit's element, the same on the list and on its page ("ana/landing" → "kit-icon-ana-landing"). */
export const kitTransitionName = (part: "icon" | "name", kit: string) => `kit-${part}-${kit.replace(/[^a-zA-Z0-9-]/g, "-")}`;
