import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { ToastProvider } from "@/components/Toast";
import TextareaAutoResize from "@/components/TextareaAutoResize";
import BootIntegrityGuard from "@/components/BootIntegrityGuard";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TamamHealth — Every Patient Deserves to Be Remembered",
  description: "Offline-first health records for South Sudan and Africa, built to keep patient stories connected from the bedside to the nation.",
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
  // Allow pinch-zoom (accessibility — don't lock to 1) and draw under device
  // notches / rounded corners so the PWA fills the whole screen on mobile.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2191D0" },
    { media: "(prefers-color-scheme: dark)", color: "#015697" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" className={`${dmSans.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/logos/SVG/Tamam_Style_Guide-33.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/assets/logos/SVG/Tamam_Style_Guide-33.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <BootIntegrityGuard />
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
