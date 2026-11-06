"use client";

import { ArchiveIcon, ArchiveRestoreIcon, BarChart3Icon, EllipsisIcon, ExternalLinkIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteKitAction, setKitStatusAction } from "./actions";

/** Everything an owner can do with one of their kits, in one menu. */
export function KitActions({ slug, status }: { slug: string; status: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();
  const setStatus = (to: "active" | "retired") =>
    start(async () => {
      const r = await setKitStatusAction(slug, to);
      if (!r.ok) return void toast.error(r.error);
      toast.success(to === "retired" ? "Kit retired: it no longer shows up in the catalog" : "Kit active again");
      router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${slug}`} disabled={pending} />}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/kits/${slug}`)}>
              <ExternalLinkIcon />
              Open kit page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/account/kits/${slug}`)}>
              <BarChart3Icon />
              Statistics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/publish")}>
              <UploadIcon />
              Publish a new version
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {status !== "hidden" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {status === "active" ? (
                  <DropdownMenuItem onClick={() => setStatus("retired")}>
                    <ArchiveIcon />
                    Retire
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setStatus("active")}>
                    <ArchiveRestoreIcon />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${slug}?`}
        description="The kit and all its versions are removed for good and the name becomes free. Projects already created keep working, but they can't update from it. To only hide it, retire it instead."
        confirmText={slug}
        button="Delete kit"
        action={async (typed) => {
          const r = await deleteKitAction(slug, typed);
          return r.ok ? { ok: true } : r;
        }}
        onDone={() => {
          toast.success("Kit deleted");
          router.refresh();
        }}
      />
    </>
  );
}
