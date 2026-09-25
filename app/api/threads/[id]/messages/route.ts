import { db } from "@/lib/db";
import { logActivity, requireEditor, requireUser } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";
import { cleanAiLinks, cleanAttachments } from "@/lib/content";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireUser();
  const threadId = id((await ctx.params).id);
  const sql = await db();
  const [thread] = await sql`
    SELECT th.*, u.name AS created_by_name FROM threads th LEFT JOIN users u ON u.id = th.created_by WHERE th.id = ${threadId}`;
  if (!thread) bad("Sujet introuvable");
  const messages = await sql`
    SELECT m.id, m.user_id, m.created_at, m.edited_at, m.deleted,
      CASE WHEN m.deleted THEN '' ELSE m.body END AS body,
      CASE WHEN m.deleted THEN '[]'::jsonb ELSE m.attachments END AS attachments,
      CASE WHEN m.deleted THEN '[]'::jsonb ELSE m.ai_links END AS ai_links,
      u.name AS user_name, u.color AS user_color, u.role AS user_role
    FROM messages m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.thread_id = ${threadId} ORDER BY m.created_at, m.id`;
  return { thread, messages };
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const threadId = id((await ctx.params).id);
  const b = await req.json();
  const body = str(b.body, 20000).trim();
  const attachments = cleanAttachments(b.attachments);
  const aiLinks = cleanAiLinks(b.ai_links);
  if (!body && !attachments.length && !aiLinks.length) bad("Message vide.");
  const sql = await db();
  const [th] = await sql`SELECT title FROM threads WHERE id = ${threadId}`;
  if (!th) bad("Sujet introuvable");
  const [message] = await sql`
    INSERT INTO messages (thread_id, user_id, body, attachments, ai_links)
    VALUES (${threadId}, ${me.id}, ${body}, ${sql.json(attachments)}, ${sql.json(aiLinks)}) RETURNING *`;
  await sql`UPDATE threads SET last_activity = now() WHERE id = ${threadId}`;
  const extras = [attachments.length && `${attachments.length} fichier(s)`, aiLinks.length && `${aiLinks.length} lien(s) IA`]
    .filter(Boolean).join(", ");
  await logActivity(me.id, "Message dans « " + th.title + " »", extras);
  return { message };
});
