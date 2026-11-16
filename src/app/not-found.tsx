import { NotFoundCard } from "@/components/not-found-card";

export const metadata = { title: "Not found · Logbook" };

/** Unknown URLs (outside any section) — rendered without the app shell. */
export default function RootNotFound() {
  return (
    <main className="min-h-dvh px-4 py-10">
      <NotFoundCard />
    </main>
  );
}
