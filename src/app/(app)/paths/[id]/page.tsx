import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { getDb } from "@/db/client";
import { paths } from "@/db/schema";
import { cls } from "@/components/cls";
import { DocEditor } from "@/components/editor/doc-editor";
import { TitleInput } from "@/components/editor/title-input";
import { PathMetaForm } from "@/components/editor/path-meta-form";
import { BackLink, CardHeader, Progress } from "@/components/page-ui";
import { TaskForm, TaskRow } from "@/components/tasks/task-ui";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { today as getToday } from "@/lib/dates";
import { getAreas, getPathOptions, getTasksForPath, getUnlinkedOpenTasks } from "@/lib/queries/tasks";
import { linkTaskToPath } from "../../tasks/actions";
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
  const [pathTasks, pathOptions, areas, unlinked] = await Promise.all([getTasksForPath(path.id), getPathOptions(), getAreas(), getUnlinkedOpenTasks()]);
  const options = { paths: pathOptions, areas };
  const done = pathTasks.filter((t) => t.status === "done").length;
  const pct = pathTasks.length ? Math.round((done / pathTasks.length) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <BackLink href="/paths">Paths</BackLink>
        <div>
          <p className={`${cls.eyebrow} mb-2`}>Path</p>
          <TitleInput initial={path.name} save={renamePath.bind(null, path.id)} label="Path name" placeholder="Untitled path" />
        </div>
        <PathMetaForm id={path.id} emoji={path.emoji} description={path.description} />
        <DocEditor
          initial={isDoc(path.body) ? path.body : null}
          save={savePathBody.bind(null, path.id)}
          label="Path plan"
          placeholder="Write the plan: milestones, resources, timeline…  ([ ] makes a checklist)"
        />
      </div>

      <aside className="flex flex-col gap-4">
        <section className={`${cls.card} p-4`}>
          <CardHeader title="Tasks" action={<span className="tabular text-xs text-faint">{done}/{pathTasks.length} · {pct}%</span>} />
          <div className="mb-4">
            <Progress value={done} max={pathTasks.length} label="Path progress" />
          </div>
          <TaskForm horizon="roadmap" options={options} pathId={path.id} compact />
          <ul className="mt-2 flex flex-col">
            {pathTasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} options={options} />
            ))}
          </ul>
          {pathTasks.length === 0 ? <p className="px-2 py-2 text-sm text-muted">No tasks yet. Tasks you add here also show on the Tasks → Roadmap board.</p> : null}
          {unlinked.length ? (
            <form action={linkTaskToPath.bind(null, path.id)} className="mt-3 flex gap-2 border-t border-line pt-3">
              <label htmlFor="link-task" className="sr-only">
                Add an existing task to this path
              </label>
              <select id="link-task" name="taskId" required defaultValue="" className={`${cls.select} min-w-0 flex-1 text-[13px]`}>
                <option value="" disabled>
                  Add an existing task…
                </option>
                {unlinked.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.horizon === "daily" ? " (daily)" : ""}
                  </option>
                ))}
              </select>
              <SubmitButton pendingLabel="Adding…" className={cls.btn}>
                Add
              </SubmitButton>
            </form>
          ) : null}
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
