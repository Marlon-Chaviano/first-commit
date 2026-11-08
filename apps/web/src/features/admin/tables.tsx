"use client";

import { BadgeCheckIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FeaturedButton } from "@/features/account/featured-button";
import { KitStatusButton } from "@/features/account/kit-status-button";
import type { AdminKit, AdminUser } from "@/server/admin";

import { UserRoleButton, VerifyKitButton } from "./action-button";

const formatDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatNumber = new Intl.NumberFormat("en");

function Toolbar<F extends string>({ query, onQuery, placeholder, filters, filter, onFilter, shown, total }: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  filters: Record<F, string>;
  filter: F;
  onFilter: (f: F) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <InputGroup className="md:max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </InputGroup>
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && onFilter(v[0] as F)} variant="outline" size="sm" className="flex-wrap">
          {(Object.entries(filters) as [F, string][]).map(([id, label]) => (
            <ToggleGroupItem key={id} value={id}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {shown}/{total}
        </span>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

const USER_FILTERS = { all: "All", admins: "Admins", creators: "Creators" } as const;

export function UsersTable({ users, viewerId }: { users: AdminUser[]; viewerId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<keyof typeof USER_FILTERS>("all");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (filter === "all" || (filter === "admins" ? u.role === "admin" || u.adminByConfig : u.kits > 0)) &&
        (!q || [u.name, u.email, u.handle ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [users, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar query={query} onQuery={setQuery} placeholder="Name, email or handle" filters={USER_FILTERS} filter={filter} onFilter={setFilter} shown={shown.length} total={users.length} />
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
                  <TableCell className="font-mono text-xs text-muted-foreground">{formatDate.format(new Date(u.createdAt))}</TableCell>
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
    </div>
  );
}

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

  return (
    <div className="flex flex-col gap-4">
      <Toolbar query={query} onQuery={setQuery} placeholder="Kit, title, owner or repo" filters={KIT_FILTERS} filter={filter} onFilter={setFilter} shown={shown.length} total={kits.length} />
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
            {shown.map((k) => (
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
    </div>
  );
}
