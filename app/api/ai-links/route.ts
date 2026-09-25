import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handler } from "@/lib/api";

// Bibliothèque de tous les liens IA partagés dans l'onglet Réflexion.
export const GET = handler(async () => {
  await requireUser();
  const sql = await db();
  return sql`
    SELECT l->>'url' AS url, l->>'title' AS title, l->>'provider' AS provider,
      m.id AS message_id, m.created_at, th.id AS thread_id, th.title AS thread_title,
      u.name AS user_name, u.color AS user_color
    FROM messages m
    CROSS JOIN LATERAL jsonb_array_elements(m.ai_links) AS l
    JOIN threads th ON th.id = m.thread_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE NOT m.deleted
    ORDER BY m.created_at DESC
    LIMIT 500`;
});
