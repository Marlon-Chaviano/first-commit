import { Heading, Text } from "@react-email/components";

import { EmailLayout, muted } from "./layout";

export function OrgCodeEmail({ brand, code, org }: { brand: string; code: string; org: string }) {
  return (
    <EmailLayout preview={`${code} is your ${brand} verification code`} brand={brand} footer="If you didn't try to create an organization, ignore this email.">
      <Heading as="h1" style={{ fontSize: 22 }}>Verify your work email</Heading>
      <Text style={{ color: muted, fontSize: 15 }}>Enter this code to create the {org} organization. It expires in 10 minutes.</Text>
      <Text style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 32, fontWeight: 600, letterSpacing: 8, margin: "24px 0" }}>{code}</Text>
    </EmailLayout>
  );
}
