import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipScan — Thrift Store Profit Finder",
  description:
    "Point your camera at any thrift store item and instantly see its resell value on eBay, Poshmark, Mercari, StockX, and Amazon.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
