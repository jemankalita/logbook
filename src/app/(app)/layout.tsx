import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { requirePageSession } from "@/lib/auth/require-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already checked the cookie; this also enforces "sign out everywhere".
  await requirePageSession();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
      <CommandPalette />
    </div>
  );
}
