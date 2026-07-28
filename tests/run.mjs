// Executa as suítes de teste.
//
// Os testes são TypeScript e importam o código do app por "@/...", então
// precisam ser empacotados antes de rodar. Fazemos isso pela API JavaScript do
// esbuild, de propósito — e não chamando o programa `esbuild` na linha de
// comando — porque a forma de invocar esse programa muda conforme o sistema:
//
//   * no Windows, node_modules/esbuild/bin/esbuild é um script Node;
//   * no Linux (o CI), o mesmo caminho é o binário nativo;
//   * e os atalhos de node_modules/.bin são bloqueados pela política de grupo
//     da máquina do Lucas.
//
// A API de JavaScript funciona igual nos três casos.
//
// Uso:  node tests/run.mjs            (roda todas)
//       node tests/run.mjs login      (roda uma)

import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = resolve(RAIZ, "node_modules/.tmp");

// A ordem importa para a leitura: do banco para cima.
const TODAS = ["schema", "acesso", "login", "arquivos"];

const pedidas = process.argv.slice(2);
const suites = pedidas.length ? pedidas : TODAS;

for (const nome of suites) {
  if (!TODAS.includes(nome)) {
    console.error(`Suíte desconhecida: "${nome}". Existem: ${TODAS.join(", ")}`);
    process.exit(1);
  }
}

await mkdir(SAIDA, { recursive: true });

function rodar(arquivo) {
  return new Promise((resolvePromise) => {
    const filho = spawn(process.execPath, [arquivo, resolve(RAIZ, "migrations")], {
      stdio: "inherit",
      cwd: RAIZ,
    });
    filho.on("close", (codigo) => resolvePromise(codigo ?? 1));
  });
}

let falhou = false;

for (const nome of suites) {
  const saida = resolve(SAIDA, `${nome}.mjs`);

  await build({
    entryPoints: [resolve(RAIZ, `tests/${nome}.test.ts`)],
    outfile: saida,
    bundle: true,
    platform: "node",
    format: "esm",
    // Mantém "node:sqlite" e afins como importações normais, em vez de
    // tentar empacotá-los.
    packages: "external",
    alias: { "@": resolve(RAIZ, "src") },
    absWorkingDir: RAIZ,
  });

  // Cada suíte roda num processo próprio: elas chamam process.exit() ao
  // terminar, então não dá para encadear várias no mesmo processo.
  if ((await rodar(saida)) !== 0) falhou = true;
}

process.exit(falhou ? 1 : 0);
