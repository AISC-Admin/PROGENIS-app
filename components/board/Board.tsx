"use client";
import { useMemo, useRef, useState } from "react";
import { api, Avatar, ReadOnlyNotice, useApp, usePolling } from "../client";
import { type Board as BoardData, type Column, type Task, isOverdue, PRIORITY_META, stageColor, fmtDue } from "./helpers";
import CardDetail from "./CardDetail";
import LabelManager from "./LabelManager";

export default function Board() {
  const { canEdit, me, toast } = useApp();
  const { data, setData, reload, error } = usePolling<BoardData>("/api/tasks", 8000);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumn, setNewColumn] = useState("");

  const labelsById = useMemo(() => new Map((data?.labels ?? []).map((l) => [l.id, l])), [data]);

  const visible = (t: Task) => {
    if (mine && !t.assignees.some((a) => a.id === me.id)) return false;
    if (labelFilter && !t.label_ids.includes(labelFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  };

  // ---- Glisser-déposer ----
  const dragId = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: number; beforeId: number | null; afterId: number | null } | null>(null);

  function onDragOverColumn(e: React.DragEvent, col: Column, listEl: HTMLDivElement | null) {
    if (dragId.current == null || !listEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const cards = Array.from(listEl.querySelectorAll<HTMLElement>("[data-card]")).filter(
      (el) => Number(el.dataset.card) !== dragId.current,
    );
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    const beforeId = index > 0 ? Number(cards[index - 1].dataset.card) : null;
    const afterId = index < cards.length ? Number(cards[index].dataset.card) : null;
    if (!dropTarget || dropTarget.col !== col.id || dropTarget.beforeId !== beforeId || dropTarget.afterId !== afterId)
      setDropTarget({ col: col.id, beforeId, afterId });
  }

  async function onDrop(col: Column) {
    const id = dragId.current;
    const target = dropTarget;
    dragId.current = null;
    setDropTarget(null);
    if (id == null || !target || !data) return;
    const before = data.tasks.find((t) => t.id === target.beforeId);
    const after = data.tasks.find((t) => t.id === target.afterId);
    const position =
      before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 1;
    const task = data.tasks.find((t) => t.id === id);
    if (!task || (task.column_id === col.id && task.position === position)) return;
    // mise à jour optimiste
    setData({
      ...data,
      tasks: data.tasks.map((t) => (t.id === id ? { ...t, column_id: col.id, position, done: col.is_done ? true : t.column_id !== col.id ? false : t.done } : t)),
    });
    try {
      await api(`/api/tasks/${id}`, "PATCH", { column_id: col.id, position });
    } catch (e) {
      toast((e as Error).message, "err");
    }
    reload();
  }

  async function addColumn() {
    if (!newColumn.trim()) return;
    try {
      await api("/api/columns", "POST", { title: newColumn });
      setNewColumn("");
      setAddingColumn(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  if (!data) {
    return <div className="p-8 text-ink-soft">{error ? `Erreur : ${error}` : "Chargement du tableau…"}</div>;
  }

  const total = data.tasks.length;
  const doneCount = data.tasks.filter((t) => t.done).length;
  const mineCount = data.tasks.filter((t) => t.assignees.some((a) => a.id === me.id) && !t.done).length;
  const current = openTask != null ? data.tasks.find((t) => t.id === openTask) ?? null : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">01 — Tâches</p>
            <h1 className="text-3xl">Tableau des tâches</h1>
            <p className="text-sm text-ink-soft mt-1">
              {total} carte{total > 1 ? "s" : ""} · {doneCount} terminée{doneCount > 1 ? "s" : ""} ·{" "}
              <span className="text-moss">{mineCount} en charge pour vous</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field !w-52 !py-1.5" placeholder="Rechercher une carte…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={`btn btn-sm ${mine ? "btn-primary" : "btn-ghost"}`} onClick={() => setMine(!mine)}>
              Mes cartes
            </button>
            {canEdit && (
              <button className="btn btn-sm btn-ghost" onClick={() => setLabelsOpen(true)}>
                Étiquettes
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {data.labels.map((l) => (
            <button
              key={l.id}
              onClick={() => setLabelFilter(labelFilter === l.id ? null : l.id)}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white transition-opacity"
              style={{ background: l.color, opacity: labelFilter && labelFilter !== l.id ? 0.35 : 1 }}
            >
              {l.name}
            </button>
          ))}
          {labelFilter && (
            <button className="text-[11px] text-ink-soft underline ml-1" onClick={() => setLabelFilter(null)}>
              tout afficher
            </button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-3">
        <ReadOnlyNotice />
      </div>

      <div className="board-scroll flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 px-4 sm:px-6 pb-6 pt-1 h-full items-start">
          {data.columns.map((col) => (
            <ColumnView
              key={col.id}
              col={col}
              tasks={data.tasks.filter((t) => t.column_id === col.id).sort((a, b) => a.position - b.position)}
              visible={visible}
              labelsById={labelsById}
              canEdit={canEdit}
              meId={me.id}
              drop={dropTarget?.col === col.id ? dropTarget : null}
              onDragStart={(id) => (dragId.current = id)}
              onDragEnd={() => {
                dragId.current = null;
                setDropTarget(null);
              }}
              onDragOver={onDragOverColumn}
              onDrop={() => onDrop(col)}
              onOpen={setOpenTask}
              reload={reload}
            />
          ))}

          {canEdit && (
            <div className="w-[290px] shrink-0">
              {addingColumn ? (
                <div className="card p-2.5 space-y-2">
                  <input
                    className="field"
                    autoFocus
                    placeholder="Nom de la colonne"
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addColumn();
                      if (e.key === "Escape") setAddingColumn(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={addColumn}>
                      Ajouter
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingColumn(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full text-left rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft hover:border-moss hover:text-moss"
                >
                  + Ajouter une colonne
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {current && (
        <CardDetail task={current} board={data} onClose={() => setOpenTask(null)} reload={reload} />
      )}
      {labelsOpen && <LabelManager labels={data.labels} onClose={() => setLabelsOpen(false)} reload={reload} />}
    </div>
  );
}

function ColumnView(props: {
  col: Column;
  tasks: Task[];
  visible: (t: Task) => boolean;
  labelsById: Map<number, { id: number; name: string; color: string }>;
  canEdit: boolean;
  meId: number;
  drop: { beforeId: number | null; afterId: number | null } | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, col: Column, el: HTMLDivElement | null) => void;
  onDrop: () => void;
  onOpen: (id: number) => void;
  reload: () => void;
}) {
  const { col, tasks, canEdit } = props;
  const { toast, me } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(col.title);

  const shown = tasks.filter(props.visible);

  async function addCard() {
    const value = title.trim();
    if (!value) return;
    setTitle(""); // vidé tout de suite : on peut enchaîner la saisie de la carte suivante
    try {
      await api("/api/tasks", "POST", { column_id: col.id, title: value });
      props.reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function patchColumn(body: object) {
    try {
      await api(`/api/columns/${col.id}`, "PATCH", body);
      props.reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function deleteColumn() {
    setMenu(false);
    const msg = tasks.length
      ? `Supprimer la colonne « ${col.title} » et ses ${tasks.length} carte(s) ?`
      : `Supprimer la colonne « ${col.title} » ?`;
    if (!confirm(msg)) return;
    try {
      await api(`/api/columns/${col.id}`, "DELETE");
      props.reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  return (
    <section
      className="w-[290px] shrink-0 rounded-xl bg-paper-3 border border-line flex flex-col max-h-full"
      onDragEnter={(e) => props.onDragOver(e, col, listRef.current)}
      onDragOver={(e) => props.onDragOver(e, col, listRef.current)}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop();
      }}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2 relative">
        {renaming ? (
          <input
            className="field !py-1 text-sm font-semibold"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              if (name.trim() && name !== col.title) patchColumn({ title: name });
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <h2
            className="font-sans text-[14px] font-semibold flex-1 truncate"
            onDoubleClick={() => canEdit && setRenaming(true)}
            title={col.title}
          >
            {col.is_done && <span className="text-moss mr-1">✓</span>}
            {col.title}
          </h2>
        )}
        <span className="font-mono text-[11px] text-ink-soft bg-paper-2 border border-line rounded px-1.5">{tasks.length}</span>
        {canEdit && (
          <button className="text-ink-soft hover:text-ink px-1" onClick={() => setMenu(!menu)} aria-label="Options de la colonne">
            ⋯
          </button>
        )}
        {menu && (
          <div className="absolute right-2 top-10 z-20 card shadow-lg py-1 w-56 text-sm fade-in" onMouseLeave={() => setMenu(false)}>
            <button className="w-full text-left px-3 py-1.5 hover:bg-paper-3" onClick={() => { setMenu(false); setRenaming(true); }}>
              Renommer
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-paper-3" onClick={() => { setMenu(false); patchColumn({ is_done: !col.is_done }); }}>
              {col.is_done ? "Ne plus marquer comme « terminé »" : "Colonne « terminé » (✓ auto)"}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-paper-3" onClick={() => { setMenu(false); patchColumn({ position: col.position - 1.5 }); }}>
              ← Déplacer à gauche
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-paper-3" onClick={() => { setMenu(false); patchColumn({ position: col.position + 1.5 }); }}>
              Déplacer à droite →
            </button>
            {(tasks.length === 0 || me.role === "manager") && (
              <button className="w-full text-left px-3 py-1.5 hover:bg-danger-tint text-danger" onClick={deleteColumn}>
                Supprimer la colonne
              </button>
            )}
          </div>
        )}
      </header>

      <div ref={listRef} className="board-scroll overflow-y-auto px-2 pb-1 space-y-2 min-h-[40px]">
        {shown.map((t) => (
          <div key={t.id}>
            {props.drop && props.drop.afterId === t.id && <DropLine />}
            <CardView
              task={t}
              labelsById={props.labelsById}
              canEdit={canEdit}
              meId={props.meId}
              onOpen={() => props.onOpen(t.id)}
              onDragStart={() => props.onDragStart(t.id)}
              onDragEnd={props.onDragEnd}
              reload={props.reload}
            />
          </div>
        ))}
        {props.drop && props.drop.afterId === null && <DropLine />}
        {shown.length === 0 && !props.drop && (
          <p className="text-xs text-ink-soft text-center py-3">{tasks.length ? "Aucune carte ne correspond au filtre" : "Aucune carte"}</p>
        )}
      </div>

      {canEdit && (
        <div className="p-2">
          {adding ? (
            <div className="space-y-2">
              <textarea
                className="field text-sm"
                rows={2}
                autoFocus
                placeholder="Titre de la carte…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addCard();
                  }
                  if (e.key === "Escape") setAdding(false);
                }}
              />
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={addCard}>
                  Ajouter la carte
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                  ×
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full text-left text-sm text-ink-soft hover:text-moss hover:bg-paper-2 rounded-md px-2 py-1.5"
              onClick={() => setAdding(true)}
            >
              + Ajouter une carte
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DropLine() {
  return <div className="h-1 rounded-full bg-moss my-1" />;
}

function CardView({
  task: t,
  labelsById,
  canEdit,
  meId,
  onOpen,
  onDragStart,
  onDragEnd,
  reload,
}: {
  task: Task;
  labelsById: Map<number, { id: number; name: string; color: string }>;
  canEdit: boolean;
  meId: number;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  reload: () => void;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const mine = t.assignees.some((a) => a.id === meId);
  const last = t.progress[t.progress.length - 1];
  const overdue = isOverdue(t);
  const labels = t.label_ids.map((id) => labelsById.get(id)).filter(Boolean) as { id: number; name: string; color: string }[];

  async function toggleMine(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}/assign`, "POST", { take: !mine });
      reload();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      data-card={t.id}
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(t.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group bg-paper-2 border rounded-lg p-2.5 cursor-pointer hover:border-moss transition-colors ${
        canEdit ? "active:cursor-grabbing" : ""
      } ${t.done ? "opacity-75" : ""} border-line`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {labels.map((l) => (
            <span key={l.id} className="text-[10px] font-semibold px-1.5 py-[1px] rounded text-white" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <h3 className={`font-sans text-[14px] font-medium leading-snug ${t.done ? "line-through text-ink-soft" : ""}`}>{t.title}</h3>

      {(t.due_date || t.priority === "haute" || t.priority === "urgente" || t.description) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
          {t.due_date && (
            <span
              className={`font-mono px-1.5 py-[1px] rounded ${
                t.done ? "bg-moss-tint text-moss" : overdue ? "bg-danger-tint text-danger" : "bg-paper-3 text-ink-soft"
              }`}
              title="Échéance"
            >
              ◷ {fmtDue(t.due_date)}
            </span>
          )}
          {(t.priority === "haute" || t.priority === "urgente") && (
            <span className="font-mono px-1.5 py-[1px] rounded text-white" style={{ background: PRIORITY_META[t.priority].color }}>
              {PRIORITY_META[t.priority].label}
            </span>
          )}
          {t.description && (
            <span className="text-ink-soft" title="Contient une description">
              ≡
            </span>
          )}
        </div>
      )}

      {last && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: stageColor(last.stage, last.percent) }}>
              <span className="w-2 h-2 rounded-full" style={{ background: stageColor(last.stage, last.percent) }} />
              {last.stage}
            </span>
            <span className="font-mono text-ink-soft">{last.percent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-paper-3 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${last.percent}%`, background: stageColor(last.stage, last.percent) }} />
          </div>
          {t.progress.length > 1 && (
            <div className="flex gap-1 mt-1.5" title="Historique des pastilles">
              {t.progress.slice(-8).map((p) => (
                <span key={p.id} className="w-2 h-2 rounded-full" style={{ background: stageColor(p.stage, p.percent) }} title={`${p.stage} · ${p.percent}%`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex -space-x-1.5">
          {t.assignees.slice(0, 5).map((a) => (
            <Avatar key={a.id} name={a.name} color={a.color} size={24} />
          ))}
          {t.assignees.length > 5 && <span className="text-[11px] text-ink-soft pl-2">+{t.assignees.length - 5}</span>}
        </div>
        {canEdit && (
          <label
            className={`flex items-center gap-1.5 text-[11px] font-mono cursor-pointer select-none rounded px-1.5 py-0.5 ${
              mine ? "text-moss bg-moss-tint" : "text-ink-soft hover:text-moss"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <input type="checkbox" className="accent-[var(--moss)]" checked={mine} disabled={busy} onChange={() => {}} onClick={toggleMine} />
            Je m&apos;en occupe
          </label>
        )}
      </div>
    </article>
  );
}
