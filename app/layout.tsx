import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Firestone Country Smokehouse",
    template: "%s | Firestone Country Smokehouse"
  },
  description: "Premium family-friendly takeaway from Firestone Country Smokehouse",
  applicationName: "Firestone Country Smokehouse",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/logo-bigger.jpg", type: "image/jpeg" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: ["/icons/logo-bigger.jpg"],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Firestone Country Smokehouse",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EFE6",
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">
        <PwaRegister />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
