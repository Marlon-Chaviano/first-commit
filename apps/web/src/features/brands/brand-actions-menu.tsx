"use client";

import { BookOpenIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function BrandActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Brand actions" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href="/brands/new" />}><PlusIcon />New brand profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/docs/brands" />}><BookOpenIcon />Brand guide</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
