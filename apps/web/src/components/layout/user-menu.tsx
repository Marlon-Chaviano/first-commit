"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function UserMenu() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  if (isPending) return <Skeleton className="size-7 rounded-full" />;
  if (!data) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/entrar" />}>
        Entrar
      </Button>
    );
  }
  const { user } = data;
  const go = (href: string) => () => router.push(href);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Tu cuenta" />}>
        <Avatar className="size-7">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="font-mono text-xs uppercase">{(user.handle ?? user.name).slice(0, 2)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono">{user.handle ?? user.name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {user.handle && <DropdownMenuItem onClick={go(`/u/${user.handle}`)}>Perfil</DropdownMenuItem>}
          <DropdownMenuItem onClick={go("/cuenta")}>Mis kits y tokens</DropdownMenuItem>
          <DropdownMenuItem onClick={go("/publicar")}>Publicar un kit</DropdownMenuItem>
          {user.role === "admin" && <DropdownMenuItem onClick={go("/admin")}>Administración</DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            Salir
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
