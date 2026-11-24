"use client";

import { BookOpenIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function BrandActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label="New brand profile" />}>
        <PlusIcon /> New <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href="/brands/new" />}><PlusIcon />New brand profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/brands/new?source=github" />}><TechIcon id="github" label="" />From GitHub</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/docs/brands" />}><BookOpenIcon />Brand guide</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
