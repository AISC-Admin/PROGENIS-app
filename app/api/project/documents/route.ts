import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, str } from "@/lib/api";
import { cleanAttachments } from "@/lib/content";

export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const [file] = cleanAttachments([b]);
  if (!file) bad("Fichier invalide");
  const sql = await db();
  const [document] = await sql`
    INSERT INTO project_documents (name, description, url, content_type, size, uploaded_by)
    VALUES (${file.name}, ${str(b.description, 1000)}, ${file.url}, ${file.content_type}, ${file.size}, ${me.id}) RETURNING *`;
  await logActivity(me.id, "Document de projet ajouté", file.name);
  return { document };
});
