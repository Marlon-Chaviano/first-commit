import { BRAND } from "@kits/schema";
import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Privacidad", description: `Qué datos trata ${BRAND.name} y para qué.` };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="2026-11-04">
      <p>
        Responsable: [titular y contacto, fase 8]. Esta política explica qué datos trata {BRAND.name} (la web, la API y el CLI{" "}
        <code className="font-mono">{BRAND.cli}</code>) y para qué.
      </p>
      <h2>Telemetría del CLI</h2>
      <p>Cada instalación envía, de forma anónima: el kit y su versión, las opciones elegidas, los agentes, el gestor de paquetes, la versión del CLI, el sistema operativo y un identificador aleatorio guardado en tu equipo. Nunca se envían nombres de proyecto, rutas, código ni tu IP (el país se deduce en el servidor y la IP no se guarda). Se usa para el ranking y las estadísticas de los creadores. Se desactiva con <code className="font-mono">DO_NOT_TRACK=1</code>.</p>
      <h2>Cuentas</h2>
      <p>Al entrar con GitHub recibimos tu nombre, email, avatar y usuario de GitHub. Se usan para identificarte, publicar kits y gestionar organizaciones. Los tokens del CLI se guardan solo como hash.</p>
      <h2>Newsletter</h2>
      <p>Tu email, solo si te suscribes y lo confirmas. Cada envío incluye un enlace para darte de baja con un clic.</p>
      <h2>Pagos</h2>
      <p>Los cobros los procesa Stripe: los datos de tu tarjeta van directamente a Stripe y nunca pasan por nuestros servidores. Guardamos el estado de tu suscripción o de tus compras.</p>
      <h2>Denuncias</h2>
      <p>Guardamos el contenido de la denuncia y un hash de la IP (con sal) para evitar abusos; el contacto es opcional.</p>
      <h2>Cookies</h2>
      <p>Solo la cookie de sesión al iniciar sesión. No hay cookies de publicidad ni de seguimiento de terceros.</p>
      <h2>Proveedores</h2>
      <ul>
        <li>Vercel (alojamiento), Neon (base de datos), Upstash (contadores y colas), Resend (emails), Stripe (pagos), Sentry (errores), Anthropic (recomendador, solo la descripción que escribes).</li>
      </ul>
      <h2>Tus derechos</h2>
      <p>Puedes pedir acceso, rectificación o borrado de tus datos y de tu cuenta escribiendo a [email de contacto]. Los eventos de telemetría son anónimos y no se pueden asociar a una persona.</p>
    </LegalPage>
  );
}
