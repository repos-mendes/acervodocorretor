// Quem pode ler e escrever o quê. Este arquivo substitui o RLS do Postgres.
//
// LEIA ANTES DE MEXER: no Supabase as regras de acesso moravam dentro do banco,
// então mesmo um erro no app não deixava um corretor ver o que não devia. O D1
// não tem esse recurso — as regras vivem aqui, no servidor. Este é o único
// ponto que separa o corretor do administrador. Afrouxar uma linha aqui
// afrouxa o app inteiro.
//
// Regra de ouro: o corretor NUNCA escolhe o próprio filtro. As condições abaixo
// são texto fixo, escrito por nós, sempre acrescentado ao que a tela pediu —
// nunca substituindo. Se a tela pedir um empreendimento em rascunho, o filtro
// continua lá e o resultado vem vazio.

import type { TableName } from "@/lib/db/types";
import type { AppRole } from "./session";

export type Operation = "select" | "insert" | "update" | "delete";

export type Rule =
  | false
  | {
      /** Condição SQL fixa somada ao WHERE. Sem entrada do usuário, nunca. */
      where?: string;
      /** Coluna que precisa ser igual ao id de quem está logado. */
      self?: string;
      /** Colunas que podem ser gravadas. Ausente = todas. */
      columns?: readonly string[];
      /** Colunas preenchidas pelo servidor com o id de quem está logado. */
      forceSelf?: readonly string[];
    };

// Um empreendimento só aparece para o corretor se estiver publicado. Materiais
// e scripts herdam essa regra: despublicar o empreendimento esconde tudo dele.
const devPublicado = (coluna: string) =>
  `(${coluna} IS NULL OR EXISTS (SELECT 1 FROM developments d ` +
  `WHERE d.id = ${coluna} AND d.publication_status = 'published'))`;

const CORRETOR: Partial<Record<TableName, Partial<Record<Operation, Rule>>>> = {
  profiles: {
    // Só o próprio perfil: um corretor não lista os colegas.
    select: { self: "id" },
    // Note que `pin`, `password_hash` e `status` ficam de fora: ninguém muda o
    // próprio PIN nem se reativa sozinho.
    update: { self: "id", columns: ["full_name", "phone", "creci", "avatar_url"] },
  },
  user_roles: {
    // Precisa ler o próprio papel para a tela saber se mostra o menu de admin.
    select: { self: "user_id" },
  },
  developments: {
    select: { where: "publication_status = 'published'" },
  },
  file_categories: {
    select: { where: "is_active = 1" },
  },
  development_files: {
    select: {
      where: `publication_status = 'published' AND ${devPublicado("development_files.development_id")}`,
    },
  },
  scripts: {
    select: {
      where: `status = 'active' AND ${devPublicado("scripts.development_id")}`,
    },
  },
  file_downloads: {
    // Registra o próprio download; o servidor carimba de quem é.
    insert: { forceSelf: ["user_id"] },
    select: { self: "user_id" },
  },
  development_views: {
    insert: { forceSelf: ["user_id"] },
  },
};

// O administrador é o dono do acervo: lê e escreve tudo.
const ADMIN_LIBERADO = {} as const;

export function getRule(role: AppRole, table: TableName, op: Operation): Rule {
  if (role === "admin") return ADMIN_LIBERADO;
  return CORRETOR[table]?.[op] ?? false;
}

/** Mensagem mostrada quando a regra barra a operação. */
export function deniedMessage(table: TableName, op: Operation): string {
  const acao = { select: "ver", insert: "criar", update: "alterar", delete: "apagar" }[op];
  return `Você não tem permissão para ${acao} registros de "${table}".`;
}
