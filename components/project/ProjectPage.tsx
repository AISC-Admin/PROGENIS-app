"use client";
import { useRef, useState } from "react";
import { api, fmtDate, Modal, ReadOnlyNotice, timeAgo, useApp, usePolling } from "../client";
import { uploadFile } from "../upload";
import { AttachmentView, RichText } from "../forum/MessageView";
import { BRAND } from "@/lib/brand";
import { fileHref, fileKind, formatSize } from "@/lib/shared";

type Section = { id: number; title: string; content: string; position: number; updated_by_name: string | null; updated_at: string };
type Milestone = { id: number; title: string; description: string; due_date: string | null; status: "prevu" | "en_cours" | "atteint" | "retard" };
type Doc = { id: number; name: string; description: string; url: string; content_type: string; size: number; uploaded_by: number | null; uploaded_by_name: string | null; created_at: string };
type Data = { sections: Section[]; milestones: Milestone[]; documents: Doc[] };
type BoardStats = { tasks: { done: boolean; progress: { percent: number }[] }[] };

const STATUS: Record<Milestone["status"], { label: string; color: string }> = {
  prevu: { label: "Prévu", color: "#7a8a70" },
  en_cours: { label: "En cours", color: "#d9a04a" },
  atteint: { label: "Atteint", color: "#5c9450" },
  retard: { label: "En retard", color: "#dc2626" },
};

export default function ProjectPage() {
  const { canEdit, toast } = useApp();
  const { data, reload, error } = usePolling<Data>("/api/project", 15000);
  const { data: board } = usePolling<BoardStats>("/api/tasks", 30000);

  async function run(p: Promise<unknown>, ok?: string) {
    try {
      await p;
      if (ok) toast(ok);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  if (!data) return <div className="p-8 text-ink-soft">{error ?? "Chargement…"}</div>;

  const tasks = board?.tasks ?? [];
  const avg = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + (t.done ? 100 : t.progress[t.progress.length - 1]?.percent ?? 0), 0) / tasks.length)
    : 0;
  const reached = data.milestones.filter((m) => m.status === "atteint").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <p className="eyebrow mb-1">03 — Projet</p>
        <h1 className="text-3xl">Stratégie &amp; projet</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">{BRAND.description}</p>
      </div>
      <ReadOnlyNotice />

      {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Stat n={`${avg}%`} label="Avancement moyen des tâches" />
        <Stat n={`${tasks.filter((t) => t.done).length}/${tasks.length}`} label="Cartes terminées" />
        <Stat n={`${reached}/${data.milestones.length}`} label="Jalons atteints" />
        <Stat n={String(data.documents.length)} label="Documents de référence" />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        {/* Sections stratégiques */}
        <div className="space-y-4">
          {data.sections.map((s) => (
            <SectionCard key={s.id} s={s} canEdit={canEdit} run={run} />
          ))}
          {canEdit && <AddSection run={run} />}
        </div>

        {/* Jalons + documents */}
        <div className="space-y-8">
          <Milestones items={data.milestones} canEdit={canEdit} run={run} />
          <Documents docs={data.documents} canEdit={canEdit} run={run} />
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="card p-4">
      <div className="serif text-3xl text-moss">{n}</div>
      <div className="text-xs text-ink-soft mt-1">{label}</div>
    </div>
  );
}

type Run = (p: Promise<unknown>, ok?: string) => Promise<void>;

function SectionCard({ s, canEdit, run }: { s: Section; canEdit: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [content, setContent] = useState(s.content);
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3 mb-2">
        {editing ? (
          <input className="field serif !text-xl flex-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        ) : (
          <h2 className="text-xl flex-1">{s.title}</h2>
        )}
        {canEdit && !editing && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setTitle(s.title);
              setContent(s.content);
              setEditing(true);
            }}
          >
            Modifier
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea className="field text-sm leading-relaxed" rows={8} value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => run(api(`/api/project/sections/${s.id}`, "PATCH", { title, content }), "Section enregistrée").then(() => setEditing(false))}
            >
              Enregistrer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger btn-sm ml-auto"
              onClick={() => confirm(`Supprimer la section « ${s.title} » ?`) && run(api(`/api/project/sections/${s.id}`, "DELETE"))}
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : s.content ? (
        <RichText text={s.content} />
      ) : (
        <p className="text-sm text-ink-soft italic">À rédiger{canEdit ? " — cliquez sur « Modifier »." : "."}</p>
      )}
      {s.updated_by_name && !editing && (
        <p className="text-[11px] font-mono text-ink-soft mt-3">
          Mis à jour par {s.updated_by_name} · {timeAgo(s.updated_at)}
        </p>
      )}
    </section>
  );
}

function AddSection({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-soft hover:border-moss hover:text-moss">
        + Ajouter une section (ex. Budget, Partenaires, Risques…)
      </button>
    );
  return (
    <div className="card p-4 flex gap-2">
      <input className="field flex-1" autoFocus placeholder="Titre de la section" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button
        className="btn btn-primary"
        disabled={!title.trim()}
        onClick={() =>
          run(api("/api/project/sections", "POST", { title })).then(() => {
            setTitle("");
            setOpen(false);
          })
        }
      >
        Ajouter
      </button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>
        ×
      </button>
    </div>
  );
}

