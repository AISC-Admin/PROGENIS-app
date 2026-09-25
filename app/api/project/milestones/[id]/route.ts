import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, oneOf, optDate, str } from "@/lib/api";

const STATUSES = ["prevu", "en_cours", "atteint", "retard"] as const;
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const mid = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [m] = await sql`SELECT * FROM milestones WHERE id = ${mid}`;
  if (!m) bad("Jalon introuvable");
  const [milestone] = await sql`
    UPDATE milestones SET
      title = ${b.title !== undefined ? str(b.title, 200).trim() || m.title : m.title},
      description = ${b.description !== undefined ? str(b.description, 5000) : m.description},
      due_date = ${b.due_date !== undefined ? optDate(b.due_date) : m.due_date},
      status = ${b.status !== undefined ? oneOf(b.status, STATUSES, m.status) : m.status}
    WHERE id = ${mid} RETURNING *`;
  if (b.status !== undefined && b.status !== m.status) await logActivity(me.id, `Jalon : ${milestone.status}`, milestone.title);
  return { milestone };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireEditor();
  const sql = await db();
  await sql`DELETE FROM milestones WHERE id = ${id((await ctx.params).id)}`;
  return { ok: true };
});
