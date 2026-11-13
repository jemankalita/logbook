import { ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Unlock · Logbook" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* Quiet backdrop: a soft light from above and a faint ruled-paper grid that fades out. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(128_152_255/0.10),transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:100%_32px] [mask-image:radial-gradient(60%_55%_at_50%_45%,#000,transparent)]"
      />

      <div className="rise relative w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-12" />
          <h1 className="mt-5 font-display text-[2.5rem] leading-none tracking-[-0.01em]">Logbook</h1>
          <p className="mt-2 text-sm text-muted">Your private second brain.</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-pop">
          <LoginForm next={next} />
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-faint">
          <ShieldCheck className="size-3.5" aria-hidden />
          Only you can open this. Nothing here is public.
        </p>
      </div>
    </main>
  );
}
