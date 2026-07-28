// Confere as migrations do D1 (migrations/*.sql) aplicando-as num SQLite real.
//
// Serve para pegar erro de digitação em SQL antes de ele chegar ao banco de
// produção, e para garantir que rodar o seed duas vezes não duplica nada.
//
// Rodar:  npm run test
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const MIGRATIONS = process.argv[2] ?? "migrations";

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");

let falhas = 0;
function checa(rotulo: string, condicao: boolean, detalhe = "") {
  console.log(`${condicao ? "ok  " : "FALHA"} ${rotulo}${detalhe ? ` -> ${detalhe}` : ""}`);
  if (!condicao) falhas++;
}
function rejeita(rotulo: string, sql: string) {
  try {
    db.exec(sql);
    checa(rotulo, false, "foi aceito, mas devia ser rejeitado");
  } catch (e) {
    checa(rotulo, true, e instanceof Error ? e.message.split("\n")[0] : "");
  }
}
const conta = (sql: string) => Number(Object.values(db.prepare(sql).get() as object)[0]);

console.log("=== aplicando as migrations ===");
for (const f of ["0001_init.sql", "0002_seed.sql"]) {
  db.exec(readFileSync(`${MIGRATIONS}/${f}`, "utf8"));
  console.log(`ok   ${f}`);
}

console.log("\n=== conteudo inicial ===");
checa("5 categorias de arquivo", conta("SELECT count(*) FROM file_categories") === 5);
checa("7 empreendimentos", conta("SELECT count(*) FROM developments") === 7);
checa("12 scripts", conta("SELECT count(*) FROM scripts") === 12);
checa(
  "7 scripts de empreendimento",
  conta("SELECT count(*) FROM scripts WHERE development_id IS NOT NULL") === 7,
);
checa("5 scripts gerais", conta("SELECT count(*) FROM scripts WHERE development_id IS NULL") === 5);
checa(
  "nenhum script orfao",
  conta(
    "SELECT count(*) FROM scripts s LEFT JOIN developments d ON d.id = s.development_id " +
      "WHERE s.development_id IS NOT NULL AND d.id IS NULL",
  ) === 0,
);
checa(
  "highlights sao JSON valido",
  conta("SELECT count(*) FROM developments WHERE json_valid(highlights) = 1") === 7,
);

console.log("\n=== o seed pode rodar duas vezes ===");
db.exec(readFileSync(`${MIGRATIONS}/0002_seed.sql`, "utf8"));
checa("empreendimentos nao duplicaram", conta("SELECT count(*) FROM developments") === 7);
checa("scripts nao duplicaram", conta("SELECT count(*) FROM scripts") === 12);

console.log("\n=== regras do banco ===");
db.exec(
  "INSERT INTO profiles (id, full_name, phone, pin) VALUES ('p1','Corretor Um','77999991234','1234')",
);
rejeita("PIN repetido", "INSERT INTO profiles (id, full_name, pin) VALUES ('p2','Dois','1234')");
rejeita(
  "PIN fora de 4 digitos",
  "INSERT INTO profiles (id, full_name, pin) VALUES ('p3','Tres','123')",
);
rejeita("papel invalido", "INSERT INTO user_roles (id, user_id, role) VALUES ('x','p1','gerente')");
rejeita(
  "situacao comercial invalida",
  "INSERT INTO developments (id,name,slug,commercial_status) VALUES ('d','X','x','vendido')",
);
rejeita(
  "download de usuario inexistente",
  "INSERT INTO file_downloads (id,file_id,user_id) VALUES ('x','nao-existe','p1')",
);

db.exec("INSERT INTO profiles (id, full_name) VALUES ('p4','Sem PIN A')");
db.exec("INSERT INTO profiles (id, full_name) VALUES ('p5','Sem PIN B')");
checa(
  "dois perfis sem PIN convivem (indice parcial)",
  conta("SELECT count(*) FROM profiles WHERE pin IS NULL") === 2,
);

const antes = conta("SELECT count(*) FROM scripts");
db.exec("DELETE FROM developments WHERE id = 'dev-sculptor'");
checa(
  "apagar empreendimento leva os scripts dele junto",
  conta("SELECT count(*) FROM scripts") === antes - 1,
);

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
