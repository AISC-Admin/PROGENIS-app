import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await requireEditor();
  const colId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [c] = await sql`SELECT * FROM board_columns WHERE id = ${colId}`;
  if (!c) bad("Colonne introuvable");
  const [column] = await sql`
    UPDATE board_columns SET
      title = ${b.title !== undefined ? str(b.title, 60).trim() || c.title : c.title},
      position = ${typeof b.position === "number" && Number.isFinite(b.position) ? b.position : c.position},
      is_done = ${typeof b.is_done === "boolean" ? b.is_done : c.is_done}
    WHERE id = ${colId} RETURNING *`;
  return { column };
});

// Suppression : colonne vide pour un éditeur ; le manager peut supprimer une colonne et ses cartes.
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const colId = id((await ctx.params).id);
  const sql = await db();
  const [c] = await sql`SELECT * FROM board_columns WHERE id = ${colId}`;
  if (!c) bad("Colonne introuvable");
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM tasks WHERE column_id = ${colId}`;
  if (count > 0 && me.role !== "manager")
    throw new HttpError(403, "La colonne contient des cartes : déplacez-les d'abord (ou demandez au manager).");
  await sql`DELETE FROM board_columns WHERE id = ${colId}`;
  await logActivity(me.id, "Colonne supprimée", `${c.title} (${count} carte(s))`);
  return { ok: true };
});
