import { db } from "@/lib/db";
import { logActivity, requireManager } from "@/lib/auth";
import { bad, color, handler, id, oneOf, str } from "@/lib/api";

const ROLES = ["manager", "editeur", "visionneur"] as const;
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireManager();
  const userId = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [current] = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (!current) bad("Participant introuvable");

  const role = b.role !== undefined ? oneOf(b.role, ROLES, current.role) : current.role;
  const active = typeof b.active === "boolean" ? b.active : current.active;

  // On ne peut pas retirer le dernier manager actif.
  if (current.role === "manager" && (role !== "manager" || !active)) {
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM users WHERE role = 'manager' AND active AND id <> ${userId}`;
    if (count === 0) bad("Impossible : il doit rester au moins un manager actif.");
  }

  const name = b.name !== undefined ? str(b.name, 80).trim() || current.name : current.name;
  const email = b.email !== undefined ? str(b.email, 200).trim() || null : current.email;
  const col = b.color !== undefined ? color(b.color, current.color) : current.color;
  // Désactiver un compte invalide immédiatement ses sessions.
  const bump = active !== current.active && !active ? 1 : 0;

  const [user] = await sql`
    UPDATE users SET name = ${name}, email = ${email}, role = ${role}, active = ${active}, color = ${col},
      session_version = session_version + ${bump}
    WHERE id = ${userId}
    RETURNING id, name, email, role, color, active, created_at, last_login_at`;
  const changes = [
    role !== current.role && `rôle : ${role}`,
    active !== current.active && (active ? "réactivé" : "désactivé"),
  ].filter(Boolean).join(", ");
  if (changes) await logActivity(me.id, `Accès modifié pour ${user.name}`, changes);
  return { user };
});
