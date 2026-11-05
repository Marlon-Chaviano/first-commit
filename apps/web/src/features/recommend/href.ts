/** Recommended options travel in the kit page URL: /kits/landing-next?animation=motion&why=… */
export const REASON_PARAM = "why";

export function recommendationHref(kit: string, options: Record<string, string[]>, reasons: string[]): string {
  const params = new URLSearchParams();
  for (const [id, values] of Object.entries(options)) params.set(id, values.length ? values.join(",") : "none");
  for (const reason of reasons) params.append(REASON_PARAM, reason);
  return `/kits/${kit}?${params}`;
}

/** Reads them back: option id → choice ids, and the reasons. */
export function readRecommendation(params: Record<string, string | string[] | undefined>): { options: Record<string, string[]>; reasons: string[] } {
  const options: Record<string, string[]> = {};
  let reasons: string[] = [];
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const values = ([] as string[]).concat(raw);
    if (key === REASON_PARAM) reasons = values.map((r) => r.slice(0, 300)).slice(0, 6);
    else options[key] = values.flatMap((v) => v.split(",")).filter((v) => v && v !== "none");
  }
  return { options, reasons };
}
