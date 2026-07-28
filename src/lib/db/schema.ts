// Descrição das tabelas do D1 para o servidor.
//
// Serve a dois propósitos:
//
//  1. SEGURANÇA. Nomes de tabela e de coluna não podem ser parametrizados em
//     SQL — eles entram no texto da consulta. Como as telas mandam esses nomes,
//     tudo é conferido contra estas listas antes de virar SQL. O que não está
//     aqui não existe.
//
//  2. CONVERSÃO. O SQLite não tem booleano nem array: guardamos 0/1 e JSON em
//     texto. As telas continuam recebendo `true`/`false` e arrays de verdade.

import type { TableName } from "@/lib/db/types";

type TableSpec = {
  columns: readonly string[];
  /** Colunas TEXT que guardam JSON e viram array no app. */
  json?: readonly string[];
  /** Colunas INTEGER 0/1 que viram booleano no app. */
  bool?: readonly string[];
  /** Colunas que NUNCA saem do servidor, nem para o administrador. */
  secret?: readonly string[];
};

const COMMON = ["id", "created_at"] as const;

export const TABLES: Record<TableName, TableSpec> = {
  profiles: {
    columns: [
      ...COMMON,
      "full_name",
      "email",
      "phone",
      "creci",
      "avatar_url",
      "status",
      "pin",
      "password_hash",
      "updated_at",
      "last_access_at",
    ],
    // A senha do administrador fica no banco só como resumo (hash), mas nem o
    // resumo precisa chegar ao navegador. Quem confere a senha é o servidor,
    // lendo a coluna direto (src/lib/db/login.ts).
    secret: ["password_hash"],
  },
  user_roles: {
    columns: [...COMMON, "user_id", "role"],
  },
  developments: {
    columns: [
      ...COMMON,
      "name",
      "slug",
      "short_description",
      "full_description",
      "commercial_information",
      "commercial_status",
      "publication_status",
      "development_type",
      "address",
      "neighborhood",
      "city",
      "maps_url",
      "cover_image_url",
      "logo_url",
      "gallery_urls",
      "highlights",
      "is_featured",
      "launch_date",
      "sort_order",
      "created_by",
      "updated_at",
    ],
    json: ["gallery_urls", "highlights"],
    bool: ["is_featured"],
  },
  file_categories: {
    columns: [...COMMON, "name", "description", "icon", "sort_order", "is_active"],
    bool: ["is_active"],
  },
  development_files: {
    columns: [
      ...COMMON,
      "development_id",
      "category_id",
      "title",
      "description",
      "storage_path",
      "original_file_name",
      "file_size",
      "file_extension",
      "mime_type",
      "publication_status",
      "is_featured",
      "download_count",
      "uploaded_by",
      "updated_at",
    ],
    bool: ["is_featured"],
  },
  file_downloads: {
    columns: [...COMMON, "file_id", "development_id", "user_id", "downloaded_at"],
  },
  development_views: {
    columns: [...COMMON, "development_id", "user_id", "viewed_at"],
  },
  scripts: {
    columns: [
      ...COMMON,
      "title",
      "content",
      "development_id",
      "category",
      "status",
      "sort_order",
      "created_by",
      "updated_at",
    ],
  },
};

export function isTable(name: string): name is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, name);
}

export function isColumn(table: TableName, column: string): boolean {
  return TABLES[table].columns.includes(column);
}

/** Linha do banco -> objeto que as telas esperam (JSON e booleanos resolvidos). */
export function fromDb(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const spec = TABLES[table];
  const out: Record<string, unknown> = { ...row };
  for (const col of spec.secret ?? []) delete out[col];
  for (const col of spec.json ?? []) {
    const raw = out[col];
    if (typeof raw === "string") {
      try {
        out[col] = JSON.parse(raw);
      } catch {
        out[col] = null; // valor corrompido não derruba a tela
      }
    }
  }
  for (const col of spec.bool ?? []) {
    if (out[col] != null) out[col] = out[col] === 1 || out[col] === true;
  }
  return out;
}

/** Valor vindo das telas -> valor aceito pelo SQLite. */
export function toDb(table: TableName, column: string, value: unknown): unknown {
  const spec = TABLES[table];
  if (spec.json?.includes(column)) {
    return value == null ? null : JSON.stringify(value);
  }
  if (spec.bool?.includes(column)) {
    return value ? 1 : 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value === undefined ? null : value;
}
