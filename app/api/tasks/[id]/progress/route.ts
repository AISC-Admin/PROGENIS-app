import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, reqStr, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Ajoute une pastille d'avancement (étape + % + note).
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const b = await req.json();
  const percent = Math.max(0, Math.min(100, Math.round(Number(b.percent) || 0)));
  const stage = reqStr(b.stage, "Étape", 60);
  const sql = await db();
  const [t] = await sql`SELECT title FROM tasks WHERE id = ${taskId}`;
  if (!t) bad("Tâche introuvable");
  const [p] = await sql`
    INSERT INTO task_progress (task_id, user_id, stage, percent, note)
    VALUES (${taskId}, ${me.id}, ${stage}, ${percent}, ${str(b.note, 2000)}) RETURNING *`;
  await sql`UPDATE tasks SET updated_at = now(), done = ${percent === 100} WHERE id = ${taskId}`;
  // Ajouter une pastille vaut prise en charge
  await sql`INSERT INTO task_assignees (task_id, user_id) VALUES (${taskId}, ${me.id}) ON CONFLICT DO NOTHING`;
  await logActivity(me.id, `Avancement ${percent}% (${stage})`, t.title);
  return { progress: p };
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const pid = id(new URL(req.url).searchParams.get("pid"));
  const sql = await db();
  const [p] = await sql`SELECT * FROM task_progress WHERE id = ${pid} AND task_id = ${taskId}`;
  if (!p) bad("Pastille introuvable");
  if (me.role !== "manager" && p.user_id !== me.id) throw new HttpError(403, "Vous ne pouvez supprimer que vos propres pastilles.");
  await sql`DELETE FROM task_progress WHERE id = ${pid}`;
  const [last] = await sql`SELECT percent FROM task_progress WHERE task_id = ${taskId} ORDER BY created_at DESC LIMIT 1`;
  await sql`UPDATE tasks SET done = ${last?.percent === 100}, updated_at = now() WHERE id = ${taskId}`;
  return { ok: true };
});
