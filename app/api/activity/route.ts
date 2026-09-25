import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { handler } from "@/lib/api";

export const GET = handler(async () => {
  await requireManager();
  const sql = await db();
  return sql`
    SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.color AS user_color
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 150`;
});
