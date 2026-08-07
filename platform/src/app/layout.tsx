import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";

// Platform typeface. `--font-dm-sans` / `--font-jetbrains-mono` are consumed by
// `--font-platform` / `--font-platform-mono` in globals.css. Self-hosted by
// next/font at build time, so they work offline (offline-first requirement).
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
// Carbon's typeface, used only by the OpenMRS-styled surfaces (`--font-omrs`
// in globals.css). Scoped rather than global: the rest of the platform is DM
// Sans, and OpenMRS in anything but Plex reads as an imitation of it.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
import { ToastProvider } from "@/components/Toast";
import TextareaAutoResize from "@/components/TextareaAutoResize";
import BootIntegrityGuard from "@/components/BootIntegrityGuard";

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
  themeColor: "#EFF8FD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetBrainsMono.variable} ${ibmPlexSans.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
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
