import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
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
  title: "Logbook",
  description: "A private logbook — links, notes, tasks, and daily progress.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { apple: "/pwa-icon/180" },
  appleWebApp: { capable: true, title: "Logbook", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#191919",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
