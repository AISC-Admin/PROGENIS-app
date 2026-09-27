import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, reqStr } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Ajoute une ou plusieurs sous-tâches (une par ligne) à une carte.
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const b = await req.json();
  const titles = reqStr(b.title, "Titre", 5000)
    .split("\n")
    .map((l) => l.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 50);
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : null;
  const sql = await db();
  const [t] = await sql`SELECT title FROM tasks WHERE id = ${taskId}`;
  if (!t) bad("Carte introuvable");
  const [{ max }] = await sql`SELECT COALESCE(MAX(position), 0) AS max FROM subtasks WHERE task_id = ${taskId}`;
  let pos = Number(max);
  for (const title of titles) {
    pos += 1;
    await sql`INSERT INTO subtasks (task_id, title, position, color, created_by) VALUES (${taskId}, ${title}, ${pos}, ${color}, ${me.id})`;
  }
  await sql`UPDATE tasks SET updated_at = now() WHERE id = ${taskId}`;
  await logActivity(me.id, `${titles.length} sous-tâche(s) ajoutée(s)`, t.title);
  return { ok: true };
});
