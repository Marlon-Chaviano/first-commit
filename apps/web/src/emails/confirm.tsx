import { Heading, Text } from "@react-email/components";

import { Button, EmailLayout, muted } from "./layout";

export function ConfirmEmail({ brand, confirmUrl }: { brand: string; confirmUrl: string }) {
  return (
    <EmailLayout preview={`Confirma tu suscripción a ${brand}`} brand={brand} footer="Si no te has suscrito, ignora este email: no recibirás nada más.">
      <Heading as="h1" style={{ fontSize: 22 }}>Confirma tu suscripción</Heading>
      <Text style={{ color: muted, fontSize: 15 }}>Una vez por semana: kits nuevos, destacados de la comunidad y novedades. Nada más.</Text>
      <Button href={confirmUrl}>Confirmar</Button>
    </EmailLayout>
  );
}
