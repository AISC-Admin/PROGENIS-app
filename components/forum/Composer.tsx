"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../client";
import { uploadFile } from "../upload";
import { AI_PROVIDERS, detectAiProvider, formatSize, URL_RE, type AiLink, type Attachment } from "@/lib/shared";
import { AiBadge } from "./AiBadge";

type Pending = { key: string; name: string; progress: number; done?: Attachment; error?: string };
export type ComposerPayload = { body: string; attachments: Attachment[]; ai_links: AiLink[] };

export default function Composer({
  onSubmit,
  placeholder = "Partagez une idée, une question, un résultat…",
  submitLabel = "Publier",
  compact,
}: {
  onSubmit: (p: ComposerPayload) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  compact?: boolean;
}) {
  const { storage, toast } = useApp();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [links, setLinks] = useState<AiLink[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  // --- Enregistrement vocal ---
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toLocaleString("fr-FR").replace(/[/:, ]+/g, "-");
        const file = new File(chunks.current, `vocal-${stamp}.${ext}`, { type: type.split(";")[0] });
        addFiles([file]);
      };
      rec.start();
      recorder.current = rec;
      setRecSeconds(0);
      setRecording(true);
    } catch {
      toast("Micro inaccessible : autorisez l'accès au microphone dans votre navigateur.", "err");
    }
  }
  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  function addFiles(list: FileList | File[]) {
    for (const f of Array.from(list)) {
      const key = `${Date.now()}-${Math.random()}`;
      setFiles((p) => [...p, { key, name: f.name, progress: 0 }]);
      uploadFile(f, storage, (pct) => setFiles((p) => p.map((x) => (x.key === key ? { ...x, progress: pct } : x))))
        .then((done) => setFiles((p) => p.map((x) => (x.key === key ? { ...x, done, progress: 100 } : x))))
        .catch((e) => setFiles((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x))));
    }
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast("Collez une adresse complète (https://…)", "err");
      return;
    }
    const p = detectAiProvider(url);
    setLinks((l) => [...l, { url, title: linkTitle.trim(), provider: p?.id ?? "autre" }]);
    setLinkUrl("");
    setLinkTitle("");
    setLinkOpen(false);
  }

  const uploading = files.some((f) => !f.done && !f.error);

  async function submit() {
    if (uploading) return;
    // Détection automatique des liens IA collés dans le texte
    const auto: AiLink[] = [];
    for (const m of body.match(URL_RE) ?? []) {
      const p = detectAiProvider(m);
      if (p && !links.some((l) => l.url === m) && !auto.some((l) => l.url === m)) auto.push({ url: m, title: "", provider: p.id });
    }
    const payload = {
      body: body.trim(),
      attachments: files.filter((f) => f.done).map((f) => f.done!) ,
      ai_links: [...links, ...auto],
    };
    if (!payload.body && !payload.attachments.length && !payload.ai_links.length) return;
    setSending(true);
    try {
      await onSubmit(payload);
      setBody("");
      setFiles([]);
      setLinks([]);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSending(false);
    }
  }

  const detected = linkUrl ? detectAiProvider(linkUrl) : null;

  return (
    <div
      className="card p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <textarea
        className="w-full bg-transparent outline-none resize-y text-[15px] leading-relaxed min-h-[60px]"
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />

      {(files.length > 0 || links.length > 0) && (
        <div className="flex flex-wrap gap-2 my-2">
          {files.map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-xs border border-line rounded-md px-2 py-1 bg-paper-3 max-w-[260px]">
              <span className="truncate">{f.name}</span>
              {f.error ? (
                <span className="text-danger">échec</span>
              ) : f.done ? (
                <span className="text-moss font-mono">{formatSize(f.done.size)}</span>
              ) : (
                <span className="font-mono text-ink-soft">{Math.round(f.progress)}%</span>
              )}
              <button className="text-ink-soft hover:text-danger" onClick={() => setFiles((p) => p.filter((x) => x.key !== f.key))}>
                ×
              </button>
            </div>
          ))}
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-xs border border-line rounded-md px-2 py-1 bg-paper-3 max-w-[320px]">
              <AiBadge provider={l.provider} />
              <span className="truncate">{l.title || l.url}</span>
              <button className="text-ink-soft hover:text-danger" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {linkOpen && (
        <div className="rounded-md border border-line bg-paper-3 p-2.5 my-2 space-y-2 fade-in">
          <p className="text-xs text-ink-soft">
            Collez le lien de partage d&apos;une conversation ou recherche IA ({AI_PROVIDERS.slice(0, 3).map((p) => p.name).join(", ")}…).
          </p>
          <div className="flex gap-2 items-center">
            <input className="field !py-1.5 flex-1" placeholder="https://chat.deepseek.com/share/…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} autoFocus />
            {detected && <AiBadge provider={detected.id} />}
          </div>
          <input className="field !py-1.5" placeholder="Titre / sujet de la recherche (facultatif)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={addLink}>
              Ajouter le lien
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLinkOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line mt-1">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && (addFiles(e.target.files), (e.target.value = ""))} />
        <input ref={videoInput} type="file" accept="video/*" capture="environment" hidden onChange={(e) => e.target.files && (addFiles(e.target.files), (e.target.value = ""))} />
        <ToolButton onClick={() => fileInput.current?.click()} title="Joindre des documents, images, PDF…">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></svg>
          Document
        </ToolButton>
        <ToolButton onClick={() => videoInput.current?.click()} title="Ajouter une vidéo">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3z" /></svg>
          Vidéo
        </ToolButton>
        {recording ? (
          <button className="btn btn-sm bg-danger-tint text-danger border-danger" onClick={stopRecording}>
            <span className="w-2 h-2 rounded-full bg-danger rec-dot" /> Arrêter · {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
          </button>
        ) : (
          <ToolButton onClick={startRecording} title="Enregistrer un message vocal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>
            Vocal
          </ToolButton>
        )}
        <ToolButton onClick={() => setLinkOpen(!linkOpen)} title="Partager un lien de recherche IA">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
          Lien IA
        </ToolButton>
        <span className="text-[11px] text-ink-soft ml-1 hidden sm:inline">Glissez-déposez des fichiers · Ctrl/⌘+Entrée pour publier</span>
        <button className="btn btn-primary btn-sm ml-auto" onClick={submit} disabled={sending || uploading}>
          {uploading ? "Envoi des fichiers…" : sending ? "Publication…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function ToolButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="btn btn-sm btn-ghost !border-transparent hover:!border-line text-ink-soft">
      {children}
    </button>
  );
}
