import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionCookie, hashCode, logActivity, normalizeCode, randomColor, type User } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? normalizeCode(body.code) : "";
    if (code.length < 4) return NextResponse.json({ error: "Code d'accès requis." }, { status: 400 });

    const sql = await db();
    const hash = hashCode(code);
    let rows = await sql<User[]>`
      SELECT id, name, email, role, color, active, session_version FROM users WHERE code_hash = ${hash}`;

    // Premier démarrage : aucun utilisateur -> le code MANAGER_BOOTSTRAP_CODE crée le compte manager.
    if (rows.length === 0) {
      const bootstrap = process.env.MANAGER_BOOTSTRAP_CODE;
      const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM users`;
      if (count === 0 && bootstrap && normalizeCode(bootstrap) === code) {
        rows = await sql<User[]>`
          INSERT INTO users (name, code_hash, role, color)
          VALUES ('Manager', ${hash}, 'manager', ${randomColor()})
          RETURNING id, name, email, role, color, active, session_version`;
        await logActivity(rows[0].id, "Création du compte manager initial");
      }
    }

    const user = rows[0];
    if (!user || !user.active) {
      await new Promise((r) => setTimeout(r, 600)); // ralentit les essais en série
      return NextResponse.json({ error: "Code invalide ou compte désactivé." }, { status: 401 });
    }

    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
    await createSessionCookie(user);
    await logActivity(user.id, "Connexion");
    return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
