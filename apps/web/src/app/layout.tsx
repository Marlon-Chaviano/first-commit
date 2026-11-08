import { AUTHOR, BRAND } from "@kits/schema";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingGuide } from "@/features/onboarding/onboarding-guide";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "One command and your project starts with dependencies, skills and MCP ready for your agent.";

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: from empty folder to first commit`, template: `%s · ${BRAND.name}` },
  metadataBase: new URL(BRAND.siteUrl),
  description: DESCRIPTION,
  applicationName: BRAND.name,
  authors: [{ name: AUTHOR.name, url: AUTHOR.github }],
  creator: AUTHOR.name,
  keywords: ["project starter", "project templates", "AI coding agent", "Claude Code", "Cursor", "Codex", "agent skills", "MCP", "AGENTS.md", "create-first-commit", "scaffolding", "boilerplate"],
  // Pages that set their own openGraph repeat these through pageMetadata (lib/seo.ts).
  openGraph: { type: "website", siteName: BRAND.name, locale: "en_US", title: BRAND.name, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: BRAND.name, description: DESCRIPTION },
  formatDetection: { telephone: false, email: false, address: false },
  // Search Console: the domain is verified by DNS; this only adds the meta tag when the env var is set.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster />
            {/* It reads the pathname: under Suspense so dynamic routes still prerender. */}
            <Suspense fallback={null}>
              <OnboardingGuide />
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
