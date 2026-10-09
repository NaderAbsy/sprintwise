import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteAnalytics } from "@/components/site-analytics";
import { EARLY_CLICK_SCRIPT } from "@/lib/early-click-script";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Link previews need absolute image addresses; previews and local builds use their own.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "https://sprintwise-omega.vercel.app"),
  title: { default: "Sprintwise", template: "%s · Sprintwise" },
  description: "Sprintwise checks your stories are ready before the sprint starts, then measures how much the sprint changes.",
  openGraph: { siteName: "Sprintwise", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute differs from the server render.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: EARLY_CLICK_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary"
        >
          Skip to content
        </a>
        {children}
        {/* Only the live site counts visits; previews, local runs and tests don't. */}
        {process.env.VERCEL_ENV === "production" && <SiteAnalytics />}
      </body>
    </html>
  );
}
