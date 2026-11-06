import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** "Marlon Chaviano" → "MC"; a single word or a handle gives its first two letters. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** The Google or GitHub profile picture; initials while it loads, if it fails, or for accounts without one. */
export function UserAvatar({ name, image, size = "default", className }: { name: string; image?: string | null; size?: "sm" | "default" | "lg"; className?: string }) {
  return (
    <Avatar size={size} className={className}>
      {/* Google's image host refuses some requests that carry a Referer. */}
      {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className={cn("font-mono font-medium text-foreground", size === "lg" ? "text-base" : "text-xs")}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
