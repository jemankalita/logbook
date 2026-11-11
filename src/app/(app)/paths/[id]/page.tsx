import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getDb } from "@/db/client";
import { paths } from "@/db/schema";
import { cls } from "@/components/cls";
import { DocEditor } from "@/components/editor/doc-editor";
import { TitleInput } from "@/components/editor/title-input";
import { PathMetaForm } from "@/components/editor/path-meta-form";
import { TaskForm, TaskRow } from "@/components/tasks/task-ui";
import { ConfirmButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { today as getToday } from "@/lib/dates";
import { getAreas, getPathOptions, getTasksForPath } from "@/lib/queries/tasks";
import { isDoc } from "@/lib/rich-text";
import { deletePath, renamePath, savePathBody } from "../actions";

export const dynamic = "force-dynamic";

async function getPath(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = await getDb();
  const [row] = await db.select().from(paths).where(eq(paths.id, id)).limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const path = await getPath((await params).id);
  return { title: `${path?.name ?? "Path"} · Logbook` };
}

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const path = await getPath((await params).id);
  if (!path) notFound();
  const today = getToday();
  const [pathTasks, pathOptions, areas] = await Promise.all([getTasksForPath(path.id), getPathOptions(), getAreas()]);
  const options = { paths: pathOptions, areas };
  const done = pathTasks.filter((t) => t.status === "done").length;
  const pct = pathTasks.length ? Math.round((done / pathTasks.length) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Link href="/paths" className={`${cls.btnGhost} self-start`}>
          <ArrowLeft className="size-4" aria-hidden /> Paths
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {path.emoji ?? "🧭"}
          </span>
          <div className="flex-1">
            <TitleInput initial={path.name} save={renamePath.bind(null, path.id)} label="Path name" placeholder="Untitled path" />
          </div>
        </div>
        <PathMetaForm id={path.id} emoji={path.emoji} description={path.description} />
        <div className="pt-6">
          <DocEditor
            initial={isDoc(path.body) ? path.body : null}
            save={savePathBody.bind(null, path.id)}
            label="Path plan"
            placeholder="Write the plan: milestones, resources, timeline…  ([ ] makes a checklist)"
          />
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <section className={`${cls.card} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Tasks</h2>
            <span className="tabular text-sm text-muted">
              {done}/{pathTasks.length} · {pct}%
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Path progress">
            <div className="h-full bg-success" style={{ width: `${pct}%` }} />
          </div>
          <TaskForm horizon="roadmap" options={options} pathId={path.id} compact />
          <ul className="mt-2 flex flex-col">
            {pathTasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} options={options} />
            ))}
          </ul>
          {pathTasks.length === 0 ? <p className="px-2 py-2 text-sm text-muted">No tasks yet. Tasks you add here also show on the Tasks → Roadmap board.</p> : null}
        </section>
        <form action={deletePath.bind(null, path.id)}>
          <ConfirmButton message={`Delete the path “${path.name}”? Its tasks are kept.`}>
            <Trash2 className="size-4" aria-hidden /> Delete path
          </ConfirmButton>
        </form>
      </aside>
    </div>
  );
}
