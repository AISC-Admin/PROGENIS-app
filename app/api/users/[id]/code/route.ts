import { db } from "@/lib/db";
import { createSessionCookie, generateCode, hashCode, logActivity, requireManager } from "@/lib/auth";
import { bad, handler, id } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// Génère un nouveau code d'accès : l'ancien code et les sessions ouvertes sont invalidés.
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireManager();
  const userId = id((await ctx.params).id);
  const sql = await db();
  const code = generateCode();
  const [user] = await sql`
    UPDATE users SET code_hash = ${hashCode(code)}, session_version = session_version + 1
    WHERE id = ${userId} RETURNING id, name, session_version`;
  if (!user) bad("Participant introuvable");
  // Si le manager régénère son propre code, on le garde connecté.
  if (user.id === me.id) await createSessionCookie({ id: user.id, session_version: user.session_version });
  await logActivity(me.id, `Nouveau code d'accès pour ${user.name}`);
  return { code };
});
