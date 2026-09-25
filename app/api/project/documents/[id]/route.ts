import { db } from "@/lib/db";
import { HttpError, logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const did = id((await ctx.params).id);
  const sql = await db();
  const [d] = await sql`SELECT * FROM project_documents WHERE id = ${did}`;
  if (!d) bad("Document introuvable");
  if (d.uploaded_by !== me.id && me.role !== "manager") throw new HttpError(403, "Suppression réservée à l'auteur ou au manager.");
  await sql`DELETE FROM project_documents WHERE id = ${did}`;
  await logActivity(me.id, "Document de projet retiré", d.name);
  return { ok: true };
});
