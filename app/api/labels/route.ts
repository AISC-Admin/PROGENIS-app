import { db } from "@/lib/db";
import { requireEditor } from "@/lib/auth";
import { color, handler, reqStr } from "@/lib/api";

export const POST = handler(async (req: Request) => {
  await requireEditor();
  const b = await req.json();
  const sql = await db();
  const [label] = await sql`INSERT INTO labels (name, color) VALUES (${reqStr(b.name, "Nom", 40)}, ${color(b.color)}) RETURNING *`;
  return { label };
});
