import { BRAND, cliCommand } from "@kits/schema";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KitStatusButton } from "@/features/account/kit-status-button";
import { TokensPanel } from "@/features/account/tokens-panel";
import { BillingPanel } from "@/features/billing/billing-panel";
import { OnboardingButton } from "@/features/billing/buttons";
import { LinkGithub } from "@/features/account/link-github";
import { getUserKits, hasGithubAccount } from "@/server/accounts";
import { githubLogin } from "@/server/env";
import { creatorStatus, userPlan } from "@/server/billing";
import { MAX_KITS_PER_ACCOUNT } from "@/server/plans";
import { billingEnabled } from "@/server/stripe";
import { listUserOrgs } from "@/server/orgs";
import { getViewer } from "@/server/session";
import { listApiTokens } from "@/server/tokens";

export const metadata: Metadata = { title: "Tu cuenta" };

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const [owned, tokens, orgs, plan, creator, github] = await Promise.all([
    getUserKits(viewer.id),
    listApiTokens(viewer.id),
    listUserOrgs(viewer.id),
    userPlan(viewer.id),
    creatorStatus(viewer.id),
    hasGithubAccount(viewer.id),
  ]);

  return (
    <>
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="label-mono text-muted-foreground">Tu cuenta</p>
          <h1 className="font-mono text-3xl font-semibold">{viewer.handle}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/cuenta/marcas" />}>Perfiles de marca</Button>
          <Button nativeButton={false} render={<Link href="/publicar" />}>Publicar un kit</Button>
        </div>
      </header>

      {!github && <LinkGithub enabled={githubLogin} />}

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">
          Mis kits <span className="font-normal text-muted-foreground">({owned.filter((k) => k.status !== "retired").length} de {MAX_KITS_PER_ACCOUNT})</span>
        </h2>
        <Separator />
        {owned.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="label-mono text-muted-foreground">Kit</TableHead>
                <TableHead className="label-mono text-muted-foreground">Versión</TableHead>
                <TableHead className="label-mono text-muted-foreground">Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {owned.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <Link href={`/kits/${k.slug}`} className="font-mono hover:underline">
                      {k.slug}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{k.latestVersion}</TableCell>
                  <TableCell>
                    <Badge variant={k.status === "active" ? "outline" : "secondary"}>{STATUS[k.status] ?? k.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/cuenta/kits/${k.slug}`} />}>
                      Estadísticas
                    </Button>
                    {k.status === "active" && <KitStatusButton slug={k.slug} to="retired">Retirar</KitStatusButton>}
                    {k.status === "retired" && <KitStatusButton slug={k.slug} to="active">Reactivar</KitStatusButton>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no has publicado ningún kit. Crea uno con <code className="font-mono">{cliCommand("create")}</code>.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="label-mono">Organizaciones</h2>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/orgs/nueva" />}>
            Nueva organización
          </Button>
        </div>
        <Separator />
        {orgs.length ? (
          <ul className="flex flex-col divide-y">
            {orgs.map(({ org, role }) => (
              <li key={org.id} className="flex items-center justify-between py-2.5">
                <Link href={`/orgs/${org.slug}`} className="font-mono hover:underline">{org.slug}</Link>
                <span className="font-mono text-xs text-muted-foreground">{role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Un registro privado con los kits de tu equipo y una política de bibliotecas comprobada en CI.</p>
        )}
      </section>

      {billingEnabled && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Tu plan</h2>
          <Separator />
          <BillingPanel subject={{ kind: "user" }} plan={plan} canManage />
        </section>
      )}

      {billingEnabled && (
        <section className="flex flex-col gap-4">
          <h2 className="label-mono">Cobros por kits de pago</h2>
          <Separator />
          <p className="text-sm text-muted-foreground">
            {creator?.chargesEnabled
              ? "Tu cuenta de Stripe puede recibir pagos: pon precio a un kit desde sus estadísticas."
              : "Para vender kits necesitas una cuenta de Stripe (Connect). El pago llega a tu cuenta menos la comisión de la plataforma."}
          </p>
          <div>
            <OnboardingButton>{creator ? (creator.chargesEnabled ? "Ver mi cuenta de Stripe" : "Completar la cuenta de cobros") : "Activar cobros"}</OnboardingButton>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="label-mono">Tokens para el CLI y CI</h2>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Para publicar desde la terminal o desde GitHub Actions (variable <code className="font-mono">KITS_TOKEN</code>).
        </p>
        <TokensPanel
          loginCommand={`npx ${BRAND.cli} login`}
          tokens={tokens.map((t) => ({ ...t, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }))}
        />
      </section>
    </>
  );
}

const STATUS: Record<string, string> = { active: "Activo", retired: "Retirado", hidden: "Oculto por moderación" };
