import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, oneOf, optDate, str } from "@/lib/api";

const PRIORITIES = ["basse", "normale", "haute", "urgente"] as const;
type Ctx = { params: Promise<{ id: string }> };

// Modifie une carte : contenu, étiquettes, ou déplacement (column_id + position).
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [t] = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (!t) bad("Carte introuvable");

  let columnId = t.column_id;
  let done = typeof b.done === "boolean" ? b.done : t.done;
  let movedTo: string | null = null;
  if (b.column_id !== undefined && Number(b.column_id) !== t.column_id) {
    const [col] = await sql`SELECT * FROM board_columns WHERE id = ${id(b.column_id)}`;
    if (!col) bad("Colonne introuvable");
    columnId = col.id;
    done = col.is_done; // arriver dans « Terminé » marque la carte comme terminée
    movedTo = col.title;
  }
  let position = typeof b.position === "number" && Number.isFinite(b.position) ? b.position : t.position;
  if (movedTo && typeof b.position !== "number") {
    // changement de colonne sans position précise : la carte va en bas de la colonne
    const [{ max }] = await sql`SELECT COALESCE(MAX(position), 0) AS max FROM tasks WHERE column_id = ${columnId}`;
    position = Number(max) + 1;
  }

  const [task] = await sql`
    UPDATE tasks SET
      column_id = ${columnId}, position = ${position},
      title = ${b.title !== undefined ? str(b.title, 200).trim() || t.title : t.title},
      description = ${b.description !== undefined ? str(b.description, 5000) : t.description},
      priority = ${b.priority !== undefined ? oneOf(b.priority, PRIORITIES, t.priority) : t.priority},
      due_date = ${b.due_date !== undefined ? optDate(b.due_date) : t.due_date},
      done = ${done}, updated_at = now()
    WHERE id = ${taskId} RETURNING *`;

  if (Array.isArray(b.label_ids)) {
    const ids = b.label_ids.map(Number).filter(Number.isInteger);
    await sql`DELETE FROM task_labels WHERE task_id = ${taskId} AND NOT (label_id = ANY(${ids}))`;
    if (ids.length)
      await sql`INSERT INTO task_labels (task_id, label_id) SELECT ${taskId}, l.id FROM labels l WHERE l.id = ANY(${ids}) ON CONFLICT DO NOTHING`;
  }
  if (movedTo) await logActivity(me.id, `Carte déplacée vers « ${movedTo} »`, task.title);
  return { task };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const taskId = id((await ctx.params).id);
  const sql = await db();
  const [t] = await sql`SELECT * FROM tasks WHERE id = ${taskId}`;
  if (!t) bad("Carte introuvable");
  if (me.role !== "manager" && t.created_by !== me.id)
    throw new HttpError(403, "Seul le créateur de la carte ou le manager peut la supprimer.");
  await sql`DELETE FROM tasks WHERE id = ${taskId}`;
  await logActivity(me.id, "Carte supprimée", t.title);
  return { ok: true };
});
