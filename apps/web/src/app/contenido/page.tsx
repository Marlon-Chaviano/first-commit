import { BRAND } from "@kits/schema";
import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/legal-page";

export const metadata: Metadata = { title: "Política de contenido", description: `Qué kits se pueden publicar en ${BRAND.name}.` };

export default function ContentPolicyPage() {
  return (
    <LegalPage title="Política de contenido" updated="2026-11-04">
      <p>Un kit ejecuta comandos en el equipo de quien lo instala. Por eso estas reglas son estrictas.</p>
      <h2>No se permite</h2>
      <ul>
        <li>Malware, puertas traseras, mineros de criptomonedas o comandos que hagan algo distinto de lo que describe el kit.</li>
        <li>Robar o enviar credenciales, variables de entorno, código o datos del usuario.</li>
        <li>Skills o reglas de AGENTS.md que instruyan al agente a saltarse la confirmación del usuario, desactivar protecciones o actuar contra sus intereses.</li>
        <li>Suplantar a otra persona, empresa o proyecto, o usar su marca para confundir.</li>
        <li>Contenido ilegal, o que infrinja licencias o derechos de terceros.</li>
        <li>Spam: kits vacíos, duplicados o creados solo para posicionar enlaces.</li>
      </ul>
      <h2>Cómo se aplica</h2>
      <p>Cualquiera puede denunciar un kit desde su página. Un administrador lo revisa y puede ocultarlo (deja de aparecer y de instalarse desde el registro). Las infracciones graves suponen la suspensión de la cuenta. Los kits de pago ocultados por incumplir esta política se reembolsan a los compradores.</p>
    </LegalPage>
  );
}
