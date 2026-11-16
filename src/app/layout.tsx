import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { parseTheme, THEME_COLOR, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

async function currentTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display face for page titles — gives the logbook its "written page" character. */
const displaySerif = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Logbook",
  description: "A private logbook — links, notes, tasks, and daily progress.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: { apple: "/pwa-icon/180" },
  appleWebApp: { capable: true, title: "Logbook", statusBarStyle: "black-translucent" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return { themeColor: THEME_COLOR[theme], colorScheme: theme };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await currentTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
