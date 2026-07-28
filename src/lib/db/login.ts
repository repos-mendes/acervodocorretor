// Regras de entrada na plataforma: conferência do PIN, senha do administrador e
// o bloqueio por tentativas.
//
// Como em query.ts, o banco entra como parâmetro e nada aqui depende do
// framework — é o que permite testar o bloqueio de verdade (tests/login.test.ts).
//
// POR QUE O BLOQUEIO EXISTE: um PIN de 4 dígitos tem só 10.000 combinações, e
// como ele vem sozinho (sem nome de usuário), quem chuta está tentando contra
// todos os corretores ao mesmo tempo. Sem bloqueio, um programa varre as 10.000
// possibilidades em segundos. Com bloqueio de 3 erros por 15 minutos, varrer
// tudo levaria mais de um ano.

import type { D1Database } from "./bindings";
import { conferirSenha, hashSenha } from "./password";
import type { AppRole, Session } from "./session";

/** Erros permitidos antes de bloquear. */
export const MAX_TENTATIVAS = 3;
/** Quanto tempo o bloqueio dura. */
export const BLOQUEIO_MINUTOS = 15;

export type ResultadoLogin =
  | { ok: true; session: Session; nome: string }
  | { ok: false; motivo: "invalido" | "inativo" | "bloqueado"; minutos?: number };

const agora = () => new Date();
const iso = (d: Date) => d.toISOString();

// ---------------------------------------------------------------------------
// Bloqueio por tentativas (contado por origem, não por pessoa)
// ---------------------------------------------------------------------------

