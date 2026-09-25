import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg",
  wav: "audio/wav", txt: "text/plain; charset=utf-8",
};

// Sert les fichiers uniquement aux membres connectés (support des requêtes Range pour la lecture vidéo/audio).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const u = params.get("u") ?? "";
  const download = params.get("dl") === "1";
  const range = req.headers.get("range");

  if (u.startsWith("local:")) {
    const key = u.slice(6);
    if (!/^[\w.\-]+$/.test(key)) return new NextResponse("Invalide", { status: 400 });
    const file = path.join(LOCAL_DIR, key);
    const info = await stat(file).catch(() => null);
    if (!info) return new NextResponse("Introuvable", { status: 404 });
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const headers = new Headers({
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    });
    if (download) headers.set("Content-Disposition", `attachment; filename="${key.replace(/^\d+-[a-f0-9]+-/, "")}"`);
    let start = 0;
    let end = info.size - 1;
    let status = 200;
    const m = range?.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      start = m[1] ? Number(m[1]) : Math.max(0, info.size - Number(m[2]));
      end = m[1] && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    }
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status, headers });
  }

  let blobUrl: URL;
  try {
    blobUrl = new URL(u);
  } catch {
    return new NextResponse("Invalide", { status: 400 });
  }
  if (!blobUrl.hostname.endsWith(".blob.vercel-storage.com")) return new NextResponse("Invalide", { status: 400 });

  const access = process.env.BLOB_ACCESS === "public" ? "public" : "private";
  if (access === "public") {
    if (download) blobUrl.searchParams.set("download", "1");
    return NextResponse.redirect(blobUrl.toString());
  }

  const result = await get(u, { access, headers: range ? { range } : undefined });
  if (!result || result.statusCode !== 200) return new NextResponse("Introuvable", { status: 404 });
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = result.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Cache-Control", "private, max-age=3600");
  if (download) {
    const name = decodeURIComponent(blobUrl.pathname.split("/").pop() ?? "fichier");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  return new NextResponse(result.stream, { status: headers.has("content-range") ? 206 : 200, headers });
}
