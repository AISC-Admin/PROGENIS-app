import { NextResponse } from "next/server";
import { databaseUrl, databaseUrlCandidates, sqlClient } from "@/lib/db";
import { explainError } from "@/lib/diagnose";

export const dynamic = "force-dynamic";

// Diagnostic de configuration : indique ce qui manque, sans jamais afficher les valeurs.
export async function GET() {
  const checks: Record<string, string> = {
    DATABASE_URL: databaseUrl() ? "présente" : "ABSENTE",
    AUTH_SECRET: (process.env.AUTH_SECRET?.length ?? 0) >= 16 ? "présente" : "ABSENTE ou trop courte",
    MANAGER_BOOTSTRAP_CODE: process.env.MANAGER_BOOTSTRAP_CODE ? "présente" : "ABSENTE",
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? "présente" : "absente (envoi de fichiers impossible)",
  };
  let database = "non testée";
  if (databaseUrl()) {
    try {
      await sqlClient()`SELECT 1`;
      database = "connexion OK";
    } catch (e) {
      database = explainError(e);
    }
  }
  const ok = checks.DATABASE_URL === "présente" && checks.AUTH_SECRET === "présente" && database === "connexion OK";
  const found = databaseUrlCandidates();
  const conseil = !databaseUrl()
    ? "Aucune base reliée : Vercel → Storage → Create Database → Neon → Connect Project, puis Deployments → Redeploy."
    : ok
      ? "Tout est prêt."
      : "Vérifiez la base de données puis redéployez.";
  return NextResponse.json(
    { ok, variables: checks, variables_base_detectees: found, database, conseil },
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
