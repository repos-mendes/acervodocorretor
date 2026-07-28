// Sessão do lado do SERVIDOR: cria e confere o "crachá" de quem está logado.
//
// (Não confundir com src/lib/session.ts, que é o hook do React usado pelas
// telas para saber quem é o usuário atual.)
//
// COMO FUNCIONA: depois que o PIN é aceito, o servidor devolve um cookie com o
// id do usuário, o papel e uma validade, tudo assinado com o SESSION_SECRET.
// A assinatura é o que impede alguém de editar o próprio cookie e virar admin.
//
// Escolhemos cookie assinado em vez de tabela de sessões porque assim conferir
// quem está logado não custa uma consulta ao banco a cada requisição — e o D1
// gratuito tem cota diária de leitura.

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { getSessionSecret } from "./bindings";

export type AppRole = "admin" | "corretor";
export type Session = { userId: string; role: AppRole };

export const SESSION_COOKIE = "acervo_sessao";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

type Payload = Session & { exp: number };

// base64url: o base64 comum usa "+" e "/", que não podem ir num cookie.
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

/** Comparação em tempo constante: não vaza, pelo tempo de resposta, quantos
 *  bytes da assinatura o atacante acertou. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionToken(session: Session): Promise<string> {
  const payload: Payload = {
    ...session,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await hmac(body))}`;
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    if (!equal(fromBase64Url(signature), await hmac(body))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Payload;
    if (!payload.userId || (payload.role !== "admin" && payload.role !== "corretor")) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

// HttpOnly: o JavaScript da página não consegue ler o cookie, então um script
// injetado não rouba a sessão. SameSite=Lax evita que outro site use a sessão.
const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: MAX_AGE_SECONDS,
} as const;

/** Grava o cookie de sessão na resposta em andamento. */
export async function startSession(session: Session): Promise<void> {
  setCookie(SESSION_COOKIE, await createSessionToken(session), COOKIE_OPTIONS);
}

export function endSession(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

/** Quem está logado nesta requisição, ou null. */
export async function readSession(): Promise<Session | null> {
  const token = getCookie(SESSION_COOKIE);
  return token ? verifySessionToken(token) : null;
}
