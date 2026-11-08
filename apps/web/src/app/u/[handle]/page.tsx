import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount } from "@/lib/format";
import { getProfile } from "@/server/accounts";
import { getLeaderboard } from "@/server/metrics/queries";
import { getIndex } from "@/server/registry";

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  return { title: (await params).handle };
}

export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Profile handle={params.then((p) => p.handle)} />
      </Suspense>
    </div>
  );
}

async function Profile({ handle }: { handle: Promise<string> }) {
  const profile = await getProfile((await handle).toLowerCase());
  if (!profile) notFound();
  // Official kits are signed with the author's handle in kit.json: they belong on that profile too.
  const official = (await getIndex()).filter((e) => e.author === profile.user.handle).map((e) => ({ slug: e.name, title: e.title }));
  const kits = [...official, ...profile.kits.map((k) => ({ slug: k.slug, title: k.title }))];
  const stats = await getLeaderboard(kits.map((k) => k.slug));
  const total = kits.reduce((sum, k) => sum + (stats.allTime[k.slug] ?? 0), 0);

  return (
    <>
      <header className="flex items-center gap-4">
        <Avatar className="size-14">
          {profile.user.image && <AvatarImage src={profile.user.image} alt="" />}
          <AvatarFallback className="font-mono uppercase">{profile.user.handle.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold">{profile.user.handle}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.user.name} · {kits.length} kits · {formatCount(total)} installs ·{" "}
            <a href={`https://github.com/${profile.user.handle}`} className="hover:underline">
              GitHub
            </a>
          </p>
        </div>
      </header>
      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Kits</h2>
        <Separator />
        {kits.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
                <TableHead className="label-mono w-24 text-right text-muted-foreground">Installs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kits.map((k) => (
                <TableRow key={k.slug}>
                  <TableCell className="max-w-0">
                    <Link href={`/kits/${k.slug}`} className="flex items-baseline gap-2">
                      <span className="shrink-0 font-semibold">{k.slug}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{k.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCount(stats.allTime[k.slug] ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No kits published yet.</p>
        )}
      </section>
    </>
  );
}
