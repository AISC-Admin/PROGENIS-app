"use client";
import { upload } from "@vercel/blob/client";
import { MAX_UPLOAD_BYTES, type Attachment } from "@/lib/shared";

/** Envoie un fichier vers le stockage (Vercel Blob direct, ou stockage local en dev). */
export async function uploadFile(
  file: File,
  storage: "local" | "private" | "public",
  onProgress?: (pct: number) => void,
): Promise<Attachment> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`« ${file.name} » dépasse la taille maximale (500 Mo).`);
  const contentType = file.type || "application/octet-stream";
  if (storage !== "local") {
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-100) || "fichier";
    const blob = await upload(`progenis/${safe}`, file, {
      access: storage,
      handleUploadUrl: "/api/upload",
      contentType,
      multipart: file.size > 20 * 1024 * 1024,
      onUploadProgress: (p) => onProgress?.(p.percentage),
    });
    return { url: blob.url, name: file.name, content_type: contentType, size: file.size };
  }
  // Mode local : XHR pour avoir la progression
  const res = await new Promise<{ url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Échec de l'envoi"));
    };
    xhr.onerror = () => reject(new Error("Échec de l'envoi"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
  return { url: res.url, name: file.name, content_type: contentType, size: file.size };
}
