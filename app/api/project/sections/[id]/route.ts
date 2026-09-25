import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const sid = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [s] = await sql`SELECT * FROM project_sections WHERE id = ${sid}`;
  if (!s) bad("Section introuvable");
  const [section] = await sql`
    UPDATE project_sections SET
      title = ${b.title !== undefined ? str(b.title, 120).trim() || s.title : s.title},
      content = ${b.content !== undefined ? str(b.content, 50000) : s.content},
      updated_by = ${me.id}, updated_at = now()
    WHERE id = ${sid} RETURNING *`;
  await logActivity(me.id, "Projet : section modifiée", section.title);
  return { section };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireEditor();
  const sql = await db();
  await sql`DELETE FROM project_sections WHERE id = ${id((await ctx.params).id)}`;
  return { ok: true };
});
