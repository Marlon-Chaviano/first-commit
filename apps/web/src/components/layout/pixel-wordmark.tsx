// 5×7 bitmap glyphs, A–Z. Each string is one row; "1" is a pixel.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
};

/**
 * Pixel-art wordmark: solid pixels over an offset outline "shadow".
 * - layout "stacked": one word per line ("first-commit" → FIRST / COMMIT); "inline": one line, hyphen kept.
 * - animated: pixels drop in as a wave from left to right and the outline follows.
 * - cursor: a blinking terminal cursor at the end. CSS only (globals.css: .px-in, .px-cursor); still with reduced motion.
 */
export function PixelWordmark({
  text = "KITS",
  layout = "stacked",
  animated = false,
  cursor: withCursor = false,
  className,
}: {
  text?: string;
  layout?: "stacked" | "inline";
  animated?: boolean;
  /** A blinking terminal cursor after the last letter. */
  cursor?: boolean;
  className?: string;
}) {
  const words = layout === "inline" ? [text] : text.split(/[\s-]+/);
  const lines = words.map((word) => word.toUpperCase().split("").filter((c) => GLYPHS[c])).filter((letters) => letters.length);
  const LINE = 9; // 7 rows of glyph + 2 of leading
  const pixels = lines.flatMap((letters, line) =>
    letters.flatMap((c, li) =>
      GLYPHS[c]!.flatMap((row, y) => [...row].flatMap((on, x) => (on === "1" ? [{ x: li * 6 + x, y: line * LINE + y }] : []))),
    ),
  );
  // The cursor sits after the last letter of the last line: a 4×7 block, like a terminal's.
  const last = lines.at(-1)!;
  const cursor = withCursor ? { x: last.length * 6 + 1, y: (lines.length - 1) * LINE } : null;
  const width = Math.max(...lines.map((l) => l.length * 6 - 1), cursor ? cursor.x + 4 : 0);
  const height = lines.length * LINE - 2;
  const delay = (x: number, y: number) => `${x * 14 + y * 18}ms`;

  return (
    <svg viewBox={`0 0 ${width + 0.6} ${height + 0.6}`} className={className} role="img" aria-label={text} shapeRendering="crispEdges">
      <g fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.08}>
        {pixels.map((p) => (
          <rect
            key={`s${p.x}-${p.y}`}
            x={p.x + 0.55}
            y={p.y + 0.55}
            width={0.92}
            height={0.92}
            className={animated ? "px-in" : undefined}
            style={animated ? { animationDelay: `calc(${delay(p.x, p.y)} + 120ms)` } : undefined}
          />
        ))}
      </g>
      <g fill="currentColor">
        {pixels.map((p) => (
          <rect
            key={`f${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={1.02}
            height={1.02}
            className={animated ? "px-in" : undefined}
            style={animated ? { animationDelay: delay(p.x, p.y) } : undefined}
          />
        ))}
      </g>
      {cursor && <rect x={cursor.x} y={cursor.y} width={4} height={7} fill="currentColor" className="px-cursor" style={{ animationDelay: delay(cursor.x, 0) }} />}
    </svg>
  );
}

/** 2×2 block mark used in the header. */
/**
 * The first-commit symbol: one block on its own (the start), and two that form an open "c" (the commit,
 * a kit already assembled). 8×8 grid of 4-unit cells on a 32-unit box; drawn in currentColor.
 * Source files and every icon: public/brand/ and scripts/brand-assets.sh.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} shapeRendering="crispEdges">
      {title && <title>{title}</title>}
      <path fill="currentColor" d="M4 4H12V12H4Z M16 4H28V12H16Z M4 16H12V20H28V28H4Z" />
    </svg>
  );
}
