import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { handler, reqStr } from "@/lib/api";

export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const sql = await db();
  const [{ max }] = await sql`SELECT COALESCE(MAX(position), 0) AS max FROM board_columns`;
  const [column] = await sql`
    INSERT INTO board_columns (title, position, is_done) VALUES (${reqStr(b.title, "Titre", 60)}, ${Number(max) + 1}, ${b.is_done === true})
    RETURNING *`;
  await logActivity(me.id, "Nouvelle colonne", column.title);
  return { column };
});
