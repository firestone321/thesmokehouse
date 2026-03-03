import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Bebas_Neue, Manrope } from "next/font/google";
import "./globals.css";

const headingFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "The Smoke House",
  description: "Premium family-friendly smokehouse takeaway",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/the_smoke_house_badge_logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: ["/icons/the_smoke_house_badge_logo.svg"],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#F4EFE6"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="font-body">
        {children}
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
