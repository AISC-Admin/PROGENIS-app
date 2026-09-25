import postgres from "postgres";
import { SCHEMA_SQL } from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __progenisSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __progenisSchemaReady: Promise<void> | undefined;
}

export class ConfigError extends Error {}

/** Neon (Vercel) fournit DATABASE_URL ; Supabase / Vercel Postgres fournissent POSTGRES_URL. */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
}

function createClient() {
  const url = databaseUrl();
  if (!url) throw new ConfigError("Base de données non configurée : la variable DATABASE_URL est absente dans Vercel.");
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
