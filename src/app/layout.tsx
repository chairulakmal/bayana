import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // `template` is used by sub-pages later (e.g. "Browse · Bayana").
  title: { default: "Bayana — JLPT vocab trainer", template: "%s · Bayana" },
  description:
    "Learn JLPT Japanese vocabulary with spaced repetition and AI-written example sentences. No setup, no ads — open it and study.",
  applicationName: "Bayana",
  appleWebApp: { capable: true, title: "Bayana", statusBarStyle: "default" },
};

// Mobile-first viewport + theme color (SPEC §8.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
