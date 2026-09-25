import "server-only";
import { detectAiProvider, type AiLink, type Attachment } from "./shared";
import { str } from "./api";

/** Accepte uniquement des fichiers stockés par l'appli (Vercel Blob ou stockage local de dev). */
function isStoredUrl(u: string) {
  if (u.startsWith("local:")) return /^local:[\w.\-]+$/.test(u);
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function cleanAttachments(v: unknown): Attachment[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 20)
    .map((a) => ({
      url: str(a?.url, 1000),
      name: str(a?.name, 200) || "fichier",
      content_type: str(a?.content_type, 120) || "application/octet-stream",
      size: Math.max(0, Number(a?.size) || 0),
    }))
    .filter((a) => isStoredUrl(a.url));
}

export function cleanAiLinks(v: unknown): AiLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 20)
    .map((l) => {
      const url = str(l?.url, 2000).trim();
      if (!/^https?:\/\//i.test(url)) return null;
      const p = detectAiProvider(url);
      return { url, title: str(l?.title, 200).trim(), provider: p?.id ?? "autre" };
    })
    .filter((l): l is AiLink => l !== null);
}
