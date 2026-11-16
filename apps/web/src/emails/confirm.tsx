import { Heading, Text } from "@react-email/components";

import { Button, EmailLayout, muted } from "./layout";

export function ConfirmEmail({ brand, confirmUrl }: { brand: string; confirmUrl: string }) {
  return (
    <EmailLayout preview={`Confirm your subscription to ${brand}`} brand={brand} footer="If you didn't subscribe, ignore this email: you won't get anything else.">
      <Heading as="h1" style={{ fontSize: 22 }}>Confirm your subscription</Heading>
      <Text style={{ color: muted, fontSize: 15 }}>An email for each new changelog entry: new kits, features and improvements. Unsubscribe at any time.</Text>
      <Button href={confirmUrl}>Confirm</Button>
    </EmailLayout>
  );
}
