import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/require-session";
import { buildBackup, isBackupTokenValid } from "@/lib/backup";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Full JSON export. Two ways in:
 * - signed in (the "Download backup" button), or
 * - `Authorization: Bearer $BACKUP_TOKEN` (the scheduled backup job, which also keeps the database awake).
 * Middleware skips this path so the token caller isn't redirected to /login; auth happens here instead.
 */
export async function GET(request: NextRequest) {
  const viaToken = isBackupTokenValid(request.headers.get("authorization"), process.env.BACKUP_TOKEN);
  if (!viaToken) {
    try {
      await requireSession();
    } catch (err) {
      // requireSession throws "Not signed in." when signed out; anything else is a real failure (e.g. the database).
      if (err instanceof Error && err.message === "Not signed in.") {
        return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: NO_STORE });
      }
      console.error("[backup] session check failed", err);
      return NextResponse.json({ error: "Backup failed." }, { status: 500, headers: NO_STORE });
    }
  }

  try {
    const backup = await buildBackup(await getDb());
    return new NextResponse(JSON.stringify(backup), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="logbook-backup-${today()}.json"`,
      },
    });
  } catch (err) {
    console.error("[backup] export failed", err);
    return NextResponse.json({ error: "Backup failed." }, { status: 500, headers: NO_STORE });
  }
}
