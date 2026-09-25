"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, useApp, usePolling } from "../client";
import Composer from "./Composer";
import MessageView, { type Message } from "./MessageView";

type Thread = { id: number; title: string; category: string; pinned: boolean; created_by: number | null; created_by_name: string | null; created_at: string };

export default function ThreadView({ id }: { id: number }) {
  const { canEdit, me, toast } = useApp();
  const router = useRouter();
  const { data, error, reload } = usePolling<{ thread: Thread; messages: Message[] }>(`/api/threads/${id}/messages`, 5000);
  const bottom = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");

  // Défilement automatique à l'arrivée de nouveaux messages (sauf si on vise une ancre #mID)
  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n > lastCount.current) {
      if (lastCount.current === 0 && window.location.hash) {
        document.querySelector(window.location.hash)?.scrollIntoView({ block: "center" });
      } else if (lastCount.current > 0) {
        bottom.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    lastCount.current = n;
  }, [data?.messages.length]);

  if (!data) return <div className="p-8 text-ink-soft">{error ?? "Chargement…"}</div>;
  const { thread, messages } = data;
  const canManage = me.role === "manager" || (canEdit && thread.created_by === me.id);

  async function patch(body: object) {
    try {
      await api(`/api/threads/${id}`, "PATCH", body);
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/reflexion" className="text-sm text-ink-soft hover:text-moss">
        ← Tous les sujets
      </Link>
      <header className="mt-3 mb-6 pb-5 border-b border-line">
        <p className="eyebrow mb-1">
          {thread.category}
          {thread.pinned && " · épinglé"}
        </p>
        {renaming ? (
          <input
            className="field serif !text-2xl"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              if (title.trim() && title !== thread.title) patch({ title });
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <h1 className="text-3xl">{thread.title}</h1>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-ink-soft">
          <span>
            Ouvert par {thread.created_by_name ?? "—"} le {fmtDate(thread.created_at, true)} · {messages.filter((m) => !m.deleted).length} message(s)
          </span>
          <span className="ml-auto flex gap-2">
            {canManage && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setTitle(thread.title);
                  setRenaming(true);
                }}
              >
                Renommer
              </button>
            )}
            {me.role === "manager" && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => patch({ pinned: !thread.pinned })}>
                  {thread.pinned ? "Désépingler" : "Épingler"}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (!confirm("Supprimer définitivement ce sujet et tous ses messages ?")) return;
                    await api(`/api/threads/${id}`, "DELETE");
                    router.push("/reflexion");
                  }}
                >
                  Supprimer
                </button>
              </>
            )}
          </span>
        </div>
      </header>

      <div>
        {messages.map((m, i) => (
          <MessageView key={m.id} m={m} reload={reload} first={i === 0} />
        ))}
      </div>
      <div ref={bottom} />

      {canEdit ? (
        <div className="sticky bottom-3 mt-6">
          <Composer
            compact
            placeholder="Répondre dans la discussion…"
            submitLabel="Envoyer"
            onSubmit={async (p) => {
              await api(`/api/threads/${id}/messages`, "POST", p);
              await reload();
              setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-soft border-t border-line pt-4">Lecture seule : vous ne pouvez pas répondre avec un accès visionneur.</p>
      )}
    </div>
  );
}
