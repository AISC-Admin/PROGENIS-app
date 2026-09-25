import { db } from "@/lib/db";
import { logActivity, requireEditor, requireUser } from "@/lib/auth";
import { bad, handler, id, oneOf, optDate, reqStr, str } from "@/lib/api";

const PRIORITIES = ["basse", "normale", "haute", "urgente"] as const;

// Tableau complet : colonnes, étiquettes et cartes (avec membres, étiquettes, pastilles).
export const GET = handler(async () => {
  await requireUser();
  const sql = await db();
  const [columns, labels, tasks] = await Promise.all([
    sql`SELECT * FROM board_columns ORDER BY position, id`,
    sql`SELECT * FROM labels ORDER BY name`,
    sql`
      SELECT t.*, cu.name AS created_by_name,
        COALESCE((SELECT json_agg(tl.label_id) FROM task_labels tl WHERE tl.task_id = t.id), '[]') AS label_ids,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'color', u.color, 'since', a.since) ORDER BY a.since)
          FROM task_assignees a JOIN users u ON u.id = a.user_id WHERE a.task_id = t.id
        ), '[]') AS assignees,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id, 'stage', p.stage, 'percent', p.percent, 'note', p.note,
            'created_at', p.created_at, 'user_id', p.user_id, 'user_name', pu.name, 'user_color', pu.color) ORDER BY p.created_at)
          FROM task_progress p LEFT JOIN users pu ON pu.id = p.user_id WHERE p.task_id = t.id
        ), '[]') AS progress
      FROM tasks t LEFT JOIN users cu ON cu.id = t.created_by
      ORDER BY t.position, t.id`,
  ]);
  return { columns, labels, tasks };
});

export const POST = handler(async (req: Request) => {
  const me = await requireEditor();
  const b = await req.json();
  const sql = await db();
  const columnId = id(b.column_id);
  const [col] = await sql`SELECT * FROM board_columns WHERE id = ${columnId}`;
  if (!col) bad("Colonne introuvable");
  const [{ max }] = await sql`SELECT COALESCE(MAX(position), 0) AS max FROM tasks WHERE column_id = ${columnId}`;
  const [task] = await sql`
    INSERT INTO tasks (column_id, position, title, description, priority, due_date, done, created_by)
    VALUES (${columnId}, ${Number(max) + 1}, ${reqStr(b.title, "Titre", 200)}, ${str(b.description, 5000)},
      ${oneOf(b.priority, PRIORITIES, "normale")}, ${optDate(b.due_date)}, ${col.is_done}, ${me.id})
    RETURNING *`;
  if (Array.isArray(b.label_ids) && b.label_ids.length) {
    const ids = b.label_ids.map(Number).filter(Number.isInteger);
    await sql`INSERT INTO task_labels (task_id, label_id) SELECT ${task.id}, l.id FROM labels l WHERE l.id = ANY(${ids}) ON CONFLICT DO NOTHING`;
  }
  await logActivity(me.id, "Nouvelle carte", `${task.title} → ${col.title}`);
  return { task };
});
