"use client";
import { useRef, useState } from "react";
import { api, fmtDate, useApp } from "../client";
import { uploadFile } from "../upload";
import { AttachmentView } from "../forum/MessageView";
import { fileHref, fileKind } from "@/lib/shared";
import { PASTILLE_KINDS, SUBTASK_COLORS, type Pastille, type Subtask, type Task } from "./helpers";

export function subtaskStats(t: Task) {
  const total = t.subtasks.length;
  const done = t.subtasks.filter((s) => s.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

async function patchSubtask(id: number, body: object) {
  await api(`/api/subtasks/${id}`, "PATCH", body);
}

/** Badge « ☑ 3/7 », vert quand tout est coché. */
export function ChecklistBadge({ task, active, onClick }: { task: Task; active?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const { total, done } = subtaskStats(task);
  if (!total) return null;
  const complete = done === total;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-[1px] rounded transition-colors ${
        complete ? "bg-moss text-white" : active ? "bg-moss-tint text-moss" : "bg-paper-3 text-ink-soft hover:text-moss"
      }`}
      title="Sous-tâches validées"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" /></svg>
      {done}/{total}
    </button>
  );
}

/** Check-list visible directement sur la carte du tableau (3 premières, « Voir plus »). */
export function CardChecklist({ task, reload }: { task: Task; reload: () => void }) {
  const { canEdit, toast } = useApp();
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  if (!task.subtasks.length) return null;
  const list = all ? task.subtasks : task.subtasks.slice(0, 3);
  const rest = task.subtasks.length - 3;

  async function toggle(e: React.MouseEvent, s: Subtask) {
    e.stopPropagation();
    if (!canEdit) return;
    setBusy(s.id);
    try {
      await patchSubtask(s.id, { done: !s.done });
      reload();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-line space-y-1" onClick={(e) => e.stopPropagation()}>
      {list.map((s) => (
        <label key={s.id} className={`flex items-start gap-2 text-[13px] leading-snug ${canEdit ? "cursor-pointer" : ""}`}>
          <input
            type="checkbox"
            className="mt-[3px] accent-[var(--moss)] shrink-0"
            checked={s.done}
            disabled={!canEdit || busy === s.id}
            onChange={() => {}}
            onClick={(e) => toggle(e, s)}
          />
          {s.color && <span className="w-2.5 h-2.5 rounded-full mt-[4px] shrink-0" style={{ background: s.color }} />}
          <span className={`flex-1 ${s.done ? "line-through text-ink-soft" : ""}`}>{s.title}</span>
          {(s.pastilles.length > 0 || s.attachments.length > 0) && (
            <span className="text-[10px] font-mono text-ink-soft shrink-0 mt-[2px]" title="Liens / fichiers">
              {s.pastilles.length + s.attachments.length}⎘
            </span>
          )}
        </label>
      ))}
      {rest > 0 && (
        <button className="text-[12px] text-ink-soft hover:text-moss pl-5" onClick={() => setAll(!all)}>
          {all ? "Voir moins" : `Voir plus (${rest})`}
        </button>
      )}
    </div>
  );
}

/** Section complète des sous-tâches dans le détail d'une carte. */
export function SubtaskSection({ task, reload }: { task: Task; reload: () => void }) {
  const { canEdit, toast } = useApp();
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const { total, done, pct } = subtaskStats(task);

  async function add() {
    const value = title.trim();
    if (!value) return;
    setTitle("");
    try {
      await api(`/api/tasks/${task.id}/subtasks`, "POST", { title: value, color });
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  const list = hideDone ? task.subtasks.filter((s) => !s.done) : task.subtasks;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <label className="lbl !mb-0">Sous-tâches</label>
        {total > 0 && (
          <>
            <span className="font-mono text-xs text-ink-soft">
              {done}/{total}
            </span>
            {done > 0 && (
              <button className="text-xs text-ink-soft hover:text-moss ml-auto" onClick={() => setHideDone(!hideDone)}>
                {hideDone ? "Afficher les validées" : "Masquer les validées"}
              </button>
            )}
          </>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] w-9 text-ink-soft">{pct}%</span>
          <div className="flex-1 h-2 rounded-full bg-paper-3 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "var(--moss-deep)" : "var(--moss)" }} />
          </div>
        </div>
      )}

      <ul className="space-y-1.5 mb-3">
        {list.map((s) => (
          <SubtaskRow key={s.id} s={s} reload={reload} />
        ))}
      </ul>

      {canEdit && (
        <div className="rounded-lg border border-dashed border-line p-2.5 space-y-2">
          <textarea
            className="field text-sm"
            rows={1}
            placeholder="Ajouter une sous-tâche… (collez plusieurs lignes pour en créer plusieurs)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-ink-soft mr-1">Pastille :</span>
            <button
              className={`w-5 h-5 rounded-full border ${color === null ? "border-ink" : "border-line"} text-[10px] text-ink-soft`}
              onClick={() => setColor(null)}
              title="Sans couleur"
            >
              ∅
            </button>
            {SUBTASK_COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full"
                style={{ background: c, outline: color === c ? "2px solid var(--ink)" : "none", outlineOffset: 1 }}
                onClick={() => setColor(c)}
              />
            ))}
            <button className="btn btn-primary btn-sm ml-auto" onClick={add} disabled={!title.trim()}>
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubtaskRow({ s, reload }: { s: Subtask; reload: () => void }) {
  const { canEdit, toast, storage } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [note, setNote] = useState(s.note);
  const [pForm, setPForm] = useState<{ kind: Pastille["kind"]; label: string; url: string } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [colorMenu, setColorMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run(body: object, ok?: string) {
    try {
      await patchSubtask(s.id, body);
      if (ok) toast(ok);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  async function toggle() {
    await run({ done: !s.done });
    // À la validation, on ouvre le détail pour inviter à joindre la preuve / la réponse
    if (!s.done && s.pastilles.length === 0 && s.attachments.length === 0) setOpen(true);
  }

  async function addPastille() {
    if (!pForm) return;
    const url = pForm.url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast("Le lien doit commencer par https://", "err");
      return;
    }
    if (!url && !pForm.label.trim()) return;
    await run({ pastilles: [...s.pastilles, { id: "", kind: pForm.kind, label: pForm.label.trim(), url }] }, "Pastille ajoutée");
    setPForm(null);
  }

  async function onFiles(files: FileList) {
    const added = [];
    for (const f of Array.from(files)) {
      try {
        setUploading(0);
        added.push(await uploadFile(f, storage, setUploading));
      } catch (e) {
        toast((e as Error).message, "err");
      }
    }
    setUploading(null);
    if (added.length) await run({ attachments: [...s.attachments, ...added] }, `${added.length} fichier(s) ajouté(s)`);
  }

  const extras = s.pastilles.length + s.attachments.length;

  return (
    <li className={`rounded-lg border ${open ? "border-moss/50 bg-paper-2" : "border-transparent hover:border-line"} transition-colors`}>
      <div className="flex items-start gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          className="mt-[5px] accent-[var(--moss)] shrink-0 w-4 h-4"
          checked={s.done}
          disabled={!canEdit}
          onChange={toggle}
          aria-label="Valider la sous-tâche"
        />
        <div className="relative shrink-0 mt-[5px]">
          <button
            className="w-3.5 h-3.5 rounded-full border border-line block"
            style={{ background: s.color ?? "transparent" }}
            disabled={!canEdit}
            onClick={() => setColorMenu(!colorMenu)}
            title="Couleur de la pastille"
          />
          {colorMenu && (
            <div className="absolute z-20 top-5 left-0 card p-1.5 flex gap-1 shadow-lg" onMouseLeave={() => setColorMenu(false)}>
              <button className="w-5 h-5 rounded-full border border-line text-[10px]" onClick={() => { setColorMenu(false); run({ color: null }); }}>∅</button>
              {SUBTASK_COLORS.map((c) => (
                <button key={c} className="w-5 h-5 rounded-full" style={{ background: c }} onClick={() => { setColorMenu(false); run({ color: c }); }} />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              className="field !py-1 text-sm"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setEditing(false);
                if (title.trim() && title !== s.title) run({ title });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button
              className={`text-left text-sm w-full ${s.done ? "line-through text-ink-soft" : ""}`}
              onClick={() => setOpen(!open)}
              onDoubleClick={() => canEdit && setEditing(true)}
            >
              {s.title}
            </button>
          )}
          {/* Pastilles de liens visibles même replié */}
          {s.pastilles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {s.pastilles.map((p) => (
                <PastilleChip key={p.id} p={p} />
              ))}
            </div>
          )}
          {s.done && s.done_by_name && (
            <p className="text-[11px] text-moss font-mono mt-0.5">
              ✓ validée par {s.done_by_name}
              {s.done_at && ` · ${fmtDate(s.done_at, true)}`}
            </p>
          )}
        </div>
        <button className="text-xs text-ink-soft hover:text-moss shrink-0 mt-[3px] font-mono" onClick={() => setOpen(!open)}>
          {extras > 0 && `${extras}⎘ `}
          {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pl-9 space-y-3 fade-in">
          {/* Réponse / note */}
          <div>
            <label className="lbl">Réponse / note</label>
            {canEdit ? (
              <textarea
                className="field text-sm"
                rows={2}
                placeholder="Réponse trouvée, explication, référence…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== s.note && run({ note })}
              />
            ) : (
              <p className="prose-text text-sm">{s.note || <span className="text-ink-soft">—</span>}</p>
            )}
          </div>

          {/* Pastilles de liens */}
          <div>
            <label className="lbl">Pastilles (liens)</label>
            {s.pastilles.length === 0 && !pForm && <p className="text-xs text-ink-soft mb-1">Aucun lien.</p>}
            <ul className="space-y-1 mb-2">
              {s.pastilles.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <PastilleChip p={p} />
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-soft hover:text-moss truncate flex-1 font-mono">
                      {p.url}
                    </a>
                  )}
                  {canEdit && (
                    <button
                      className="text-xs text-ink-soft hover:text-danger ml-auto"
                      onClick={() => run({ pastilles: s.pastilles.filter((x) => x.id !== p.id) })}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit &&
              (pForm ? (
                <div className="rounded-md border border-line bg-paper-3 p-2 space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(PASTILLE_KINDS) as Pastille["kind"][]).map((k) => (
                      <button
                        key={k}
                        onClick={() => setPForm({ ...pForm, kind: k })}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full border-2"
                        style={
                          pForm.kind === k
                            ? { background: PASTILLE_KINDS[k].color, borderColor: PASTILLE_KINDS[k].color, color: "#fff" }
                            : { borderColor: PASTILLE_KINDS[k].color, color: PASTILLE_KINDS[k].color }
                        }
                      >
                        {PASTILLE_KINDS[k].label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="field !py-1.5 text-sm"
                    placeholder="https://… (lien vers la source ou la réponse)"
                    value={pForm.url}
                    autoFocus
                    onChange={(e) => setPForm({ ...pForm, url: e.target.value })}
                  />
                  <input
                    className="field !py-1.5 text-sm"
                    placeholder="Libellé (ex. Fournisseur agar, Norme ISO…)"
                    value={pForm.label}
                    onChange={(e) => setPForm({ ...pForm, label: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addPastille()}
                  />
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={addPastille}>
                      Ajouter la pastille
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPForm(null)}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setPForm({ kind: "source", label: "", url: "" })}>
                  + Pastille / lien
                </button>
              ))}
          </div>

          {/* Fichiers justificatifs */}
          <div>
            <label className="lbl">Fichiers & images</label>
            {s.attachments.length === 0 && <p className="text-xs text-ink-soft mb-1">Aucun fichier.</p>}
            <div className="flex flex-wrap gap-2 mb-2 items-start">
              {s.attachments.map((a) => (
                <div key={a.url} className="relative group/att">
                  {fileKind(a.content_type, a.name) === "image" ? (
                    <a href={fileHref(a.url)} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileHref(a.url)} alt={a.name} className="h-20 w-28 object-cover rounded-md border border-line" loading="lazy" />
                    </a>
                  ) : (
                    <AttachmentView a={a} />
                  )}
                  {canEdit && (
                    <button
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs opacity-0 group-hover/att:opacity-100"
                      onClick={() => confirm(`Retirer « ${a.name} » ?`) && run({ attachments: s.attachments.filter((x) => x.url !== a.url) })}
                      title="Retirer"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <>
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && (onFiles(e.target.files), (e.target.value = ""))} />
                <button className="btn btn-ghost btn-sm" disabled={uploading !== null} onClick={() => fileInput.current?.click()}>
                  {uploading !== null ? `Envoi ${Math.round(uploading)}%` : "+ Fichier / image"}
                </button>
              </>
            )}
          </div>

          {canEdit && (
            <div className="flex gap-2 pt-1 border-t border-line">
              <button className="text-xs text-ink-soft hover:text-moss" onClick={() => setEditing(true)}>
                Renommer
              </button>
              <button
                className="text-xs text-ink-soft hover:text-danger ml-auto"
                onClick={async () => {
                  if (!confirm(`Supprimer la sous-tâche « ${s.title} » ?`)) return;
                  try {
                    await api(`/api/subtasks/${s.id}`, "DELETE");
                    reload();
                  } catch (e) {
                    toast((e as Error).message, "err");
                  }
                }}
              >
                Supprimer la sous-tâche
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function PastilleChip({ p }: { p: Pastille }) {
  const meta = PASTILLE_KINDS[p.kind] ?? PASTILLE_KINDS.info;
  const content = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
      {meta.label}
      {p.label && <span className="font-normal opacity-90">· {p.label}</span>}
      {p.url && <span>↗</span>}
    </>
  );
  const cls = "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[2px] rounded-full text-white max-w-[260px] truncate";
  return p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:opacity-85`} style={{ background: meta.color }} onClick={(e) => e.stopPropagation()}>
      {content}
    </a>
  ) : (
    <span className={cls} style={{ background: meta.color }}>
      {content}
    </span>
  );
}

/** Couleur graduelle : rouge (0 %) → orange → jaune → vert (100 %). */
export function progressColor(pct: number) {
  const hue = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 125);
  return `hsl(${hue} 72% 45%)`;
}

/** Rond de progression qui passe du rouge au vert selon les sous-tâches cochées. */
export function ProgressRing({ task, size = 20, showLabel = false }: { task: Task; size?: number; showLabel?: boolean }) {
  const { total, done, pct } = subtaskStats(task);
  if (!total) return null;
  const stroke = Math.max(2.5, size / 7);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = progressColor(pct);
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title={`${done}/${total} sous-tâches validées (${pct} %)`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={pct === 100 ? color : "none"}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray .4s ease, stroke .4s ease, fill .4s ease" }}
        />
        {pct === 100 && (
          <path
            d={`M${size * 0.3} ${size * 0.52} l${size * 0.14} ${size * 0.14} l${size * 0.26} -${size * 0.3}`}
            fill="none"
            stroke="#fff"
            strokeWidth={Math.max(1.6, size / 11)}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`rotate(90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {showLabel && (
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {pct}%
        </span>
      )}
    </span>
  );
}
