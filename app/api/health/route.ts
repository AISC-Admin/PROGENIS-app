import { NextResponse } from "next/server";
import { databaseUrl, sqlClient } from "@/lib/db";
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
  return NextResponse.json({ ok, variables: checks, database });
}
