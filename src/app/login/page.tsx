import { LoginForm } from "./login-form";

export const metadata = { title: "Unlock · Logbook" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-panel-2 text-xl" aria-hidden>
            📓
          </span>
          <div>
            <h1 className="text-lg font-semibold">Logbook</h1>
            <p className="text-sm text-muted">Private. Just you.</p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
