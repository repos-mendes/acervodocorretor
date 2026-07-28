// Apoio dos testes: um banco SQLite de verdade, com a mesma interface do D1.
//
// O D1 da Cloudflare é SQLite por baixo, então rodar as consultas reais contra
// o node:sqlite testa o SQL de fato — não uma imitação dele.

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { D1Database } from "@/lib/db/bindings";

export function criarBanco(migrations = "migrations"): {
  sqlite: DatabaseSync;
  DB: D1Database;
} {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const arquivo of ["0001_init.sql", "0002_seed.sql"]) {
    sqlite.exec(readFileSync(`${migrations}/${arquivo}`, "utf8"));
  }

  const DB = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values.map((v) => (v === undefined ? null : v));
          return stmt;
        },
        async all() {
          return {
            results: sqlite.prepare(sql).all(...(params as never[])),
            success: true,
            meta: {},
          };
        },
        async first() {
          return sqlite.prepare(sql).get(...(params as never[])) ?? null;
        },
        async run() {
          sqlite.prepare(sql).run(...(params as never[]));
          return { results: [], success: true, meta: {} };
        },
      };
      return stmt;
    },
    batch: async () => [],
  } as unknown as D1Database;

  return { sqlite, DB };
}

// ---------------------------------------------------------------------------
// Contagem de acertos e erros
// ---------------------------------------------------------------------------

let falhas = 0;

export function checa(rotulo: string, condicao: boolean, detalhe = "") {
  console.log(`${condicao ? "ok  " : "FALHA"} ${rotulo}${detalhe ? ` -> ${detalhe}` : ""}`);
  if (!condicao) falhas++;
}

export function titulo(texto: string) {
  console.log(`\n=== ${texto} ===`);
}

export function encerrar() {
  console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}`);
  process.exit(falhas === 0 ? 0 : 1);
}
