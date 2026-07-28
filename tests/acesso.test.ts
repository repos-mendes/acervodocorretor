// TESTE DAS REGRAS DE ACESSO — o mais importante do projeto.
//
// No Supabase as regras de quem-vê-o-quê moravam dentro do banco (RLS). No
// Cloudflare D1 elas moram no nosso código (src/lib/db/access.ts). Este teste
// existe para que essa troca não vire um buraco silencioso: ele roda o motor de
// consultas DE VERDADE contra um SQLite de verdade e confere, uma por uma, as
// coisas que um corretor não pode fazer.
//
// Rodar:  npm run test
// (ou, direto:  node_modules/.bin/esbuild tests/acesso.test.ts --bundle
//               --platform=node --format=esm --alias:@=./src --packages=external
//               --outfile=node_modules/.tmp/acesso.mjs && node node_modules/.tmp/acesso.mjs)
//
// Se você mexer em access.ts e um teste aqui falhar, o teste provavelmente está
// certo e a mudança abriu uma porta que devia estar fechada.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { executeQuery, DeniedError, type QueryRequest } from "@/lib/db/query";
import type { Session } from "@/lib/db/session";

const MIGRATIONS = process.argv[2] ?? "migrations";

// ---- adaptador: interface do D1 sobre o node:sqlite ----
function d1(sqlite: DatabaseSync) {
  return {
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
  };
}

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON;");
for (const f of ["0001_init.sql", "0002_seed.sql"]) {
  sqlite.exec(readFileSync(`${MIGRATIONS}/${f}`, "utf8"));
}
const DB = d1(sqlite) as never;

// ---- gente ----
sqlite.exec(`
  INSERT INTO profiles (id, full_name, phone, pin) VALUES
    ('u-ana',  'Ana Corretora',  '77991110001', '0001'),
    ('u-bruno','Bruno Corretor', '77991110002', '0002'),
    ('u-lucas','Lucas Admin',    '77991110003', NULL);
  INSERT INTO user_roles (id, user_id, role) VALUES
    ('r-ana','u-ana','corretor'), ('r-bruno','u-bruno','corretor'), ('r-lucas','u-lucas','admin');
  -- um empreendimento em rascunho, que o corretor NAO pode ver
  INSERT INTO developments (id, name, slug, publication_status, sort_order)
    VALUES ('dev-secreto', 'Lancamento Sigiloso', 'sigiloso', 'draft', 99);
  -- material publicado dentro do empreendimento em rascunho
  INSERT INTO development_files (id, development_id, category_id, title, storage_path, original_file_name, publication_status)
    VALUES ('f-secreto','dev-secreto','cat-book','Tabela do sigiloso','materials/x.pdf','x.pdf','published');
  INSERT INTO development_files (id, development_id, category_id, title, storage_path, original_file_name, publication_status)
    VALUES ('f-publico','dev-sculptor','cat-book','Book Sculptor','materials/s.pdf','s.pdf','published');
  INSERT INTO development_files (id, development_id, category_id, title, storage_path, original_file_name, publication_status)
    VALUES ('f-rascunho','dev-sculptor','cat-book','Tabela nao liberada','materials/t.pdf','t.pdf','draft');
`);

const ana: Session = { userId: "u-ana", role: "corretor" };
const lucas: Session = { userId: "u-lucas", role: "admin" };

const q = (p: Partial<QueryRequest>): QueryRequest => ({
  table: "developments",
  op: "select",
  filters: [],
  orders: [],
  limit: null,
  single: null,
  count: false,
  head: false,
  embeds: [],
  payload: null,
  ...p,
});

let falhas = 0;
function checa(rotulo: string, condicao: boolean, detalhe = "") {
  console.log(`${condicao ? "ok  " : "FALHA"} ${rotulo}${detalhe ? ` -> ${detalhe}` : ""}`);
  if (!condicao) falhas++;
}
async function barrado(rotulo: string, req: QueryRequest, sess: Session) {
  try {
    await executeQuery(req, sess, DB);
    checa(rotulo, false, "nao foi barrado!");
  } catch (e) {
    checa(rotulo, e instanceof DeniedError, e instanceof Error ? e.message : String(e));
  }
}
const linhas = (r: { data: unknown }) => (r.data as unknown[]) ?? [];