/** Minutos restantes de bloqueio, ou null se a origem está liberada. */
export async function minutosDeBloqueio(db: D1Database, ip: string): Promise<number | null> {
  const linha = await db
    .prepare("SELECT locked_until FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .first<{ locked_until: string | null }>();

  if (!linha?.locked_until) return null;
  const restaMs = new Date(linha.locked_until).getTime() - agora().getTime();
  return restaMs > 0 ? Math.max(1, Math.ceil(restaMs / 60000)) : null;
}

/**
 * Conta mais um erro. Devolve o resultado já pronto para a tela: quando este
 * erro é o que estoura o limite, a resposta é "bloqueado" — e não "PIN
 * incorreto" —, para a pessoa saber na hora que precisa esperar, em vez de
 * descobrir só na tentativa seguinte.
 */
async function registrarFalha(
  db: D1Database,
  ip: string,
): Promise<Exclude<ResultadoLogin, { ok: true }>> {
  await db
    .prepare(
      `INSERT INTO login_attempts (ip, failed_count, updated_at) VALUES (?, 1, ?)
       ON CONFLICT(ip) DO UPDATE SET failed_count = failed_count + 1, updated_at = excluded.updated_at`,
    )
    .bind(ip, iso(agora()))
    .run();

  const linha = await db
    .prepare("SELECT failed_count FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .first<{ failed_count: number }>();

  if ((linha?.failed_count ?? 0) >= MAX_TENTATIVAS) {
    const ate = new Date(agora().getTime() + BLOQUEIO_MINUTOS * 60000);
    // Zera o contador junto: terminado o bloqueio, a pessoa recomeça com as
    // tentativas cheias em vez de ser bloqueada de novo no primeiro erro.
    await db
      .prepare("UPDATE login_attempts SET locked_until = ?, failed_count = 0 WHERE ip = ?")
      .bind(iso(ate), ip)
      .run();
    return { ok: false, motivo: "bloqueado", minutos: BLOQUEIO_MINUTOS };
  }

  return { ok: false, motivo: "invalido" };
}

async function limparFalhas(db: D1Database, ip: string): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
}

// ---------------------------------------------------------------------------
// Entrada do corretor: PIN de 4 dígitos
// ---------------------------------------------------------------------------

export function pinValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function papelDe(db: D1Database, userId: string): Promise<AppRole> {
  const linha = await db
    .prepare("SELECT role FROM user_roles WHERE user_id = ? ORDER BY role LIMIT 1")
    .bind(userId)
    .first<{ role: AppRole }>();
  // 'admin' vem antes de 'corretor' na ordem alfabética: quem tem os dois papéis
  // entra como administrador.
  return linha?.role ?? "corretor";
}

export async function entrarComPin(
  db: D1Database,
  pin: string,
  ip: string,
): Promise<ResultadoLogin> {
  const minutos = await minutosDeBloqueio(db, ip);
  if (minutos !== null) return { ok: false, motivo: "bloqueado", minutos };

  if (!pinValido(pin)) return registrarFalha(db, ip);

  const perfil = await db
    .prepare("SELECT id, full_name, status FROM profiles WHERE pin = ?")
    .bind(pin)
    .first<{ id: string; full_name: string; status: string }>();

  if (!perfil) return registrarFalha(db, ip);

  // Acesso desativado pelo admin. Não conta como erro: o PIN está certo, e
  // contar faria a pessoa ser bloqueada por um problema que não é de senha.
  if (perfil.status !== "ativo") return { ok: false, motivo: "inativo" };

  await limparFalhas(db, ip);
  await db
    .prepare("UPDATE profiles SET last_access_at = ? WHERE id = ?")
    .bind(iso(agora()), perfil.id)
    .run();

  return {
    ok: true,
    nome: perfil.full_name,
    session: { userId: perfil.id, role: await papelDe(db, perfil.id) },
  };
}

// ---------------------------------------------------------------------------
// Entrada do administrador: e-mail + senha
// ---------------------------------------------------------------------------

export async function entrarComSenha(
  db: D1Database,
  email: string,
  senha: string,
  ip: string,
): Promise<ResultadoLogin> {
  const minutos = await minutosDeBloqueio(db, ip);
  if (minutos !== null) return { ok: false, motivo: "bloqueado", minutos };

  const perfil = await db
    .prepare(
      "SELECT id, full_name, status, password_hash FROM profiles WHERE lower(email) = lower(?)",
    )
    .bind(email.trim())
    .first<{ id: string; full_name: string; status: string; password_hash: string | null }>();

  // A senha é conferida mesmo quando o e-mail não existe? Não: aqui o custo de
  // não conferir é aceitável porque o bloqueio por tentativas já limita quem
  // fica sondando e-mails.
  if (!perfil || !(await conferirSenha(senha, perfil.password_hash))) {
    return registrarFalha(db, ip);
  }
  if (perfil.status !== "ativo") return { ok: false, motivo: "inativo" };

  await limparFalhas(db, ip);
  await db
    .prepare("UPDATE profiles SET last_access_at = ? WHERE id = ?")
    .bind(iso(agora()), perfil.id)
    .run();

  return {
    ok: true,
    nome: perfil.full_name,
    session: { userId: perfil.id, role: await papelDe(db, perfil.id) },
  };
}

// ---------------------------------------------------------------------------
// Primeiro administrador
// ---------------------------------------------------------------------------

export async function existeAdmin(db: D1Database): Promise<boolean> {
  const linha = await db
    .prepare("SELECT count(*) AS total FROM user_roles WHERE role = 'admin'")
    .first<{ total: number }>();
  return (linha?.total ?? 0) > 0;
}

/**
 * Cria o administrador inicial. Só funciona enquanto NÃO existir nenhum admin —
 * depois disso a porta se fecha sozinha e novos usuários passam a ser criados
 * pelo painel. É assim que o Lucas entra na primeira vez, sem senha padrão
 * escrita no código (que é o tipo de coisa que se esquece de trocar).
 */
export async function criarPrimeiroAdmin(
  db: D1Database,
  dados: { nome: string; email: string; senha: string },
): Promise<{ ok: true; session: Session } | { ok: false; erro: string }> {
  if (await existeAdmin(db)) {
    return { ok: false, erro: "Já existe um administrador. Entre com e-mail e senha." };
  }
  if (dados.senha.length < 10) {
    return { ok: false, erro: "A senha do administrador precisa ter pelo menos 10 caracteres." };
  }
  if (!dados.email.includes("@")) {
    return { ok: false, erro: "Informe um e-mail válido." };
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO profiles (id, full_name, email, status, password_hash, updated_at)
       VALUES (?, ?, ?, 'ativo', ?, ?)`,
    )
    .bind(
      id,
      dados.nome.trim(),
      dados.email.trim().toLowerCase(),
      await hashSenha(dados.senha),
      iso(agora()),
    )
    .run();
  await db
    .prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')")
    .bind(crypto.randomUUID(), id)
    .run();

  return { ok: true, session: { userId: id, role: "admin" } };
}
