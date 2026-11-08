"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Light, dark or the system's. Dark keeps the class `dark-theme`, not `dark`: shadcn's `dark:`
 * variants were never part of this design, and the dark site must look exactly as before.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange value={{ light: "light", dark: "dark-theme" }}>
      {children}
    </NextThemes>
  );
}

const THEMES = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const;

/** Header button: the sun or the moon (chosen by CSS, so nothing flips after hydration) and a menu. */
export function ThemeMenu({ className }: { className?: string }) {
  const { theme = "system", setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Theme" className={className} />}>
        <SunIcon className="hidden [.light_&]:block" />
        <MoonIcon className="[.light_&]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(String(v))}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phone menu: the three themes side by side. */
export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  return (
    <ToggleGroup variant="outline" size="sm" value={[theme]} onValueChange={(v: string[]) => v[0] && setTheme(v[0])} aria-label="Theme">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} className="gap-1.5">
          <Icon />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
