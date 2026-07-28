// Motor das consultas: transforma o pedido montado pelas telas em SQL do D1 e
// aplica as regras de acesso de src/lib/db/access.ts.
//
// Este arquivo não importa nada do framework nem dos bindings de propósito: o
// banco entra como parâmetro. Isso permite exercitá-lo contra um SQLite comum
// nos testes, que é como as regras de acesso são conferidas de verdade.
//
// SOBRE INJEÇÃO DE SQL: valores nunca entram no texto da consulta — vão como
// parâmetros (?). Nomes de tabela e coluna não podem ser parâmetros, então são
// conferidos contra as listas de src/lib/db/schema.ts antes de serem usados.
// Nome que não está na lista faz a consulta ser recusada.

import type { TableName } from "@/lib/db/types";
import type { D1Database } from "./bindings";
import { deniedMessage, getRule, type Operation, type Rule } from "./access";
import { fromDb, isColumn, isTable, toDb } from "./schema";
import type { Session } from "./session";

type Row = Record<string, unknown>;
type AllowedRule = Exclude<Rule, false>;

export type Filter = { col: string; opr: "eq" | "gte"; val: unknown };

export type QueryRequest = {
  table: string;
  op: Operation;
  filters: Filter[];
  orders: Array<{ col: string; asc: boolean }>;
  limit: number | null;
  single: "maybe" | "strict" | null;
  count: boolean;
  head: boolean;
  embeds: string[];
  payload: Row | Row[] | null;
};

// O TanStack Start exige que a resposta de uma função de servidor seja
// declaradamente transportável (vira JSON na volta), então `unknown` não serve.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type QueryResponse = {
  data: Json;
  error: { message: string } | null;
  count: number | null;
};

// Relações usadas nos selects com tabela embutida, ex.: "*, file_categories(name)".
const FK_MAP: Partial<Record<TableName, Record<string, string>>> = {
  development_files: { file_categories: "category_id", developments: "development_id" },
  file_downloads: { developments: "development_id", development_files: "file_id" },
};

/** Operação barrada por regra de acesso ou por nome inválido. */
export class DeniedError extends Error {}

function ensureTable(name: string): TableName {
  if (!isTable(name)) throw new DeniedError(`Tabela desconhecida: "${name}".`);
  return name;
}

function ensureColumn(table: TableName, col: string): string {
  if (!isColumn(table, col)) {
    throw new DeniedError(`Coluna desconhecida em "${table}": "${col}".`);
  }
  return col;
}

/** Monta o WHERE juntando o que a tela pediu com o que a regra de acesso exige. */
function buildWhere(
  table: TableName,
  filters: Filter[],
  rule: AllowedRule,
  session: Session,
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const f of filters) {
    const col = ensureColumn(table, f.col);
    const operador = f.opr === "gte" ? ">=" : "=";
    parts.push(`${table}.${col} ${operador} ?`);
    params.push(toDb(table, col, f.val));
  }

  // As duas linhas abaixo são a barreira do corretor. Elas entram SEMPRE,
  // depois dos filtros da tela, unidas por AND — não há como a tela removê-las.
  if (rule.where) parts.push(`(${rule.where})`);
  if (rule.self) {
    parts.push(`${table}.${rule.self} = ?`);
    params.push(session.userId);
  }

  return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
}

function buildOrder(table: TableName, orders: QueryRequest["orders"]): string {
  if (!orders.length) return "";
  const cols = orders.map(
    (o) => `${table}.${ensureColumn(table, o.col)} ${o.asc ? "ASC" : "DESC"}`,
  );
  return ` ORDER BY ${cols.join(", ")}`;
}

/** Filtra o payload pelas colunas que a regra permite gravar. */
function sanitizePayload(table: TableName, payload: Row, rule: AllowedRule, session: Session): Row {
  const out: Row = {};
  for (const [col, value] of Object.entries(payload)) {
    if (!isColumn(table, col)) continue; // campo que não existe é descartado
    if (rule.columns && !rule.columns.includes(col)) continue;
    out[col] = toDb(table, col, value);
  }
  // Carimbo do servidor: o corretor não escolhe de quem é o registro.
  for (const col of rule.forceSelf ?? []) out[col] = session.userId;
  return out;
}

