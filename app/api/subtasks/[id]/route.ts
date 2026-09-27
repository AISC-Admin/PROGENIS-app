import { db } from "@/lib/db";
import { logActivity, requireEditor } from "@/lib/auth";
import { bad, handler, id, str } from "@/lib/api";
import { cleanAttachments } from "@/lib/content";
import { randomBytes } from "node:crypto";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["source", "reponse", "info"];

function cleanPastilles(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).flatMap((p) => {
    const url = str(p?.url, 2000).trim();
    const label = str(p?.label, 200).trim();
    if (url && !/^https?:\/\//i.test(url)) return [];
    if (!url && !label) return [];
    return [{
      id: typeof p?.id === "string" && /^[\w-]{1,40}$/.test(p.id) ? p.id : randomBytes(6).toString("hex"),
      kind: KINDS.includes(p?.kind) ? p.kind : "info",
      label,
      url,
    }];
  });
}

// Modifie une sous-tâche : titre, couleur, coche, note, pastilles (liens), fichiers justificatifs, position.
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const sid = id((await ctx.params).id);
  const b = await req.json();
  const sql = await db();
  const [s] = await sql`SELECT s.*, t.title AS task_title FROM subtasks s JOIN tasks t ON t.id = s.task_id WHERE s.id = ${sid}`;
  if (!s) bad("Sous-tâche introuvable");
  const done = typeof b.done === "boolean" ? b.done : s.done;
  const justChecked = done && !s.done;
  const color =
    b.color === null ? null : typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : s.color;
  const [subtask] = await sql`
    UPDATE subtasks SET
      title = ${b.title !== undefined ? str(b.title, 300).trim() || s.title : s.title},
      position = ${typeof b.position === "number" && Number.isFinite(b.position) ? b.position : s.position},
      color = ${color},
      note = ${b.note !== undefined ? str(b.note, 5000) : s.note},
      pastilles = ${b.pastilles !== undefined ? sql.json(cleanPastilles(b.pastilles)) : s.pastilles},
      attachments = ${b.attachments !== undefined ? sql.json(cleanAttachments(b.attachments)) : s.attachments},
      done = ${done},
      done_by = ${justChecked ? me.id : done ? s.done_by : null},
      done_at = ${justChecked ? new Date() : done ? s.done_at : null}
    WHERE id = ${sid} RETURNING *`;
  await sql`UPDATE tasks SET updated_at = now() WHERE id = ${s.task_id}`;
  if (done !== s.done)
    await logActivity(me.id, done ? `Sous-tâche validée : ${s.title}` : `Sous-tâche décochée : ${s.title}`, s.task_title);
  return { subtask };
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireEditor();
  const sid = id((await ctx.params).id);
  const sql = await db();
  const [s] = await sql`DELETE FROM subtasks WHERE id = ${sid} RETURNING title, task_id`;
  if (s) await logActivity(me.id, `Sous-tâche supprimée : ${s.title}`);
  return { ok: true };
});
