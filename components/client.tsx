"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ROLE_LABELS } from "@/lib/shared";

export type Storage = "local" | "private" | "public";
export type Me = { id: number; name: string; role: "manager" | "editeur" | "visionneur"; color: string };
type Ctx = { me: Me; storage: Storage; canEdit: boolean; toast: (msg: string, kind?: "ok" | "err") => void };

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppProvider manquant");
  return c;
};

export function AppProvider({ me, storage, children }: { me: Me; storage: Storage; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <AppCtx.Provider value={{ me, storage, canEdit: me.role !== "visionneur", toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fade-in rounded-lg px-4 py-3 text-sm shadow-lg border ${
              t.kind === "err" ? "bg-danger-tint text-danger border-danger" : "bg-paper-2 text-ink border-line"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

/** Appel JSON vers l'API avec message d'erreur lisible. */
export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expirée");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data as T;
}

/** Charge des données et les rafraîchit périodiquement (onglet visible uniquement). */
export function usePolling<T>(url: string, intervalMs = 8000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;
  const reload = useCallback(async () => {
    try {
      const d = await api<T>(urlRef.current);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, intervalMs);
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [url, intervalMs, reload]);
  return { data, setData, error, reload };
}

export function Avatar({ name, color, size = 26, title }: { name: string; color: string; size?: number; title?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      title={title ?? name}
      className="inline-flex items-center justify-center rounded-full font-mono font-medium text-white shrink-0 ring-2 ring-paper-2"
      style={{ background: color, width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {initials || "?"}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    manager: "bg-amber-tint text-amber border-amber/40",
    editeur: "bg-moss-tint text-moss border-moss/40",
    visionneur: "bg-paper-3 text-ink-soft border-line",
  };
  return (
    <span className={`inline-block font-mono text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border ${styles[role] ?? ""}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-8" onMouseDown={onClose}>
      <div
        className={`fade-in card w-full ${wide ? "max-w-3xl" : "max-w-lg"} shadow-2xl my-auto`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0 flex-1">{typeof title === "string" ? <h3 className="text-xl">{title}</h3> : title}</div>
          <button className="text-ink-soft hover:text-ink text-2xl leading-none px-1" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ReadOnlyNotice() {
  const { canEdit } = useApp();
  if (canEdit) return null;
  return (
    <div className="mb-4 rounded-md border border-line bg-paper-3 px-3 py-2 text-sm text-ink-soft">
      Vous êtes <strong>visionneur</strong> : consultation uniquement. Demandez au manager un accès éditeur pour contribuer.
    </div>
  );
}

export function fmtDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return fmtDate(d);
}
