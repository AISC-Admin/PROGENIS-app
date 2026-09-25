import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";

export const GET = handler(async () => {
  await requireUser();
  const sql = await db();
  const [sections, milestones, documents] = await Promise.all([
    sql`SELECT s.*, u.name AS updated_by_name FROM project_sections s LEFT JOIN users u ON u.id = s.updated_by ORDER BY s.position, s.id`,
    sql`SELECT * FROM milestones ORDER BY due_date NULLS LAST, id`,
    sql`SELECT d.*, u.name AS uploaded_by_name FROM project_documents d LEFT JOIN users u ON u.id = d.uploaded_by ORDER BY d.created_at DESC`,
  ]);
  return { sections, milestones, documents };
});
