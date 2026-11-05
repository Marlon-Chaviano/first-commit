import { Body, Container, Head, Hr, Html, Link, Preview, Text } from "@react-email/components";

/** Black and white, like the site. Inline styles: email clients ignore stylesheets. */
export const ink = "#000000";
export const muted = "#555555";
export const font = "Geist, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";

export function EmailLayout({ preview, brand, footer, children }: { preview: string; brand: string; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#ffffff", color: ink, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, padding: "0 20px" }}>
          <Text style={{ fontFamily: "Geist Mono, Menlo, monospace", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>{brand}</Text>
          {children}
          <Hr style={{ borderColor: "#e5e5e5", margin: "32px 0 16px" }} />
          <Text style={{ color: muted, fontSize: 12 }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ backgroundColor: ink, borderRadius: 6, color: "#ffffff", display: "inline-block", fontSize: 14, padding: "10px 16px", textDecoration: "none" }}>
      {children}
    </Link>
  );
}