console.log("=== LEITURA: corretor ===");
const devsAna = await executeQuery(q({}), ana, DB);
checa(
  "corretor ve so empreendimentos publicados",
  linhas(devsAna).length === 7,
  `${linhas(devsAna).length} de 8 (1 em rascunho)`,
);

const secreto = await executeQuery(
  q({ filters: [{ col: "id", opr: "eq", val: "dev-secreto" }] }),
  ana,
  DB,
);
checa("corretor pedindo o rascunho pelo id recebe vazio", linhas(secreto).length === 0);

const devsLucas = await executeQuery(q({}), lucas, DB);
checa("admin ve todos", linhas(devsLucas).length === 8, `${linhas(devsLucas).length}`);

console.log("\n=== LEITURA: materiais herdam o empreendimento ===");
const arquivos = await executeQuery(q({ table: "development_files" }), ana, DB);
const titulos = linhas(arquivos).map((r) => (r as Record<string, string>).title);
checa(
  "corretor ve so o material publicado de empreendimento publicado",
  titulos.length === 1 && titulos[0] === "Book Sculptor",
  JSON.stringify(titulos),
);
checa(
  "admin ve os 3 materiais",
  linhas(await executeQuery(q({ table: "development_files" }), lucas, DB)).length === 3,
);

console.log("\n=== LEITURA: perfis ===");
const perfis = await executeQuery(q({ table: "profiles" }), ana, DB);
checa(
  "corretor ve so o proprio perfil",
  linhas(perfis).length === 1 && (linhas(perfis)[0] as Record<string, string>).id === "u-ana",
);
const perfilBruno = await executeQuery(
  q({ table: "profiles", filters: [{ col: "id", opr: "eq", val: "u-bruno" }] }),
  ana,
  DB,
);
checa("corretor pedindo o perfil do colega recebe vazio", linhas(perfilBruno).length === 0);
checa(
  "admin lista os 3 perfis",
  linhas(await executeQuery(q({ table: "profiles" }), lucas, DB)).length === 3,
);

console.log("\n=== A SENHA DO ADMIN NUNCA SAI DO SERVIDOR ===");
sqlite.exec("UPDATE profiles SET password_hash = 'pbkdf2$210000$sal$resumo' WHERE id = 'u-lucas'");
const perfisAdmin = await executeQuery(q({ table: "profiles" }), lucas, DB);
checa(
  "nem o proprio admin recebe o password_hash",
  linhas(perfisAdmin).every((r) => !("password_hash" in (r as object))),
  Object.keys(linhas(perfisAdmin)[0] as object).join(","),
);
const meuPerfil = await executeQuery(
  q({ table: "profiles", filters: [{ col: "id", opr: "eq", val: "u-ana" }], single: "maybe" }),
  ana,
  DB,
);
checa("nem numa consulta de uma linha so", !("password_hash" in (meuPerfil.data as object)));

console.log("\n=== ESCRITA: o que o corretor nao pode ===");
await barrado(
  "corretor apagando empreendimento",
  q({
    table: "developments",
    op: "delete",
    filters: [{ col: "id", opr: "eq", val: "dev-sculptor" }],
  }),
  ana,
);
await barrado(
  "corretor criando empreendimento",
  q({ table: "developments", op: "insert", payload: { name: "Meu", slug: "meu" } }),
  ana,
);
await barrado(
  "corretor editando script",
  q({
    table: "scripts",
    op: "update",
    filters: [{ col: "id", opr: "eq", val: "scr-pos-venda" }],
    payload: { content: "x" },
  }),
  ana,
);
await barrado(
  "corretor lendo os downloads de todo mundo (tabela sem regra de leitura)",
  q({ table: "development_views" }),
  ana,
);

console.log("\n=== ESCRITA: o corretor mexendo no proprio perfil ===");
await executeQuery(
  q({
    table: "profiles",
    op: "update",
    filters: [{ col: "id", opr: "eq", val: "u-ana" }],
    payload: { full_name: "Ana Silva", pin: "9999", status: "inativo" },
  }),
  ana,
  DB,
);
const anaDepois = sqlite
  .prepare("SELECT full_name, pin, status FROM profiles WHERE id='u-ana'")
  .get() as Record<string, string>;
checa("nome proprio alterado", anaDepois.full_name === "Ana Silva", anaDepois.full_name);
checa(
  "PIN proprio NAO alterado (coluna fora da lista)",
  anaDepois.pin === "0001",
  `pin=${anaDepois.pin}`,
);
checa(
  "status NAO alterado (nao se reativa sozinho)",
  anaDepois.status === "ativo",
  anaDepois.status,
);

