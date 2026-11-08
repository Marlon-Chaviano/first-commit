/**
 * A README badge in the site's black and white: label on black, value on white. Width comes from a
 * fixed per-character estimate (Verdana 11px), like shields.io's flat style.
 */
export function badgeSvg(label: string, value: string): string {
  const width = (text: string) => Math.round(text.length * 6.6 + 12);
  const lw = width(label);
  const vw = width(value);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<rect width="${lw}" height="20" fill="#000"/>
<rect x="${lw}" width="${vw}" height="20" fill="#fff" stroke="#000"/>
<g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14" fill="#fff">${esc(label)}</text>
<text x="${lw + vw / 2}" y="14" fill="#000">${esc(value)}</text>
</g>
</svg>`;
}
