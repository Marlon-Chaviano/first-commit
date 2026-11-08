"use client";

import { BadgeCheckIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeaturedButton } from "@/features/account/featured-button";
import { KitStatusButton } from "@/features/account/kit-status-button";
import type { AdminInstall, AdminKit, AdminPage, AdminSubscriber, AdminUser } from "@/server/admin";

import { UserRoleButton, VerifyKitButton } from "./action-button";
import { StatePager, Toolbar, UrlPager, UrlToolbar, usePages } from "./list-controls";

const formatDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatNumber = new Intl.NumberFormat("en");

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

const USER_FILTERS = { all: "All", admins: "Admins", creators: "Creators" } as const;

/** Users are paginated on the server: search, filter and page live in ?uq, ?uf and ?up. */
export function UsersTable({ users, viewerId }: { users: AdminPage<AdminUser>; viewerId: string }) {
  const shown = users.rows;
  return (
    <div className="flex flex-col gap-4">
      <UrlToolbar prefix="u" placeholder="Name, email or handle" filters={USER_FILTERS} />
      {shown.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono text-muted-foreground">User</TableHead>
              <TableHead className="label-mono text-muted-foreground">Sign-in</TableHead>
              <TableHead className="label-mono text-right text-muted-foreground">Kits</TableHead>
              <TableHead className="label-mono text-muted-foreground">Role</TableHead>
              <TableHead className="label-mono text-muted-foreground">Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((u) => {
              const admin = u.role === "admin" || u.adminByConfig;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} image={u.image} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {u.name}
                          {u.id === viewerId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {u.handle ? (
                            <Link href={`/u/${u.handle}`} className="hover:text-foreground hover:underline">
                              @{u.handle}
                            </Link>
                          ) : (
                            "no handle"
                          )}{" "}
                          · {u.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {u.providers.map((p) => (
                        <Badge key={p} variant="outline" className="font-mono">
                          {p === "credential" ? "password" : p}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{u.kits}</TableCell>
                  <TableCell>
                    <Badge variant={admin ? "default" : "outline"}>{admin ? "admin" : "user"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatDate.format(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {u.adminByConfig ? (
                      <span className="text-xs text-muted-foreground">via ADMIN_HANDLES</span>
                    ) : (
                      u.id !== viewerId && <UserRoleButton userId={u.id} role={u.role === "admin" ? "admin" : "user"} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Empty>No users match.</Empty>
      )}
      <UrlPager prefix="u" page={users.page} pageSize={users.pageSize} total={users.total} />
    </div>
  );
}

/** Kits are few (the registry plus the community): they load at once and paginate in the browser. */
const KITS_PER_PAGE = 25;
const KIT_FILTERS = { all: "All", official: "Official", community: "Community", unverified: "Unverified", hidden: "Hidden" } as const;

export function KitsTable({ kits }: { kits: AdminKit[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<keyof typeof KIT_FILTERS>("all");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kits.filter(
      (k) =>
        (filter === "all" ||
          (filter === "official" && k.official) ||
          (filter === "community" && !k.official) ||
          (filter === "unverified" && !k.verified) ||
          (filter === "hidden" && k.status === "hidden")) &&
        (!q || [k.slug, k.title, k.owner ?? "", k.repo].some((v) => v.toLowerCase().includes(q))),
    );
  }, [kits, query, filter]);
  const { rows, pager } = usePages(shown, KITS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar query={query} onQuery={setQuery} placeholder="Kit, title, owner or repo" filters={KIT_FILTERS} filter={filter} onFilter={setFilter} />
      {shown.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
              <TableHead className="label-mono text-muted-foreground">Verification</TableHead>
              <TableHead className="label-mono text-right text-muted-foreground">Installs</TableHead>
              <TableHead className="label-mono text-muted-foreground">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((k) => (
              <TableRow key={k.slug}>
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5">
                      <Link href={`/kits/${k.slug}`} className="font-mono hover:underline">
                        {k.slug}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">v{k.version}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{k.official ? "Official" : `@${k.owner ?? "unknown"} · ${k.repo}`}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {k.verified ? (
                      <Badge>
                        <BadgeCheckIcon data-icon="inline-start" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not verified</Badge>
                    )}
                    {k.platforms.map((p) => (
                      <Badge key={p.platform} variant="outline" className="font-mono" title={`${p.ok ? "passed" : "failed"} · ${formatDate.format(new Date(p.at))}`}>
                        {p.ok ? "✓" : "✗"} {p.platform}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatNumber.format(k.installs)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={k.status === "active" ? "outline" : "secondary"}>{k.status}</Badge>
                    {k.visibility !== "public" && <Badge variant="outline">{k.visibility}</Badge>}
                    {k.featured && <Badge variant="outline">featured</Badge>}
                    {k.openReports > 0 && <Badge variant="destructive">{k.openReports} {k.openReports === 1 ? "report" : "reports"}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <VerifyKitButton slug={k.slug} verified={k.verified} />
                    {!k.official && k.status === "active" && <FeaturedButton slug={k.slug} featured={k.featured} />}
                    {!k.official &&
                      (k.status === "hidden" ? (
                        <KitStatusButton slug={k.slug} to="active">
                          Show
                        </KitStatusButton>
                      ) : (
                        <KitStatusButton slug={k.slug} to="hidden">
                          Hide
                        </KitStatusButton>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>No kits match.</Empty>
      )}
      <StatePager {...pager} />
    </div>
  );
}

const INSTALL_FILTERS = { all: "All", install: "Installs", update: "Updates", add: "Adds" } as const;
const formatDateTime = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** Every CLI event, newest first. Paginated on the server: ?iq (kit), ?if (event) and ?ip (page). */
export function InstallsTable({ installs }: { installs: AdminPage<AdminInstall> }) {
  return (
    <div className="flex flex-col gap-4">
      <UrlToolbar prefix="i" placeholder="Kit" filters={INSTALL_FILTERS} />
      {installs.rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono text-muted-foreground">When (UTC)</TableHead>
              <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
              <TableHead className="label-mono text-muted-foreground">Event</TableHead>
              <TableHead className="label-mono text-muted-foreground">Setup</TableHead>
              <TableHead className="label-mono text-muted-foreground">Agents</TableHead>
              <TableHead className="label-mono text-muted-foreground">Environment</TableHead>
              <TableHead className="label-mono text-muted-foreground">User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installs.rows.map((e) => {
              const options = Object.entries(e.options).filter(([, v]) => v.length && !v.every((c) => c === "none"));
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime.format(e.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-baseline gap-1.5">
                        <Link href={`/kits/${e.kit}`} className="font-mono hover:underline">
                          {e.kit}
                        </Link>
                        {e.kitVersion && <span className="font-mono text-xs text-muted-foreground">v{e.kitVersion}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{e.official ? "Official" : "Community"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.eventType === "install" ? "default" : "outline"}>{e.eventType}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span title={options.map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n") || undefined} className={options.length ? "cursor-help underline decoration-dotted underline-offset-4" : undefined}>
                      {options.length} {options.length === 1 ? "option" : "options"}
                    </span>
                    {" · "}
                    <span title={e.skills.join("\n") || undefined} className={e.skills.length ? "cursor-help underline decoration-dotted underline-offset-4" : undefined}>
                      {e.skills.length} skills
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {e.agents.map((a) => (
                        <Badge key={a} variant="outline" className="font-mono">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {[e.pm, e.os, e.country, `cli ${e.cliVersion}`].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" title={e.anonId}>
                    {e.anonId.slice(0, 8)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Empty>No installs match.</Empty>
      )}
      <UrlPager prefix="i" page={installs.page} pageSize={installs.pageSize} total={installs.total} />
    </div>
  );
}

const SUBSCRIBER_FILTERS = { all: "All", confirmed: "Confirmed", pending: "Pending", unsubscribed: "Unsubscribed" } as const;

/** Newsletter subscribers, paginated on the server: ?nq (email), ?nf (status) and ?np (page). */
export function SubscribersTable({ subscribers }: { subscribers: AdminPage<AdminSubscriber> }) {
  return (
    <div className="flex flex-col gap-4">
      <UrlToolbar prefix="n" placeholder="Email" filters={SUBSCRIBER_FILTERS} />
      {subscribers.rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono text-muted-foreground">Email</TableHead>
              <TableHead className="label-mono text-muted-foreground">Status</TableHead>
              <TableHead className="label-mono text-muted-foreground">Signed up</TableHead>
              <TableHead className="label-mono text-muted-foreground">Confirmed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "confirmed" ? "default" : "outline"}>{s.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{formatDate.format(s.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.confirmedAt ? formatDate.format(s.confirmedAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>No subscribers match.</Empty>
      )}
      <UrlPager prefix="n" page={subscribers.page} pageSize={subscribers.pageSize} total={subscribers.total} />
    </div>
  );
}
