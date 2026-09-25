import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { bad, color, handler, id, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await requireEditor();
  const labelId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [l] = await sql`SELECT * FROM labels WHERE id = ${labelId}`;
  if (!l) bad("Étiquette introuvable");
  const [label] = await sql`
    UPDATE labels SET name = ${b.name !== undefined ? str(b.name, 40).trim() || l.name : l.name},
      color = ${b.color !== undefined ? color(b.color, l.color) : l.color}
    WHERE id = ${labelId} RETURNING *`;
  return { label };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireEditor();
  const sql = await db();
  await sql`DELETE FROM labels WHERE id = ${id((await ctx.params).id)}`;
  return { ok: true };
});
