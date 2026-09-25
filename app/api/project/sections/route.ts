import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { handler, reqStr, str } from "@/lib/api";

export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const sql = await db();
  const [{ max }] = await sql`SELECT COALESCE(MAX(position), 0) AS max FROM project_sections`;
  const [section] = await sql`
    INSERT INTO project_sections (title, content, position, updated_by)
    VALUES (${reqStr(b.title, "Titre", 120)}, ${str(b.content, 50000)}, ${Number(max) + 1}, ${me.id}) RETURNING *`;
  return { section };
});
