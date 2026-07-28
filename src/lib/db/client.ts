// Cliente de dados usado pelas telas.
//
// Mantém de propósito a MESMA interface do banco local que existia antes
// (db.from("x").select("*").eq("id", 1).maybeSingle()), para que as 20 telas do
// app não precisassem ser reescritas na migração para o Cloudflare D1. A
// diferença é que agora nada é resolvido no navegador: cada consulta vira uma
// chamada ao servidor, que aplica as regras de acesso e fala com o banco.
//
// Consequência prática: tudo aqui é assíncrono de verdade. Onde o banco local
// respondia na hora, agora existe uma ida e volta pela rede.

import type { TableName } from "@/lib/db/types";
import {
  entrarComPinFn,
  entrarComSenhaFn,
  sairFn,
  sessaoAtualFn,
  type RespostaLogin,
} from "./auth";
import type { AppRole } from "./session";
import { runQuery, type Filter, type QueryRequest, type QueryResponse } from "./server";

type Row = Record<string, unknown>;
// `any` é intencional: as telas tipam o resultado no ponto de uso, como faziam
// com o cliente anterior.
/* eslint-disable @typescript-eslint/no-explicit-any */
type QueryResult = { data: any[]; error: { message: string } | null; count: number | null };
type SingleResult = { data: any; error: { message: string } | null; count: number | null };

class QueryBuilder implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private singleMode: "maybe" | "strict" | null = null;
  private embeds: string[] = [];
  private countMode = false;
  private headMode = false;
  private op: QueryRequest["op"] = "select";
  private payload: Row | Row[] | null = null;
  private executed: Promise<SingleResult> | null = null;

  constructor(private table: TableName) {}

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    // Extrai as tabelas embutidas de "*, file_categories(name)".
    for (const m of columns.matchAll(/(\w+)\(([^)]*)\)/g)) this.embeds.push(m[1]);
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    this.scheduleAutoRun();
    return this;
  }

  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    this.scheduleAutoRun();
    return this;
  }

  delete() {
    this.op = "delete";
    this.scheduleAutoRun();
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, opr: "eq", val });
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push({ col, opr: "gte", val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  maybeSingle(): PromiseLike<SingleResult> {
    this.singleMode = "maybe";
    return this as unknown as PromiseLike<SingleResult>;
  }

  single(): PromiseLike<SingleResult> {
    this.singleMode = "strict";
    return this as unknown as PromiseLike<SingleResult>;
  }

  // As telas usam mutação sem await ("dispara e esquece"). O microtask dá tempo
  // de os filtros (.eq) serem encadeados antes do envio.
  private scheduleAutoRun() {
    queueMicrotask(() => void this.run());
  }

  then<T1 = QueryResult, T2 = never>(
    onfulfilled?: ((value: QueryResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled as never, onrejected);
  }

  private run(): Promise<SingleResult> {
    this.executed ??= this.send();
    return this.executed;
  }

  private async send(): Promise<SingleResult> {
    const request: QueryRequest = {
      table: this.table,
      op: this.op,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitN,
      single: this.singleMode,
      count: this.countMode,
      head: this.headMode,
      embeds: this.embeds,
      payload: this.payload,
    };

    let response: QueryResponse;
    try {
      response = await runQuery({ data: request });
    } catch (e) {
      // Falha de rede ou servidor fora do ar.
      console.error("[db] falha de comunicação", this.table, this.op, e);
      return {
        data: this.singleMode ? null : [],
        error: { message: "Sem conexão com o servidor. Verifique a internet e tente de novo." },
        count: null,
      };
    }

    // Consultas que falham devolvem lista vazia (e não null) para as telas que
    // fazem `(data ?? []).map(...)` continuarem funcionando.
    const data = response.data ?? (this.singleMode || this.headMode ? null : []);
    return { data, error: response.error, count: response.count };
  }
}

// Funções que existiam no banco antigo. Hoje são consultas simples: o servidor
// já limita o corretor a ver o próprio papel, então perguntar por outra pessoa
// devolve "não".
async function rpc(
  name: string,
  args: Record<string, any> = {},
): Promise<{ data: any; error: { message: string } | null }> {
  switch (name) {
    case "is_admin":
    case "has_role": {
      const role = name === "is_admin" ? "admin" : args._role;
      const { data, error } = await new QueryBuilder("user_roles")
        .select("id")
        .eq("user_id", args._user_id)
        .eq("role", role);
      return { data: (data ?? []).length > 0, error };
    }
    case "is_active_user": {
      const { data, error } = await new QueryBuilder("profiles")
        .select("status")
        .eq("id", args._user_id)
        .eq("status", "ativo");
      return { data: (data ?? []).length > 0, error };
    }
    default:
      return { data: null, error: { message: `Função desconhecida: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// Entrada e saída
// ---------------------------------------------------------------------------

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type AuthUser = { id: string; role: AppRole };

const authListeners = new Set<(event: AuthEvent) => void>();

function emitAuth(event: AuthEvent) {
  for (const cb of authListeners) {
    try {
      cb(event);
    } catch (e) {
      console.error(e);
    }
  }
}

const auth = {
  /** Quem está logado, segundo o servidor. */
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
    try {
      const sessao = await sessaoAtualFn();
      return {
        data: { user: sessao ? { id: sessao.userId, role: sessao.role } : null },
        error: null,
      };
    } catch {
      // Sem conexão: trata como deslogado, para a tela mandar para o login em
      // vez de travar carregando.
      return { data: { user: null }, error: null };
    }
  },

  async getSession() {
    const { data } = await auth.getUser();
    return { data: { session: data.user ? { user: data.user } : null }, error: null };
  },

  /** Entrada do corretor: 4 dígitos. */
  async entrarComPin(pin: string): Promise<RespostaLogin> {
    const resposta = await entrarComPinFn({ data: { pin } });
    if (resposta.ok) emitAuth("SIGNED_IN");
    return resposta;
  },

  /** Entrada do administrador: e-mail e senha. */
  async entrarComSenha(email: string, senha: string): Promise<RespostaLogin> {
    const resposta = await entrarComSenhaFn({ data: { email, senha } });
    if (resposta.ok) emitAuth("SIGNED_IN");
    return resposta;
  },

  async signOut() {
    await sairFn();
    emitAuth("SIGNED_OUT");
    return { error: null };
  },

  onAuthStateChange(callback: (event: AuthEvent) => void) {
    authListeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback);
          },
        },
      },
    };
  },
};

export const db = {
  from: (table: TableName) => new QueryBuilder(table),
  rpc,
  auth,
};
