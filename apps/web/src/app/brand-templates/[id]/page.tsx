import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplateDetails } from "@/features/brands/template-details";
import { brandTemplates, findBrandTemplate, templatePath } from "@/features/brands/templates";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return brandTemplates.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/brand-templates/[id]">): Promise<Metadata> {
  const template = findBrandTemplate((await params).id);
  if (!template) notFound();
  return pageMetadata({
    path: templatePath(template.id),
    title: template.title + " brand template",
    description: `Explore the ${template.title}-inspired palette, typography and interface rule. Fork the template to customize a private brand for your projects.`,
  });
}

export default async function BrandTemplatePage({ params }: PageProps<"/brand-templates/[id]">) {
  const template = findBrandTemplate((await params).id);
  if (!template) notFound();
  return <TemplateDetails template={template} />;
}
