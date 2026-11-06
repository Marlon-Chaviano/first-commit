import { Heading, Link, Section, Text } from "@react-email/components";

import { EmailLayout, muted } from "./layout";

export interface DigestKit {
  name: string;
  title: string;
  description: string;
  url: string;
}

export interface DigestProps {
  brand: string;
  siteUrl: string;
  unsubscribeUrl: string;
  news: { title: string; items: string[] }[];
  featured: DigestKit[];
  newKits: DigestKit[];
}

export function DigestEmail({ brand, siteUrl, unsubscribeUrl, news, featured, newKits }: DigestProps) {
  const kitList = (kits: DigestKit[]) =>
    kits.map((k) => (
      <Text key={k.name} style={{ fontSize: 15, margin: "0 0 12px" }}>
        <Link href={k.url} style={{ color: "#000", fontWeight: 600 }}>{k.title}</Link>
        <br />
        <span style={{ color: muted }}>{k.description}</span>
      </Text>
    ));
  return (
    <EmailLayout
      preview={news[0]?.title ?? featured[0]?.title ?? newKits[0]?.title ?? `What's new at ${brand}`}
      brand={brand}
      footer={
        <>
          Recibes esto porque te suscribiste en <Link href={siteUrl}>{siteUrl.replace(/^https?:\/\//, "")}</Link>.{" "}
          <Link href={unsubscribeUrl}>Unsubscribe</Link>
        </>
      }
    >
      {news.map((n) => (
        <Section key={n.title}>
          <Heading as="h2" style={{ fontSize: 18 }}>{n.title}</Heading>
          {n.items.map((item) => (
            <Text key={item} style={{ color: muted, fontSize: 15, margin: "0 0 6px" }}>— {item}</Text>
          ))}
        </Section>
      ))}
      {featured.length > 0 && (
        <Section>
          <Heading as="h2" style={{ fontSize: 18 }}>Featured</Heading>
          {kitList(featured)}
        </Section>
      )}
      {newKits.length > 0 && (
        <Section>
          <Heading as="h2" style={{ fontSize: 18 }}>New community kits</Heading>
          {kitList(newKits)}
        </Section>
      )}
    </EmailLayout>
  );
}