function Milestones({ items, canEdit, run }: { items: Milestone[]; canEdit: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Milestone | null>(null);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", status: "prevu" });

  const openNew = () => {
    setEdit(null);
    setForm({ title: "", description: "", due_date: "", status: "prevu" });
    setOpen(true);
  };
  const openEdit = (m: Milestone) => {
    setEdit(m);
    setForm({ title: m.title, description: m.description, due_date: m.due_date?.slice(0, 10) ?? "", status: m.status });
    setOpen(true);
  };
  const save = () =>
    run(
      edit ? api(`/api/project/milestones/${edit.id}`, "PATCH", form) : api("/api/project/milestones", "POST", form),
      edit ? "Jalon mis à jour" : "Jalon ajouté",
    ).then(() => setOpen(false));

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl">Jalons</h2>
        {canEdit && (
          <button className="btn btn-ghost btn-sm" onClick={openNew}>
            + Jalon
          </button>
        )}
      </div>
      {items.length === 0 && <p className="text-sm text-ink-soft">Aucun jalon défini.</p>}
      <ol className="relative border-l-2 border-line ml-2 space-y-4">
        {items.map((m) => (
          <li key={m.id} className="pl-5 relative">
            <span className="absolute -left-[8px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-paper" style={{ background: STATUS[m.status].color }} />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-ink-soft">{m.due_date ? fmtDate(m.due_date) : "sans date"}</span>
              <span className="text-[10px] font-semibold px-1.5 py-[1px] rounded text-white" style={{ background: STATUS[m.status].color }}>
                {STATUS[m.status].label}
              </span>
            </div>
            <button className={`text-left font-medium mt-0.5 ${canEdit ? "hover:text-moss" : "cursor-default"}`} onClick={() => canEdit && openEdit(m)}>
              {m.title}
            </button>
            {m.description && <p className="text-sm text-ink-soft prose-text">{m.description}</p>}
          </li>
        ))}
      </ol>

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Modifier le jalon" : "Nouveau jalon"}>
        <div className="space-y-3">
          <div>
            <label className="lbl">Titre</label>
            <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">Date cible</label>
              <input type="date" className="field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Statut</label>
              <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="lbl">Description</label>
            <textarea className="field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn btn-primary" disabled={!form.title.trim()} onClick={save}>
              Enregistrer
            </button>
            {edit && (
              <button
                className="btn btn-danger ml-auto"
                onClick={() => confirm("Supprimer ce jalon ?") && run(api(`/api/project/milestones/${edit.id}`, "DELETE")).then(() => setOpen(false))}
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}

function Documents({ docs, canEdit, run }: { docs: Doc[]; canEdit: boolean; run: Run }) {
  const { storage, toast, me } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);

  async function onFiles(files: FileList) {
    for (const f of Array.from(files)) {
      try {
        setProgress(0);
        const a = await uploadFile(f, storage, setProgress);
        await run(api("/api/project/documents", "POST", a), `« ${f.name} » ajouté`);
      } catch (e) {
        toast((e as Error).message, "err");
      }
    }
    setProgress(null);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl">Documents</h2>
        {canEdit && (
          <>
            <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && (onFiles(e.target.files), (e.target.value = ""))} />
            <button className="btn btn-ghost btn-sm" disabled={progress !== null} onClick={() => input.current?.click()}>
              {progress !== null ? `Envoi ${Math.round(progress)}%` : "+ Document"}
            </button>
          </>
        )}
      </div>
      {docs.length === 0 && <p className="text-sm text-ink-soft">Aucun document de référence.</p>}
      <ul className="space-y-2">
        {docs.map((d) => {
          const kind = fileKind(d.content_type, d.name);
          return (
            <li key={d.id} className="card px-3 py-2.5 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase rounded bg-moss-deep text-white px-1.5 py-1 shrink-0">
                {kind === "file" ? (d.name.split(".").pop() ?? "fic").slice(0, 4) : kind === "pdf" ? "PDF" : kind.slice(0, 3)}
              </span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setPreview(d)}>
                <span className="block text-sm truncate hover:text-moss">{d.name}</span>
                <span className="block text-[11px] text-ink-soft font-mono">
                  {formatSize(d.size)} · {d.uploaded_by_name ?? "—"} · {fmtDate(d.created_at)}
                </span>
              </button>
              <a className="text-ink-soft hover:text-moss text-sm" href={fileHref(d.url, true)} title="Télécharger">
                ↓
              </a>
              {canEdit && (d.uploaded_by === me.id || me.role === "manager") && (
                <button
                  className="text-ink-soft hover:text-danger text-sm"
                  title="Retirer"
                  onClick={() => confirm(`Retirer « ${d.name} » ?`) && run(api(`/api/project/documents/${d.id}`, "DELETE"))}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} wide>
        {preview &&
          (fileKind(preview.content_type, preview.name) === "pdf" ? (
            <iframe src={fileHref(preview.url)} className="w-full h-[70vh] rounded border border-line" title={preview.name} />
          ) : (
            <AttachmentView a={preview} />
          ))}
      </Modal>
    </section>
  );
}
