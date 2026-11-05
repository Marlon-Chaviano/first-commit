import { BRAND } from "@kits/schema";
import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Términos", description: `Condiciones de uso de ${BRAND.name}.` };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso" updated="2026-11-04">
      <p>Al usar {BRAND.name} (web, API, CLI, servidor MCP) aceptas estas condiciones. Titular: [titular, fase 8].</p>
      <h2>Qué es</h2>
      <p>Un registro de plantillas de proyecto. Instalar un kit ejecuta en tu equipo los comandos que define, que también instalan software de terceros. El CLI te muestra el plan antes de ejecutarlo; revísalo, sobre todo en kits de la comunidad sin verificar.</p>
      <h2>Kits de la comunidad</h2>
      <p>Los publica cada creador, que es responsable de su contenido y conserva sus derechos. Al publicar nos das permiso para alojarlo, mostrarlo y distribuirlo a quien lo instale. Deben cumplir la <a className="underline underline-offset-4" href="/contenido">política de contenido</a>.</p>
      <h2>Kits de pago</h2>
      <p>Los vende su creador; la plataforma cobra una comisión y Stripe procesa el pago. La compra es un pago único que da acceso a todas las versiones del kit. Se puede pedir el reembolso en los 14 días siguientes escribiendo a [email de contacto].</p>
      <h2>Planes</h2>
      <p>Pro y Equipos se renuevan cada mes hasta que los cancelas desde el portal de facturación; la cancelación es efectiva al final del periodo pagado. Equipos se factura por miembro.</p>
      <h2>Sin garantías</h2>
      <p>El servicio se ofrece tal cual. No garantizamos que un kit funcione en tu entorno ni que esté libre de errores, y no respondemos de daños derivados de ejecutarlo, en la medida que permita la ley.</p>
      <h2>Suspensión</h2>
      <p>Podemos ocultar kits o suspender cuentas que incumplan estas condiciones o la política de contenido.</p>
    </LegalPage>
  );
}
