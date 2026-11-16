import { cookies } from "next/headers";
import { CommandPalette } from "@/components/command-palette";
import { MobileNav } from "@/components/mobile-nav";
import { MotionProvider } from "@/components/motion-ui";
import { Sidebar } from "@/components/sidebar";
import { requirePageSession } from "@/lib/auth/require-session";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already checked the cookie; this also enforces "sign out everywhere".
  await requirePageSession();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <MotionProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar theme={theme} />
        <MobileNav theme={theme} />
        <main className="relative min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-20 md:pt-12">
          {/* A whisper of light at the top of the canvas so the page doesn't read as a flat slab. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,var(--glow),transparent)]" />
          {children}
        </main>
        <CommandPalette />
      </div>
    </MotionProvider>
  );
}
