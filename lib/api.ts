import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { explainError } from "./diagnose";

/** Enveloppe les route handlers : convertit les erreurs en réponses JSON propres. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const result = await fn(...args);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: explainError(e) }, { status: 500 });
    }
  };
}

export function bad(message: string): never {
  throw new HttpError(400, message);
}

export function str(v: unknown, max = 10000): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

export function reqStr(v: unknown, field: string, max = 500): string {
  const s = str(v, max).trim();
  if (!s) bad(`Le champ « ${field} » est obligatoire.`);
  return s;
}

export function optDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function color(v: unknown, fallback = "#0f766e"): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

export function id(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) bad("Identifiant invalide");
  return n;
}
