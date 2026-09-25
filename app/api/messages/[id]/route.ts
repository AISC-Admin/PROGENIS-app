import { db } from "@/lib/db";
import { HttpError, requireEditor } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const msgId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [m] = await sql`SELECT * FROM messages WHERE id = ${msgId}`;
  if (!m || m.deleted) bad("Message introuvable");
  if (m.user_id !== me.id) throw new HttpError(403, "Vous ne pouvez modifier que vos propres messages.");
  const [message] = await sql`
    UPDATE messages SET body = ${str(b.body, 20000)}, edited_at = now() WHERE id = ${msgId} RETURNING *`;
  return { message };
});

// Suppression « douce » : la trace du message reste dans l'historique.
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const msgId = id((await ctx.params).id);
  const sql = await db();
  const [m] = await sql`SELECT * FROM messages WHERE id = ${msgId}`;
  if (!m) bad("Message introuvable");
  if (m.user_id !== me.id && me.role !== "manager") throw new HttpError(403, "Suppression non autorisée.");
  await sql`UPDATE messages SET deleted = TRUE, edited_at = now() WHERE id = ${msgId}`;
  return { ok: true };
});
