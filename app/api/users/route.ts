import { db } from "@/lib/db";
import { generateCode, hashCode, logActivity, randomColor, requireManager, requireUser } from "@/lib/auth";
import { color, handler, oneOf, reqStr, str } from "@/lib/api";

const ROLES = ["manager", "editeur", "visionneur"] as const;

// Liste des membres. Le manager voit les détails d'administration.
export const GET = handler(async () => {
  const me = await requireUser();
  const sql = await db();
  if (me.role === "manager") {
    return sql`SELECT id, name, email, role, color, active, created_at, last_login_at FROM users ORDER BY active DESC, name`;
  }
  return sql`SELECT id, name, role, color, active FROM users WHERE active ORDER BY name`;
});

// Création d'un participant : renvoie son code d'accès (affiché une seule fois).
export const POST = handler(async (req: Request) => {
  const me = await requireManager();
  const b = await req.json();
  const name = reqStr(b.name, "Nom", 80);
  const email = str(b.email, 200).trim() || null;
  const role = oneOf(b.role, ROLES, "visionneur");
  const sql = await db();
  const code = generateCode();
  const [user] = await sql`
    INSERT INTO users (name, email, code_hash, role, color)
    VALUES (${name}, ${email}, ${hashCode(code)}, ${role}, ${color(b.color, randomColor())})
    RETURNING id, name, email, role, color, active, created_at, last_login_at`;
  await logActivity(me.id, "Ajout d'un participant", `${name} (${role})`);
  return { user, code };
});
