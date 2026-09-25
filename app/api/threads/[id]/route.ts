import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const threadId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [th] = await sql`SELECT * FROM threads WHERE id = ${threadId}`;
  if (!th) bad("Sujet introuvable");
  if (b.pinned !== undefined && me.role !== "manager") throw new HttpError(403, "Seul le manager peut épingler un sujet.");
  if ((b.title !== undefined || b.category !== undefined) && me.role !== "manager" && th.created_by !== me.id)
    throw new HttpError(403, "Seul l'auteur du sujet ou le manager peut le renommer.");
  const [thread] = await sql`
    UPDATE threads SET
      title = ${b.title !== undefined ? str(b.title, 200).trim() || th.title : th.title},
      category = ${b.category !== undefined ? str(b.category, 60).trim() || th.category : th.category},
      pinned = ${typeof b.pinned === "boolean" ? b.pinned : th.pinned}
    WHERE id = ${threadId} RETURNING *`;
  return { thread };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  if (me.role !== "manager") throw new HttpError(403, "Seul le manager peut supprimer un sujet complet.");
  const threadId = id((await ctx.params).id);
  const sql = await db();
  const [th] = await sql`DELETE FROM threads WHERE id = ${threadId} RETURNING title`;
  if (th) await logActivity(me.id, "Sujet supprimé", th.title);
  return { ok: true };
});
