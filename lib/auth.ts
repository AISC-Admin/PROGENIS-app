import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHmac, randomInt } from "node:crypto";
import { ConfigError, db } from "./db";

export type Role = "manager" | "editeur" | "visionneur";
export type User = {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  color: string;
  active: boolean;
  session_version: number;
};

export const SESSION_COOKIE = "progenis_session";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16)
    throw new ConfigError("La variable AUTH_SECRET est absente ou trop courte (16 caractères minimum) dans Vercel.");
  return s;
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashCode(code: string) {
  return createHmac("sha256", secret()).update(normalizeCode(code)).digest("hex");
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I/L)
export function generateCode() {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `PRG-${part()}-${part()}`;
}

const PALETTE = ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be123c", "#15803d", "#0369a1", "#a21caf", "#c2410c", "#4d7c0f"];
export function randomColor() {
  return PALETTE[randomInt(PALETTE.length)];
}

export async function createSessionCookie(user: Pick<User, "id" | "session_version">) {
  const token = await new SignJWT({ uid: user.id, sv: user.session_version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(new TextEncoder().encode(secret()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Utilisateur connecté (vérifié en base à chaque requête : rôle et désactivation pris en compte immédiatement). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret()));
    const sql = await db();
    const rows = await sql<User[]>`
      SELECT id, name, email, role, color, active, session_version FROM users WHERE id = ${Number(payload.uid)}`;
    const u = rows[0];
    if (!u || !u.active || u.session_version !== Number(payload.sv)) return null;
    return u;
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Non connecté");
  return u;
}

export async function requireEditor(): Promise<User> {
  const u = await requireUser();
  if (u.role === "visionneur") throw new HttpError(403, "Accès en lecture seule : action réservée aux éditeurs.");
  return u;
}

export async function requireManager(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "manager") throw new HttpError(403, "Action réservée au manager.");
  return u;
}

export const canEdit = (u: Pick<User, "role">) => u.role !== "visionneur";

/** Enregistre une action dans le journal d'activité. */
export async function logActivity(userId: number | null, action: string, details = "") {
  try {
    const sql = await db();
    await sql`INSERT INTO activity_log (user_id, action, details) VALUES (${userId}, ${action}, ${details})`;
  } catch {
    /* le journal ne doit jamais bloquer une action */
  }
}
