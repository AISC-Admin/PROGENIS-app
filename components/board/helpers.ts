export type Column = { id: number; title: string; position: number; is_done: boolean };
export type Label = { id: number; name: string; color: string };
export type Assignee = { id: number; name: string; color: string; since: string };
export type Progress = {
  id: number;
  stage: string;
  percent: number;
  note: string;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  user_color: string | null;
};
export type Task = {
  id: number;
  column_id: number;
  position: number;
  title: string;
  description: string;
  priority: "basse" | "normale" | "haute" | "urgente";
  due_date: string | null;
  done: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  label_ids: number[];
  assignees: Assignee[];
  progress: Progress[];
};
export type Board = { columns: Column[]; labels: Label[]; tasks: Task[] };

/** Étapes prédéfinies des pastilles d'avancement. */
export const STAGES = [
  { name: "Démarré", percent: 10, color: "#3b82f6" },
  { name: "En cours", percent: 50, color: "#d9a04a" },
  { name: "Bloqué", percent: -1, color: "#dc2626" },
  { name: "En revue", percent: 80, color: "#8b5cf6" },
  { name: "Terminé", percent: 100, color: "#5c9450" },
];

export function stageColor(stage: string, percent: number) {
  const s = STAGES.find((x) => x.name.toLowerCase() === stage.toLowerCase());
  if (s) return s.color;
  if (percent >= 100) return "#5c9450";
  return "#7fb96a";
}

export const PRIORITY_META: Record<Task["priority"], { label: string; color: string }> = {
  basse: { label: "Basse", color: "#7a8a70" },
  normale: { label: "Normale", color: "#5c9450" },
  haute: { label: "Haute", color: "#d9a04a" },
  urgente: { label: "Urgente", color: "#dc2626" },
};

export const LABEL_COLORS = [
  "#3f6b3a", "#5c9450", "#0f766e", "#1d4ed8", "#0369a1", "#7c3aed",
  "#a21caf", "#be123c", "#dc2626", "#c2410c", "#b8792a", "#4b5245",
];

export function toDateInput(d: string | null) {
  if (!d) return "";
  return d.slice(0, 10);
}

export function isOverdue(t: Task) {
  if (!t.due_date || t.done) return false;
  return new Date(t.due_date.slice(0, 10) + "T23:59:59") < new Date();
}

export function fmtDue(d: string) {
  const date = new Date(d.slice(0, 10) + "T12:00:00");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
