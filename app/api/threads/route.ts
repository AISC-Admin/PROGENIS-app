import { db } from "@/lib/db";
import { logActivity, requireEditor, requireUser } from "@/lib/auth";
import { bad, handler, reqStr, str } from "@/lib/api";
import { cleanAiLinks, cleanAttachments } from "@/lib/content";

export const GET = handler(async () => {
  await requireUser();
  const sql = await db();
  return sql`
    SELECT th.*, u.name AS created_by_name, u.color AS created_by_color,
      (SELECT count(*)::int FROM messages m WHERE m.thread_id = th.id AND NOT m.deleted) AS message_count,
      (SELECT count(*)::int FROM messages m, jsonb_array_elements(m.attachments) WHERE m.thread_id = th.id AND NOT m.deleted) AS file_count,
      (SELECT count(*)::int FROM messages m, jsonb_array_elements(m.ai_links) WHERE m.thread_id = th.id AND NOT m.deleted) AS ai_link_count,
      (SELECT lu.name FROM messages m LEFT JOIN users lu ON lu.id = m.user_id
        WHERE m.thread_id = th.id AND NOT m.deleted ORDER BY m.created_at DESC LIMIT 1) AS last_author
    FROM threads th LEFT JOIN users u ON u.id = th.created_by
    ORDER BY th.pinned DESC, th.last_activity DESC`;
});

// Nouveau sujet + premier message.
export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const title = reqStr(b.title, "Titre", 200);
  const body = str(b.body, 20000).trim();
  const attachments = cleanAttachments(b.attachments);
  const aiLinks = cleanAiLinks(b.ai_links);
  if (!body && !attachments.length && !aiLinks.length) bad("Le premier message ne peut pas être vide.");
  const sql = await db();
  const thread = await sql.begin(async (tx) => {
    const [th] = await tx`
      INSERT INTO threads (title, category, created_by) VALUES (${title}, ${str(b.category, 60).trim() || "Général"}, ${me.id})
      RETURNING *`;
    await tx`
      INSERT INTO messages (thread_id, user_id, body, attachments, ai_links)
      VALUES (${th.id}, ${me.id}, ${body}, ${tx.json(attachments)}, ${tx.json(aiLinks)})`;
    return th;
  });
  await logActivity(me.id, "Nouveau sujet de réflexion", title);
  return { thread };
});
