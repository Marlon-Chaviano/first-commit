import { TerminalIcon } from "lucide-react";
import {
  siClaude,
  siCursor,
  siDart,
  siDotnet,
  siElixir,
  siGithub,
  siGithubcopilot,
  siGoogle,
  siGo,
  siGooglegemini,
  siKotlin,
  siOpencode,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  siSwift,
  siTypescript,
  siWindsurf,
  siX,
  type SimpleIcon,
} from "simple-icons";

import { LOGOS } from "@/lib/logos";
import { cn } from "@/lib/utils";

/**
 * Monochrome logos (Simple Icons, CC0) in currentColor, so they follow the
 * black-and-white theme. Only the ones used are imported.
 */
const ICONS: Record<string, SimpleIcon> = {
  "claude-code": siClaude,
  cursor: siCursor,
  "gemini-cli": siGooglegemini,
  "github-copilot": siGithubcopilot,
  windsurf: siWindsurf,
  opencode: siOpencode,
  typescript: siTypescript,
  python: siPython,
  go: siGo,
  ruby: siRuby,
  php: siPhp,
  java: siOpenjdk,
  swift: siSwift,
  rust: siRust,
  kotlin: siKotlin,
  dart: siDart,
  elixir: siElixir,
  csharp: siDotnet,
  github: siGithub,
  x: siX,
  google: siGoogle,
};

/** Logo for an agent id or a language id. Agents without a public logo (Codex) get a neutral terminal icon. */
export function TechIcon({ id, label, className }: { id: string; label: string; className?: string }) {
  const icon = ICONS[id] ?? LOGOS[id];
  if (!icon) return <TerminalIcon role="img" aria-label={label} className={cn("size-4 shrink-0", className)} />;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      <title>{label}</title>
      <path d={icon.path} />
    </svg>
  );
}

/** A library or framework logo, or nothing if there isn't one (no placeholder icon). */
export function TechLogo({ id, label, className }: { id: string; label: string; className?: string }) {
  const icon = LOGOS[id] ?? ICONS[id];
  if (!icon) return null;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      <title>{label}</title>
      <path d={icon.path} />
    </svg>
  );
}
