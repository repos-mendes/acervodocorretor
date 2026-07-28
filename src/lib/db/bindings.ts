// Acesso ao banco (D1) e ao armazenamento de arquivos (R2) da Cloudflare.
//
// COMO OS BINDINGS CHEGAM AQUI: o preset `cloudflare-module` do Nitro guarda o
// env do Worker em `globalThis.__env__` no início de cada requisição
// (node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs).
// Não dependemos do import "cloudflare:workers", que não existe fora do
// runtime da Cloudflare e quebraria o `vite dev`.
//
// Os tipos abaixo são mínimos e escritos à mão de propósito: só descrevem o que
// este projeto usa. Evita instalar @cloudflare/workers-types inteiro.

export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
};

export type R2Object = {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?: (headers: Headers) => void;
};

export type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};

export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  /** Segredo usado para assinar o cookie de sessão (wrangler secret put). */
  SESSION_SECRET?: string;
};

function readEnv(): Partial<Bindings> {
  return ((globalThis as Record<string, unknown>).__env__ as Partial<Bindings>) ?? {};
}

/**
 * Erro com mensagem em português: se um binding faltar, quem vê o erro é o
 * Lucas, não um desenvolvedor. A causa quase sempre é wrangler.jsonc
 * incompleto ou `vite dev` puro (que não tem D1/R2 — use `wrangler dev`).
 */
function missing(name: string): never {
  throw new Error(
    `O ${name} não está disponível. Se você rodou "npm run dev", use ` +
      `"npm run dev:cloudflare" — o banco e os arquivos só existem dentro da ` +
      `Cloudflare. Se o erro apareceu no site publicado, confira o wrangler.jsonc.`,
  );
}

export function getDb(): D1Database {
  return readEnv().DB ?? missing("banco de dados (D1)");
}

export function getFiles(): R2Bucket {
  return readEnv().FILES ?? missing("armazenamento de arquivos (R2)");
}

export function getSessionSecret(): string {
  const secret = readEnv().SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "O segredo de sessão (SESSION_SECRET) não está configurado. Rode: " +
        "npx wrangler secret put SESSION_SECRET",
    );
  }
  return secret;
}
