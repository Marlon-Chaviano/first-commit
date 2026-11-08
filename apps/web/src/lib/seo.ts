import { BRAND } from "@kits/schema/light";
import type { Metadata } from "next";

/**
 * Canonical URL, Open Graph and Twitter card for a page, always together. Next replaces (not
 * merges) a parent's openGraph, so each page that sets one repeats the site-wide fields here.
 */
export function pageMetadata({ title, description, path, image }: { title: string; description: string; path: string; image?: { url: string; alt: string } }): Metadata {
  const images = image ? [{ url: image.url, width: 1200, height: 630, alt: image.alt }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: BRAND.name, locale: "en_US", url: path, title, description, ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images } : {}) },
  };
}
