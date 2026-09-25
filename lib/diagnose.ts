import "server-only";
import { ConfigError } from "./db";

/** Traduit une erreur technique en message compréhensible (sans révéler de secret). */
export function explainError(e: unknown): string {
  if (e instanceof ConfigError) return `Configuration : ${e.message}`;
  const err = e as { code?: string; message?: string };
  const msg = String(err?.message ?? "");
  if (err?.code === "28P01" || /password authentication failed/i.test(msg))
    return "Base de données : identifiants refusés. Vérifiez la valeur de DATABASE_URL dans Vercel.";
  if (err?.code === "3D000") return "Base de données introuvable : vérifiez le nom de la base dans DATABASE_URL.";
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return "Base de données injoignable : l'adresse dans DATABASE_URL est incorrecte.";
  if (/ECONNREFUSED|ETIMEDOUT|timeout|CONNECT_TIMEOUT/i.test(msg))
    return "Base de données injoignable (délai dépassé). Vérifiez DATABASE_URL et que la base Neon est active.";
  if (/ssl|certificate/i.test(msg)) return "Base de données : problème de connexion sécurisée (SSL). Ajoutez ?sslmode=require à DATABASE_URL.";
  return "Erreur serveur inattendue. Consultez Vercel → Logs pour le détail.";
}
