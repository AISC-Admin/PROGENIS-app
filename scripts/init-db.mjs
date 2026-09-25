// Initialise la base (optionnel : le schéma est aussi créé automatiquement au premier accès).
// Usage : DATABASE_URL=... node scripts/init-db.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
const src = readFileSync(new URL("../lib/schema.ts", import.meta.url), "utf8");
const schema = src.match(/SCHEMA_SQL = `([\s\S]*?)`;/)[1];
const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", prepare: false });
await sql.unsafe(schema);
console.log("Schéma PROGENIS créé / à jour.");
await sql.end();
