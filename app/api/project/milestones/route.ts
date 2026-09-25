import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { handler, oneOf, optDate, reqStr, str } from "@/lib/api";

const STATUSES = ["prevu", "en_cours", "atteint", "retard"] as const;

export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const sql = await db();
  const [milestone] = await sql`
    INSERT INTO milestones (title, description, due_date, status, created_by)
    VALUES (${reqStr(b.title, "Titre", 200)}, ${str(b.description, 5000)}, ${optDate(b.due_date)},
      ${oneOf(b.status, STATUSES, "prevu")}, ${me.id}) RETURNING *`;
  await logActivity(me.id, "Nouveau jalon", milestone.title);
  return { milestone };
});
