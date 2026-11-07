"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { ACCOUNT_TABS } from "@/lib/site-nav";

/** The menu names the tabs from the person's point of view. */
const MENU_LABELS: Record<string, string> = { "/account/kits": "My kits", "/account/brands": "Brand profiles" };

export function UserMenu() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  if (isPending) return <Skeleton className="size-8 rounded-full" />;
  if (!data) {
    return (
      <Button size="sm" nativeButton={false} render={<Link href="/login" />} className="px-3 font-medium">
        Log in
      </Button>
    );
  }
  const { user } = data;
  const go = (href: string) => () => router.push(href);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" aria-label="Your account" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}
      >
        <UserAvatar name={user.name || user.handle || "?"} image={user.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
            <UserAvatar name={user.name || user.handle || "?"} image={user.image} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
              {user.handle && <span className="truncate font-mono text-xs text-muted-foreground">@{user.handle}</span>}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={go("/account")}>Profile</DropdownMenuItem>
          {ACCOUNT_TABS.map((tab) => (
            <DropdownMenuItem key={tab.href} onClick={go(tab.href)}>
              {MENU_LABELS[tab.href] ?? tab.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={go("/publish")}>Publish a kit</DropdownMenuItem>
          {user.role === "admin" && <DropdownMenuItem onClick={go("/admin")}>Admin</DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              const { error } = await authClient.signOut();
              if (error) return toast.error("Couldn't log out. Try again.");
              // Full navigation: drops the client router cache so no page keeps showing the old session.
              window.location.href = "/";
            }}
          >
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

