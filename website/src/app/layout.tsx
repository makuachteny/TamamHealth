import type { Metadata } from "next";
import "./globals.css";

const TITLE = "TamamHealth — Digital Health Records for South Sudan";
const DESCRIPTION =
  "South Sudan's clinics run on paper-based records that get lost, damaged, or destroyed. TamamHealth brings digital records that work offline, so care never starts from zero.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tamamhealth.org"),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://tamamhealth.org",
    siteName: "TamamHealth",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout, applies site-wide */}
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
