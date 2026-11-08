import { BRAND } from "@kits/schema";
import type { Metadata } from "next";

import { JsonLd } from "@/components/shared/json-ld";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DocsHeader } from "@/features/docs/docs-ui";

import { FAQ } from "./faq";

export const metadata: Metadata = {
  alternates: { canonical: "/docs/faq" },
  title: "FAQ",
  description: `Quick answers about ${BRAND.name}: pricing, security, supported agents, telemetry and kits.`,
};


export default function FaqDocs() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
        }}
      />
      <DocsHeader title="FAQ">What people ask us most. If it isn&apos;t here, get in touch.</DocsHeader>
      {/* The questions are h3s (Accordion): an h2 keeps the heading order for screen readers. */}
      <h2 className="sr-only">Questions</h2>
      <Accordion className="mt-8">
        {FAQ.map(([question, answer]) => (
          <AccordionItem key={question} value={question}>
            <AccordionTrigger className="text-base">{question}</AccordionTrigger>
            <AccordionContent className="text-pretty text-muted-foreground">{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
