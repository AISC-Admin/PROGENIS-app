"use client";
import { useEffect, useState } from "react";
import { api, Avatar, fmtDate, Modal, timeAgo, useApp } from "../client";
import { type Board, type Task, PRIORITY_META, STAGES, stageColor, toDateInput } from "./helpers";

type Member = { id: number; name: string; color: string; role: string; active: boolean };

export default function CardDetail({
  task: t,
  board,
  onClose,
  reload,
}: {
  task: Task;
  board: Board;
  onClose: () => void;
  reload: () => void;
}) {
  const { canEdit, me, toast } = useApp();
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description);
  const [members, setMembers] = useState<Member[]>([]);

  // Pastille en préparation
  const [stage, setStage] = useState(STAGES[1].name);
  const [percent, setPercent] = useState(() => t.progress[t.progress.length - 1]?.percent ?? 10);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setTitle(t.title), [t.title]);
  useEffect(() => setDescription(t.description), [t.description]);
  useEffect(() => {
    if (me.role === "manager") api<Member[]>("/api/users").then((u) => setMembers(u.filter((x) => x.active))).catch(() => {});
  }, [me.role]);

  const mine = t.assignees.some((a) => a.id === me.id);
  const column = board.columns.find((c) => c.id === t.column_id);

  async function patch(body: object) {
    try {
      await api(`/api/tasks/${t.id}`, "PATCH", body);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function assign(take: boolean, userId?: number) {
    try {
      await api(`/api/tasks/${t.id}/assign`, "POST", { take, userId });
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function addProgress() {
    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}/progress`, "POST", { stage, percent, note });
      setNote("");
      toast("Pastille d'avancement ajoutée");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  async function removeProgress(pid: number) {
    if (!confirm("Supprimer cette pastille ?")) return;
    try {
      await api(`/api/tasks/${t.id}/progress?pid=${pid}`, "DELETE");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function remove() {
    if (!confirm(`Supprimer définitivement la carte « ${t.title} » ?`)) return;
    try {
      await api(`/api/tasks/${t.id}`, "DELETE");
      onClose();
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  function toggleLabel(id: number) {
    const ids = t.label_ids.includes(id) ? t.label_ids.filter((x) => x !== id) : [...t.label_ids, id];
    patch({ label_ids: ids });
  }

  const canDelete = me.role === "manager" || t.created_by === me.id;
  const selectedStage = STAGES.find((s) => s.name === stage);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <div>
          <p className="eyebrow mb-1">
            Carte #{t.id} · dans «&nbsp;{column?.title}&nbsp;»{t.done && " · terminée"}
          </p>
          {canEdit ? (
            <input
              className="w-full bg-transparent serif text-2xl outline-none border-b border-transparent focus:border-moss"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== t.title && patch({ title })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <h3 className="text-2xl">{t.title}</h3>
          )}
        </div>
      }
    >
      <div className="grid md:grid-cols-[1fr_220px] gap-6">
        {/* Colonne principale */}
        <div className="space-y-6 min-w-0">
          <div>
            <label className="lbl">Description</label>
            {canEdit ? (
              <textarea
                className="field text-sm"
                rows={4}
                placeholder="Détaillez l'objectif, les étapes, les ressources…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => description !== t.description && patch({ description })}
              />
            ) : (
              <p className="prose-text text-sm">{t.description || <span className="text-ink-soft">Aucune description.</span>}</p>
            )}
          </div>

          <div>
            <label className="lbl">Pastilles d&apos;avancement</label>
            {t.progress.length === 0 && <p className="text-sm text-ink-soft mb-3">Aucun point d&apos;avancement pour l&apos;instant.</p>}
            <ol className="relative border-l-2 border-line ml-2 space-y-3 mb-4">
              {[...t.progress].reverse().map((p) => (
                <li key={p.id} className="pl-4 relative">
                  <span
                    className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-paper-2"
                    style={{ background: stageColor(p.stage, p.percent) }}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                      style={{ background: stageColor(p.stage, p.percent) }}
                    >
                      {p.stage} · {p.percent}%
                    </span>
                    <span className="text-ink-soft text-xs">
                      {p.user_name ?? "—"} · <span title={fmtDate(p.created_at, true)}>{timeAgo(p.created_at)}</span>
                    </span>
                    {canEdit && (p.user_id === me.id || me.role === "manager") && (
                      <button className="text-xs text-ink-soft hover:text-danger ml-auto" onClick={() => removeProgress(p.id)}>
                        retirer
                      </button>
                    )}
                  </div>
                  {p.note && <p className="prose-text text-sm mt-1">{p.note}</p>}
                </li>
              ))}
            </ol>

            {canEdit && (
              <div className="rounded-lg border border-line bg-paper-3 p-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => {
                        setStage(s.name);
                        if (s.percent >= 0) setPercent(s.percent);
                      }}
                      className="px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors"
                      style={
                        stage === s.name
                          ? { background: s.color, color: "#fff", borderColor: s.color }
                          : { borderColor: "var(--line)", color: s.color }
                      }
                    >
                      ● {s.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: selectedStage?.color ?? "var(--moss)" }}
                    aria-label="Pourcentage d'avancement"
                  />
                  <span className="font-mono text-sm w-12 text-right">{percent}%</span>
                </div>
                <textarea
                  className="field text-sm"
                  rows={2}
                  placeholder="Note : ce qui a été fait, prochaine étape, blocage…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={addProgress}>
                  Ajouter la pastille
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barre latérale */}
        <aside className="space-y-5 text-sm">
          <div>
            <label className="lbl">Membres</label>
            <div className="space-y-1.5 mb-2">
              {t.assignees.length === 0 && <p className="text-ink-soft text-xs">Personne ne s&apos;en occupe encore.</p>}
              {t.assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Avatar name={a.name} color={a.color} size={24} />
                  <span className="flex-1 truncate">{a.name}</span>
                  {canEdit && (a.id === me.id || me.role === "manager") && (
                    <button className="text-xs text-ink-soft hover:text-danger" onClick={() => assign(false, a.id)} title="Retirer">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <button className={`btn btn-sm w-full ${mine ? "btn-ghost" : "btn-primary"}`} onClick={() => assign(!mine)}>
                {mine ? "Je me retire" : "✓ Je m'en occupe"}
              </button>
            )}
            {me.role === "manager" && members.length > 0 && (
              <select
                className="field !py-1 mt-2 text-xs"
                value=""
                onChange={(e) => e.target.value && assign(true, Number(e.target.value))}
              >
                <option value="">+ Attribuer à…</option>
                {members
                  .filter((m) => m.role !== "visionneur" && !t.assignees.some((a) => a.id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div>
            <label className="lbl">Étiquettes</label>
            <div className="flex flex-wrap gap-1.5">
              {board.labels.map((l) => {
                const on = t.label_ids.includes(l.id);
                if (!canEdit && !on) return null;
                return (
                  <button
                    key={l.id}
                    disabled={!canEdit}
                    onClick={() => toggleLabel(l.id)}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded border-2 transition-opacity"
                    style={{
                      background: on ? l.color : "transparent",
                      color: on ? "#fff" : l.color,
                      borderColor: l.color,
                      opacity: on ? 1 : 0.7,
                    }}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="lbl">Colonne</label>
            <select
              className="field !py-1.5"
              disabled={!canEdit}
              value={t.column_id}
              onChange={(e) => patch({ column_id: Number(e.target.value) })}
            >
              {board.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Échéance</label>
            <input
              type="date"
              className="field !py-1.5"
              disabled={!canEdit}
              value={toDateInput(t.due_date)}
              onChange={(e) => patch({ due_date: e.target.value || null })}
            />
          </div>

          <div>
            <label className="lbl">Priorité</label>
            <select
              className="field !py-1.5"
              disabled={!canEdit}
              value={t.priority}
              onChange={(e) => patch({ priority: e.target.value })}
            >
              {Object.entries(PRIORITY_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {canEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={t.done} onChange={(e) => patch({ done: e.target.checked })} className="accent-[var(--moss)]" />
              Marquer comme terminée
            </label>
          )}

          <p className="text-xs text-ink-soft font-mono leading-relaxed pt-2 border-t border-line">
            Créée par {t.created_by_name ?? "—"}
            <br />
            le {fmtDate(t.created_at, true)}
          </p>

          {canEdit && canDelete && (
            <button className="btn btn-danger btn-sm w-full" onClick={remove}>
              Supprimer la carte
            </button>
          )}
        </aside>
      </div>
    </Modal>
  );
}
