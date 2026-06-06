import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { ToastProvider } from "@/components/Toast";
import TextareaAutoResize from "@/components/TextareaAutoResize";

export const metadata: Metadata = {
  title: "TamamHealth — Digital Health Records for South Sudan",
  description: "Offline-first hospital record system for South Sudan's public hospital network",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TamamHealth",
  },
  applicationName: "TamamHealth",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff6ff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e3a8a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/tamamhealth-icon.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <AppProvider>
          <ToastProvider>
            <TextareaAutoResize />
            {children}
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
