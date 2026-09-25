import postgres from "postgres";
import { SCHEMA_SQL } from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __progenisSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __progenisSchemaReady: Promise<void> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant : configurez la base de données (voir README).");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: isLocal ? false : "require",
    max: 5,
    idle_timeout: 20,
    prepare: false, // compatible avec les poolers (Neon / Supabase)
    transform: { undefined: null },
  });
}

export function sqlClient() {
  if (!globalThis.__progenisSql) globalThis.__progenisSql = createClient();
  return globalThis.__progenisSql;
}

/** Retourne le client SQL après s'être assuré que le schéma existe. */
export async function db() {
  const sql = sqlClient();
  if (!globalThis.__progenisSchemaReady) {
    globalThis.__progenisSchemaReady = sql
      .begin(async (tx) => {
        // verrou pour éviter que deux instances créent le schéma en même temps
        await tx`SELECT pg_advisory_xact_lock(424242)`;
        await tx.unsafe(SCHEMA_SQL);
      })
      .then(() => undefined)
      .catch((e) => {
      globalThis.__progenisSchemaReady = undefined;
      throw e;
    });
  }
  await globalThis.__progenisSchemaReady;
  return sql;
}
