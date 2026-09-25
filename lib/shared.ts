// Code partagé client / serveur.

export type AiProvider = { id: string; name: string; color: string; hosts: string[] };

export const AI_PROVIDERS: AiProvider[] = [
  { id: "deepseek", name: "DeepSeek", color: "#4d6bfe", hosts: ["deepseek.com"] },
  { id: "claude", name: "Claude", color: "#d97757", hosts: ["claude.ai", "claude.com"] },
  { id: "chatgpt", name: "ChatGPT", color: "#10a37f", hosts: ["chatgpt.com", "chat.openai.com", "openai.com"] },
  { id: "gemini", name: "Gemini", color: "#4285f4", hosts: ["gemini.google.com", "g.co"] },
  { id: "perplexity", name: "Perplexity", color: "#20808d", hosts: ["perplexity.ai"] },
  { id: "mistral", name: "Le Chat", color: "#fa520f", hosts: ["chat.mistral.ai", "mistral.ai"] },
];

export function detectAiProvider(url: string): AiProvider | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AI_PROVIDERS.find((p) => p.hosts.some((h) => host === h || host.endsWith("." + h))) ?? null;
  } catch {
    return null;
  }
}

export const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export type Attachment = { url: string; name: string; content_type: string; size: number };
export type AiLink = { url: string; title: string; provider: string };

export function fileKind(contentType: string, name = ""): "image" | "audio" | "video" | "pdf" | "file" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "file";
}

/** URL servie par l'appli (contrôle d'accès) pour un fichier stocké. */
export function fileHref(url: string, download = false) {
  return `/api/files?u=${encodeURIComponent(url)}${download ? "&dl=1" : ""}`;
}

export function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  editeur: "Éditeur",
  visionneur: "Visionneur",
};

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 Mo (vidéos)
