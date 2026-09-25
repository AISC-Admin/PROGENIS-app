"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Avatar, Modal, ReadOnlyNotice, timeAgo, useApp, usePolling } from "../client";
import { AI_PROVIDERS } from "@/lib/shared";
import Composer from "./Composer";
import { AiBadge } from "./AiBadge";

type Thread = {
  id: number;
  title: string;
  category: string;
  pinned: boolean;
  created_by_name: string | null;
  created_by_color: string | null;
  created_at: string;
  last_activity: string;
  message_count: number;
  file_count: number;
  ai_link_count: number;
  last_author: string | null;
};
type LibLink = {
  url: string;
  title: string;
  provider: string;
  created_at: string;
  thread_id: number;
  thread_title: string;
  message_id: number;
  user_name: string | null;
  user_color: string | null;
};

export default function ThreadList() {
  const { canEdit } = useApp();
  const [view, setView] = useState<"threads" | "ia">("threads");
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1">02 — Réflexion</p>
          <h1 className="text-3xl">Espace de réflexion</h1>
          <p className="text-sm text-ink-soft mt-1">
            Toutes les discussions sont conservées : textes, documents, vocaux, vidéos et recherches IA partagées.
          </p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 bg-paper-2">
          {(
            [
              ["threads", "Discussions"],
              ["ia", "Bibliothèque IA"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`px-3 py-1.5 rounded-md text-sm ${view === k ? "bg-moss-deep text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ReadOnlyNotice />
      {view === "threads" ? <Threads canEdit={canEdit} /> : <Library />}
    </div>
  );
}

function Threads({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const { data, error } = usePolling<Thread[]>("/api/threads", 10000);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Général");
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const categories = useMemo(() => Array.from(new Set((data ?? []).map((t) => t.category))).sort(), [data]);
  const list = (data ?? []).filter(
    (t) => (!filter || t.category === filter) && (!q || t.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input className="field !w-60 !py-1.5" placeholder="Rechercher un sujet…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`text-xs px-2.5 py-1 rounded-full border ${!filter ? "bg-moss-tint text-moss border-moss/40" : "border-line text-ink-soft"}`} onClick={() => setFilter(null)}>
          Tous
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={`text-xs px-2.5 py-1 rounded-full border ${filter === c ? "bg-moss-tint text-moss border-moss/40" : "border-line text-ink-soft"}`}
            onClick={() => setFilter(filter === c ? null : c)}
          >
            {c}
          </button>
        ))}
        {canEdit && (
          <button className="btn btn-primary ml-auto" onClick={() => setOpen(true)}>
            + Nouveau sujet
          </button>
        )}
      </div>

      {!data && <p className="text-ink-soft">{error ?? "Chargement…"}</p>}
      {data && list.length === 0 && (
        <div className="card p-10 text-center text-ink-soft">
          <p className="serif text-xl text-ink mb-1">Aucun sujet pour l&apos;instant</p>
          <p className="text-sm">Lancez la première discussion pour partager idées, documents et recherches.</p>
        </div>
      )}

      <ul className="card divide-y divide-line overflow-hidden">
        {list.map((t) => (
          <li key={t.id}>
            <Link href={`/reflexion/${t.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-paper-3 transition-colors">
              <Avatar name={t.created_by_name ?? "?"} color={t.created_by_color ?? "#888"} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.pinned && <span className="font-mono text-[10px] uppercase tracking-wider text-amber">Épinglé</span>}
                  <span className="font-medium truncate">{t.title}</span>
                </div>
                <div className="text-xs text-ink-soft mt-0.5 flex flex-wrap gap-x-3">
                  <span className="text-moss">{t.category}</span>
                  <span>par {t.created_by_name ?? "—"}</span>
                  <span>
                    dernier message {t.last_author ? `de ${t.last_author} ` : ""}
                    {timeAgo(t.last_activity)}
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-ink-soft shrink-0">
                <span title="Messages">✉ {t.message_count}</span>
                {t.file_count > 0 && <span title="Fichiers">⎘ {t.file_count}</span>}
                {t.ai_link_count > 0 && <span title="Liens IA" className="text-moss">✦ {t.ai_link_count}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau sujet de réflexion" wide>
        <div className="grid sm:grid-cols-[1fr_200px] gap-3 mb-3">
          <div>
            <label className="lbl">Titre</label>
            <input className="field" placeholder="Ex. : Protocole de sevrage en PhytoBox" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="lbl">Catégorie</label>
            <input className="field" list="cats" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="cats">
              {["Général", "Laboratoire", "Terrain Afrique", "Financement", "Juridique", "Recherche IA", ...categories].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <Composer
          submitLabel="Créer le sujet"
          placeholder="Premier message : contexte, question, pistes…"
          onSubmit={async (p) => {
            if (!title.trim()) throw new Error("Donnez un titre au sujet.");
            const r = await api<{ thread: { id: number } }>("/api/threads", "POST", { title, category, ...p });
            setOpen(false);
            setTitle("");
            router.push(`/reflexion/${r.thread.id}`);
          }}
        />
      </Modal>
    </>
  );
}

function Library() {
  const { data, error } = usePolling<LibLink[]>("/api/ai-links", 15000);
  const [provider, setProvider] = useState<string | null>(null);
  const list = (data ?? []).filter((l) => !provider || l.provider === provider);
  const counts = (data ?? []).reduce<Record<string, number>>((acc, l) => ((acc[l.provider] = (acc[l.provider] ?? 0) + 1), acc), {});

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className={`text-xs px-2.5 py-1 rounded-full border ${!provider ? "bg-moss-tint text-moss border-moss/40" : "border-line text-ink-soft"}`} onClick={() => setProvider(null)}>
          Toutes ({data?.length ?? 0})
        </button>
        {[...AI_PROVIDERS.map((p) => p.id), "autre"]
          .filter((id) => counts[id])
          .map((id) => (
            <button key={id} onClick={() => setProvider(provider === id ? null : id)} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${provider === id ? "border-moss" : "border-line"}`}>
              <AiBadge provider={id} /> {counts[id]}
            </button>
          ))}
      </div>
      {!data && <p className="text-ink-soft">{error ?? "Chargement…"}</p>}
      {data && list.length === 0 && (
        <div className="card p-10 text-center text-ink-soft">
          <p className="serif text-xl text-ink mb-1">Aucune recherche IA partagée</p>
          <p className="text-sm">Utilisez le bouton « Lien IA » dans une discussion pour partager une conversation DeepSeek, Claude ou ChatGPT.</p>
        </div>
      )}
      <ul className="grid sm:grid-cols-2 gap-3">
        {list.map((l, i) => {
          let host = l.url;
          try {
            host = new URL(l.url).hostname;
          } catch {}
          return (
            <li key={i} className="card p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AiBadge provider={l.provider} size="md" />
                <span className="text-xs text-ink-soft ml-auto">{timeAgo(l.created_at)}</span>
              </div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-moss">
                {l.title || "Conversation / recherche IA"} ↗
              </a>
              <span className="font-mono text-[11px] text-ink-soft truncate">{host}</span>
              <div className="flex items-center gap-2 text-xs text-ink-soft border-t border-line pt-2 mt-auto">
                <Avatar name={l.user_name ?? "?"} color={l.user_color ?? "#888"} size={20} />
                {l.user_name} dans{" "}
                <Link className="text-moss hover:underline truncate" href={`/reflexion/${l.thread_id}#m${l.message_id}`}>
                  {l.thread_title}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