export async function executeQuery(
  req: QueryRequest,
  session: Session,
  db: D1Database,
): Promise<QueryResponse> {
  const table = ensureTable(req.table);
  const rule = getRule(session.role, table, req.op);
  if (rule === false) throw new DeniedError(deniedMessage(table, req.op));

  switch (req.op) {
    case "insert": {
      const list = Array.isArray(req.payload) ? req.payload : [req.payload ?? {}];
      for (const item of list) {
        const values = sanitizePayload(table, item, rule, session);
        values.id ??= crypto.randomUUID();
        if (isColumn(table, "updated_at")) values.updated_at ??= new Date().toISOString();

        const cols = Object.keys(values);
        if (!cols.length) throw new DeniedError("Nada para inserir.");
        await db
          .prepare(
            `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
          )
          .bind(...cols.map((c) => values[c]))
          .run();

        // Mantém o contador de downloads do arquivo, como o app já fazia.
        if (table === "file_downloads" && values.file_id) {
          await db
            .prepare(
              "UPDATE development_files SET download_count = download_count + 1 WHERE id = ?",
            )
            .bind(values.file_id)
            .run();
        }
      }
      return { data: null, error: null, count: null };
    }

    case "update": {
      const values = sanitizePayload(table, (req.payload as Row) ?? {}, rule, session);
      delete values.id; // id não se altera
      if (isColumn(table, "updated_at")) values.updated_at = new Date().toISOString();
      const cols = Object.keys(values);
      if (!cols.length) throw new DeniedError("Nada para alterar.");

      const where = buildWhere(table, req.filters, rule, session);
      // Um UPDATE sem WHERE reescreveria a tabela inteira.
      if (!where.sql) throw new DeniedError("Alteração sem filtro foi bloqueada.");

      await db
        .prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}${where.sql}`)
        .bind(...cols.map((c) => values[c]), ...where.params)
        .run();
      return { data: null, error: null, count: null };
    }

    case "delete": {
      const where = buildWhere(table, req.filters, rule, session);
      // Um DELETE sem WHERE apagaria a tabela inteira.
      if (!where.sql) throw new DeniedError("Exclusão sem filtro foi bloqueada.");
      await db
        .prepare(`DELETE FROM ${table}${where.sql}`)
        .bind(...where.params)
        .run();
      return { data: null, error: null, count: null };
    }

    case "select":
    default: {
      const where = buildWhere(table, req.filters, rule, session);

      let count: number | null = null;
      if (req.count) {
        const row = await db
          .prepare(`SELECT count(*) AS total FROM ${table}${where.sql}`)
          .bind(...where.params)
          .first<{ total: number }>();
        count = row?.total ?? 0;
      }
      if (req.head) return { data: null, error: null, count };

      const limit = req.limit != null ? ` LIMIT ${Math.max(0, Math.trunc(req.limit))}` : "";
      const { results } = await db
        .prepare(
          `SELECT ${table}.* FROM ${table}${where.sql}${buildOrder(table, req.orders)}${limit}`,
        )
        .bind(...where.params)
        .all();

      let rows = results.map((r) => fromDb(table, r));
      rows = await attachEmbeds(table, rows, req.embeds, session, db);

      if (req.single) {
        const first = rows[0] ?? null;
        if (req.single === "strict" && !first) {
          return { data: null, error: { message: "Registro não encontrado." }, count };
        }
        return { data: first as Json, error: null, count };
      }
      return { data: rows as Json, error: null, count };
    }
  }
}

/**
 * Resolve selects do tipo "*, file_categories(name)".
 * Busca as linhas relacionadas de uma vez só (e não uma por linha), porque o
 * plano gratuito do D1 tem cota diária de leitura.
 */
async function attachEmbeds(
  table: TableName,
  rows: Row[],
  embeds: string[],
  session: Session,
  db: D1Database,
): Promise<Row[]> {
  if (!rows.length || !embeds.length) return rows;

  for (const embed of embeds) {
    const fkCol = FK_MAP[table]?.[embed];
    if (!fkCol || !isTable(embed)) continue;

    // A tabela embutida obedece às mesmas regras de acesso da tabela principal.
    const rule = getRule(session.role, embed, "select");
    if (rule === false) {
      for (const row of rows) row[embed] = null;
      continue;
    }

    const ids = [...new Set(rows.map((r) => r[fkCol]).filter((v) => v != null))];
    if (!ids.length) {
      for (const row of rows) row[embed] = null;
      continue;
    }

    const conds = [`${embed}.id IN (${ids.map(() => "?").join(", ")})`];
    const params: unknown[] = [...ids];
    if (rule.where) conds.push(`(${rule.where})`);
    if (rule.self) {
      conds.push(`${embed}.${rule.self} = ?`);
      params.push(session.userId);
    }

    const { results } = await db
      .prepare(`SELECT ${embed}.* FROM ${embed} WHERE ${conds.join(" AND ")}`)
      .bind(...params)
      .all();

    const byId = new Map(results.map((r) => [r.id, fromDb(embed, r)]));
    for (const row of rows) row[embed] = byId.get(row[fkCol] as string) ?? null;
  }

  return rows;
}
