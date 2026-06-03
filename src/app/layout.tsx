import type { Metadata, Viewport } from "next";
import "./globals.css";

// Brand fonts (Fredoka / Nunito / M PLUS Rounded 1c) load via @import in globals.css so
// the JP face ships its kana glyphs — see BRAND.md §4.

export const metadata: Metadata = {
  // `template` is used by sub-pages later (e.g. "Browse · Bayana").
  title: { default: "Bayana — JLPT vocab trainer", template: "%s · Bayana" },
  description:
    "Learn JLPT Japanese vocabulary with spaced repetition and AI-written example sentences. No setup, no ads — open it and study.",
  applicationName: "Bayana",
  appleWebApp: { capable: true, title: "Bayana", statusBarStyle: "default" },
};

// Mobile-first viewport + theme color (SPEC §8.4; BRAND.md paper).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfaf1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
