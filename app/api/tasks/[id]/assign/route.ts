import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// « Je m'en occupe » : un éditeur se positionne (ou se retire) sur une tâche.
// Le manager peut aussi positionner un autre membre (userId).
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const b = await req.json().catch(() => ({}));
  let userId = me.id;
  if (b.userId !== undefined && Number(b.userId) !== me.id) {
    if (me.role !== "manager") throw new HttpError(403, "Seul le manager peut attribuer une tâche à un autre membre.");
    userId = id(b.userId);
  }
  const sql = await db();
  const [t] = await sql`SELECT title FROM tasks WHERE id = ${taskId}`;
  if (!t) bad("Tâche introuvable");
  const [u] = await sql`SELECT name FROM users WHERE id = ${userId} AND active`;
  if (!u) bad("Membre introuvable");
  if (b.take === false) {
    await sql`DELETE FROM task_assignees WHERE task_id = ${taskId} AND user_id = ${userId}`;
    await logActivity(me.id, `${u.name} se retire d'une tâche`, t.title);
  } else {
    await sql`INSERT INTO task_assignees (task_id, user_id) VALUES (${taskId}, ${userId}) ON CONFLICT DO NOTHING`;
    await logActivity(me.id, `${u.name} prend en charge une tâche`, t.title);
  }
  await sql`UPDATE tasks SET updated_at = now() WHERE id = ${taskId}`;
  return { ok: true };
});