// A tela manda o id do Bruno; a regra `self` acrescenta id='u-ana' -> nao acha ninguem.
await executeQuery(
  q({
    table: "profiles",
    op: "update",
    filters: [{ col: "id", opr: "eq", val: "u-bruno" }],
    payload: { full_name: "INVADIDO" },
  }),
  ana,
  DB,
);
const bruno = sqlite.prepare("SELECT full_name FROM profiles WHERE id='u-bruno'").get() as Record<
  string,
  string
>;
checa(
  "corretor NAO altera o perfil do colega",
  bruno.full_name === "Bruno Corretor",
  bruno.full_name,
);

console.log("\n=== ESCRITA: carimbo do servidor ===");
// Ana registra um download dizendo que foi o Bruno. O servidor sobrescreve.
await executeQuery(
  q({
    table: "file_downloads",
    op: "insert",
    payload: { file_id: "f-publico", development_id: "dev-sculptor", user_id: "u-bruno" },
  }),
  ana,
  DB,
);
const dl = sqlite.prepare("SELECT user_id FROM file_downloads").get() as Record<string, string>;
checa(
  "user_id do download foi carimbado como quem esta logado",
  dl.user_id === "u-ana",
  dl.user_id,
);
const cont = sqlite
  .prepare("SELECT download_count FROM development_files WHERE id='f-publico'")
  .get() as Record<string, number>;
checa("contador de downloads incrementado", cont.download_count === 1, String(cont.download_count));

console.log("\n=== NOMES INVALIDOS E OPERACOES PERIGOSAS ===");
await barrado("tabela inexistente", q({ table: "sqlite_master" }), lucas);
await barrado(
  "coluna inexistente no filtro",
  q({ filters: [{ col: "senha", opr: "eq", val: "x" }] }),
  lucas,
);
await barrado(
  "tentativa de injecao pelo nome da coluna",
  q({ filters: [{ col: "id=1 OR 1=1--", opr: "eq", val: "x" }] }),
  lucas,
);
await barrado(
  "tentativa de injecao pela ordenacao",
  q({ orders: [{ col: "id; DROP TABLE developments", asc: true }] }),
  lucas,
);
await barrado(
  "DELETE sem filtro (apagaria a tabela)",
  q({ table: "scripts", op: "delete" }),
  lucas,
);
await barrado(
  "UPDATE sem filtro (reescreveria a tabela)",
  q({ table: "scripts", op: "update", payload: { status: "inactive" } }),
  lucas,
);

console.log("\n=== CONVERSOES (SQLite nao tem array nem booleano) ===");
const um = await executeQuery(
  q({ filters: [{ col: "slug", opr: "eq", val: "sculptor" }], single: "maybe" }),
  ana,
  DB,
);
const dev = um.data as Record<string, unknown>;
checa("highlights voltou como array", Array.isArray(dev.highlights), typeof dev.highlights);
checa(
  "is_featured voltou como booleano",
  typeof dev.is_featured === "boolean",
  typeof dev.is_featured,
);

await executeQuery(
  q({
    table: "developments",
    op: "update",
    filters: [{ col: "id", opr: "eq", val: "dev-sculptor" }],
    payload: { highlights: ["A", "B"], is_featured: true },
  }),
  lucas,
  DB,
);
const bruto = sqlite
  .prepare("SELECT highlights, is_featured FROM developments WHERE id='dev-sculptor'")
  .get() as Record<string, unknown>;
checa("array salvo como texto JSON", bruto.highlights === '["A","B"]', String(bruto.highlights));
checa("booleano salvo como 1", bruto.is_featured === 1, String(bruto.is_featured));

console.log('\n=== TABELA EMBUTIDA (select "*, file_categories(name)") ===');
const comCat = await executeQuery(
  q({ table: "development_files", embeds: ["file_categories"] }),
  ana,
  DB,
);
const primeiro = linhas(comCat)[0] as Record<string, Record<string, string>>;
checa(
  "categoria veio junto",
  primeiro?.file_categories?.name === "Book",
  JSON.stringify(primeiro?.file_categories),
);

console.log("\n=== CONTAGEM ===");
const contagem = await executeQuery(q({ count: true, head: true }), ana, DB);
checa("count respeita a regra de acesso", contagem.count === 7, String(contagem.count));

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
