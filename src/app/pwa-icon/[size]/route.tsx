import { ImageResponse } from "next/og";
import { LogbookMark } from "@/components/logbook-mark";

const SIZES = new Set([180, 192, 512]);

/** App icons for the manifest, generated at build time (no binary files in the repo). */
export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size: String(size) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<LogbookMark size={size} />, { width: size, height: size });
}
