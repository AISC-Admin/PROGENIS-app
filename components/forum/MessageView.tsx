"use client";
import { useState } from "react";
import { api, Avatar, fmtDate, RoleBadge, timeAgo, useApp } from "../client";
import { detectAiProvider, fileHref, fileKind, formatSize, URL_RE, type AiLink, type Attachment } from "@/lib/shared";
import { AiBadge } from "./AiBadge";

export type Message = {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_color: string | null;
  user_role: string | null;
  body: string;
  attachments: Attachment[];
  ai_links: AiLink[];
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
};

/** Texte avec liens cliquables (les liens IA reçoivent un badge). */
export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const p = detectAiProvider(url);
    parts.push(
      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-moss underline decoration-moss/40 hover:decoration-moss break-all">
        {p && (
          <>
            <AiBadge provider={p.id} />{" "}
          </>
        )}
        {url}
      </a>,
    );
    last = i + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="prose-text text-[15px]">{parts}</p>;
}

export function AttachmentView({ a }: { a: Attachment }) {
  const kind = fileKind(a.content_type, a.name);
  const href = fileHref(a.url);
  if (kind === "image")
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={a.name} className="max-h-72 max-w-full rounded-lg border border-line object-contain bg-paper-3" loading="lazy" />
      </a>
    );
  if (kind === "audio")
    return (
      <div className="rounded-lg border border-line bg-paper-3 p-2 max-w-md">
        <div className="text-xs text-ink-soft mb-1 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>
          {a.name}
        </div>
        <audio controls preload="metadata" src={href} className="w-full h-9" />
      </div>
    );
  if (kind === "video")
    return <video controls preload="metadata" src={href} className="max-h-80 max-w-full rounded-lg border border-line bg-black" />;
  return (
    <a
      href={kind === "pdf" ? href : fileHref(a.url, true)}
      target={kind === "pdf" ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2.5 rounded-lg border border-line bg-paper-3 px-3 py-2 hover:border-moss max-w-sm"
    >
      <span className="font-mono text-[10px] uppercase rounded bg-moss-deep text-white px-1.5 py-1">
        {kind === "pdf" ? "PDF" : (a.name.split(".").pop() ?? "fic").slice(0, 4)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm truncate">{a.name}</span>
        <span className="block text-[11px] text-ink-soft font-mono">{formatSize(a.size)} · {kind === "pdf" ? "ouvrir" : "télécharger"}</span>
      </span>
    </a>
  );
}

export function AiLinkCard({ l }: { l: AiLink }) {
  let host = l.url;
  try {
    host = new URL(l.url).hostname;
  } catch {}
  return (
    <a
      href={l.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-line bg-paper-2 px-3 py-2 hover:border-moss max-w-lg"
    >
      <AiBadge provider={l.provider} size="md" />
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate">{l.title || "Conversation / recherche IA"}</span>
        <span className="block text-[11px] text-ink-soft font-mono truncate">{host}</span>
      </span>
      <span className="ml-auto text-ink-soft">↗</span>
    </a>
  );
}

export default function MessageView({ m, reload, first }: { m: Message; reload: () => void; first?: boolean }) {
  const { me, canEdit, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const own = m.user_id === me.id;

  async function save() {
    try {
      await api(`/api/messages/${m.id}`, "PATCH", { body: text });
      setEditing(false);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function del() {
    if (!confirm("Supprimer ce message ? Une trace restera dans l'historique.")) return;
    try {
      await api(`/api/messages/${m.id}`, "DELETE");
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  if (m.deleted)
    return (
      <div className="flex gap-3 py-2 text-sm text-ink-soft italic pl-12">
        Message supprimé · {m.user_name} · {fmtDate(m.created_at, true)}
      </div>
    );

  return (
    <article id={`m${m.id}`} className={`group flex gap-3 py-4 ${first ? "" : "border-t border-line"}`}>
      <Avatar name={m.user_name ?? "?"} color={m.user_color ?? "#888"} size={36} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
          <span className="font-semibold text-[14px]">{m.user_name ?? "Ancien membre"}</span>
          {m.user_role && <RoleBadge role={m.user_role} />}
          <span className="text-xs text-ink-soft" title={fmtDate(m.created_at, true)}>
            {timeAgo(m.created_at)}
            {m.edited_at && " · modifié"}
          </span>
          {canEdit && (own || me.role === "manager") && !editing && (
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 text-xs">
              {own && (
                <button className="text-ink-soft hover:text-moss" onClick={() => setEditing(true)}>
                  modifier
                </button>
              )}
              <button className="text-ink-soft hover:text-danger" onClick={del}>
                supprimer
              </button>
            </span>
          )}
        </header>

        {editing ? (
          <div className="space-y-2">
            <textarea className="field" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={save}>
                Enregistrer
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          m.body && <RichText text={m.body} />
        )}

        {m.ai_links.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {m.ai_links.map((l, i) => (
              <AiLinkCard key={i} l={l} />
            ))}
          </div>
        )}
        {m.attachments.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2 items-start">
            {m.attachments.map((a, i) => (
              <AttachmentView key={i} a={a} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
