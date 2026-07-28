// Ponte entre as telas e o motor de consultas.
//
// É de propósito um arquivo curto: toda a lógica (SQL e regras de acesso) mora
// em src/lib/db/query.ts, que não depende do framework e por isso pode ser
// testado sem subir servidor. Aqui ficam só as três coisas que dependem da
// requisição: quem está logado, qual é o banco, e o tratamento de erro.

import { createServerFn } from "@tanstack/react-start";

import { getDb } from "./bindings";
import { DeniedError, executeQuery, type QueryRequest, type QueryResponse } from "./query";
import { readSession } from "./session";

export type { Filter, Json, QueryRequest, QueryResponse } from "./query";

/**
 * As mensagens do SQLite são em inglês e falam de coisas internas ("UNIQUE
 * constraint failed"). Quem lê o erro é o Lucas no painel, então as situações
 * previsíveis viram frases úteis.
 */
function traduzirErroDoBanco(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  if (texto.includes("profiles.pin")) {
    return "Este PIN já está em uso por outro corretor. Escolha outros 4 números.";
  }
  if (texto.includes("developments.slug")) {
    return "Já existe um empreendimento com esse endereço (slug). Mude o nome.";
  }
  if (texto.includes("file_categories.name")) {
    return "Já existe uma categoria com esse nome.";
  }
  if (texto.includes("FOREIGN KEY")) {
    return "Este registro está ligado a outro e não pode ser alterado assim.";
  }
  return "Não foi possível concluir a operação. Tente de novo.";
}

export const runQuery = createServerFn({ method: "POST" })
  .validator((data: QueryRequest) => data)
  .handler(async ({ data }): Promise<QueryResponse> => {
    try {
      const session = await readSession();
      if (!session) {
        return { data: null, error: { message: "Sessão expirada. Entre novamente." }, count: null };
      }
      return await executeQuery(data, session, getDb());
    } catch (e) {
      if (e instanceof DeniedError) {
        return { data: null, error: { message: e.message }, count: null };
      }
      // Erro inesperado: o detalhe vai para o log do Worker, não para a tela.
      console.error("[db] falha na consulta", data.table, data.op, e);
      return { data: null, error: { message: traduzirErroDoBanco(e) }, count: null };
    }
  });
