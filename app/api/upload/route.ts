import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { HttpError, requireEditor } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/shared";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

// Deux modes :
//  - Vercel Blob (BLOB_READ_WRITE_TOKEN défini) : le navigateur envoie le fichier directement au stockage
//    (pas de limite de taille de requête Vercel, idéal pour les vidéos) ; cette route délivre le jeton.
//  - Local (développement) : le fichier est envoyé ici en multipart et écrit dans ./.uploads
export async function POST(req: Request) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const body = (await req.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          await requireEditor();
          if (!pathname.startsWith("progenis/")) throw new HttpError(400, "Chemin invalide");
          return { addRandomSuffix: true, maximumSizeInBytes: MAX_UPLOAD_BYTES };
        },
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(result);
    }

    if (process.env.VERCEL) throw new HttpError(500, "Stockage de fichiers non configuré : créez un store Vercel Blob (voir README).");
    await requireEditor();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Fichier manquant");
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, "Fichier trop volumineux");
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "fichier";
    const key = `${Date.now()}-${randomBytes(6).toString("hex")}-${safe}`;
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `local:${key}`, content_type: file.type || "application/octet-stream", size: file.size });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400;
    const message = e instanceof Error ? e.message : "Échec de l'envoi";
    return NextResponse.json({ error: message }, { status });
  }
}
