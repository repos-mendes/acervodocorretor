// TESTE DA ENTREGA DE ARQUIVOS — o portão do bucket R2.
//
// O bucket é privado: nenhum arquivo tem endereço público. Tudo passa pelo
// servidor, que confere a sessão antes de entregar. Este teste exercita esse
// portão: quem entra, quem não entra, e o que acontece com caminhos maliciosos.
//
// Rodar:  npm run test

import { responder } from "@/lib/db/arquivos";
import type { R2Bucket } from "@/lib/db/bindings";
import type { Session } from "@/lib/db/session";
import { checa, encerrar, titulo } from "./apoio";

// ---- bucket R2 de mentira, guardando tudo na memória ----
function bucketFalso() {
  const objetos = new Map<string, { corpo: string; tipo: string }>();
  const bucket = {
    async get(chave: string) {
      const o = objetos.get(chave);
      if (!o) return null;
      return {
        body: new Blob([o.corpo]).stream(),
        size: o.corpo.length,
        httpMetadata: { contentType: o.tipo },
      };
    },
    async put(
      chave: string,
      valor: ArrayBuffer,
      opts?: { httpMetadata?: { contentType?: string } },
    ) {
      objetos.set(chave, {
        corpo: new TextDecoder().decode(valor),
        tipo: opts?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async delete(chave: string) {
      objetos.delete(chave);
    },
  } as unknown as R2Bucket;
  return { bucket, objetos };
}

const admin: Session = { userId: "u-lucas", role: "admin" };
const ana: Session = { userId: "u-ana", role: "corretor" };

const pedir = (caminho: string, method = "GET", corpo?: string) =>
  new Request(`https://acervo.exemplo${caminho}`, {
    method,
    body: corpo,
    headers: corpo ? { "content-type": "application/pdf" } : undefined,
  });

const { bucket, objetos } = bucketFalso();
objetos.set("materials/dev-sculptor/book.pdf", {
  corpo: "conteudo do book",
  tipo: "application/pdf",
});
objetos.set("avatars/u-ana/foto.jpg", { corpo: "bytes da foto", tipo: "image/jpeg" });

titulo("sem estar logado");
const semSessao = await responder(pedir("/arquivos/materials/dev-sculptor/book.pdf"), null, bucket);
checa(
  "nao entrega arquivo para quem nao esta logado",
  semSessao.status === 401,
  String(semSessao.status),
);

titulo("logado: leitura");
const ok = await responder(pedir("/arquivos/materials/dev-sculptor/book.pdf"), ana, bucket);
checa("corretor baixa material publicado", ok.status === 200, String(ok.status));
checa("devolve o tipo do arquivo", ok.headers.get("content-type") === "application/pdf");
checa(
  "marca o cache como privado",
  (ok.headers.get("cache-control") ?? "").includes("private"),
  ok.headers.get("cache-control") ?? "",
);
checa("conteudo correto", (await ok.text()) === "conteudo do book");

const inexistente = await responder(pedir("/arquivos/materials/nao/existe.pdf"), ana, bucket);
checa("arquivo inexistente da 404", inexistente.status === 404, String(inexistente.status));

titulo("salvar como (?download=1)");
const baixar = await responder(
  pedir("/arquivos/materials/dev-sculptor/book.pdf?download=1&nome=Book%20Sculptor.pdf"),
  ana,
  bucket,
);
const disp = baixar.headers.get("content-disposition") ?? "";
checa("forca o download", disp.startsWith("attachment"), disp);
checa("preserva o nome original com acentos/espacos", disp.includes("Book%20Sculptor.pdf"), disp);
const semDownload = await responder(
  pedir("/arquivos/materials/dev-sculptor/book.pdf"),
  ana,
  bucket,
);
checa("sem ?download abre na aba", semDownload.headers.get("content-disposition") === null);

titulo("caminhos maliciosos");
for (const ruim of [
  "/arquivos/materials/../../etc/senha",
  "/arquivos/materials/..%2F..%2Fsegredo",
  "/arquivos/segredos/algo.txt",
  "/arquivos/materials/",
  "/arquivos/materials",
  "/arquivos//x",
  // Barra invertida só chega até nós codificada: o padrão de URL troca a
  // barra invertida crua por "/" antes mesmo de o servidor ver o endereço.
  "/arquivos/materials/pasta%5Carquivo",
  "/arquivos/materials/quebra%00linha",
]) {
  const r = await responder(pedir(ruim), admin, bucket);
  checa(`recusa "${ruim}"`, r.status === 400, String(r.status));
}

titulo("envio de arquivo");
const envioAdmin = await responder(
  pedir("/arquivos/materials/dev-uni-ville/tabela.pdf", "PUT", "nova tabela"),
  admin,
  bucket,
);
checa("admin envia material", envioAdmin.status === 204, String(envioAdmin.status));
checa(
  "arquivo ficou no bucket",
  objetos.get("materials/dev-uni-ville/tabela.pdf")?.corpo === "nova tabela",
);

const envioCorretor = await responder(
  pedir("/arquivos/materials/dev-uni-ville/falso.pdf", "PUT", "material pirata"),
  ana,
  bucket,
);
checa("corretor NAO envia material", envioCorretor.status === 403, String(envioCorretor.status));

const avatarProprio = await responder(
  pedir("/arquivos/avatars/u-ana/nova.jpg", "PUT", "minha foto"),
  ana,
  bucket,
);
checa("corretor troca a PROPRIA foto", avatarProprio.status === 204, String(avatarProprio.status));

const avatarAlheio = await responder(
  pedir("/arquivos/avatars/u-bruno/nova.jpg", "PUT", "foto trocada"),
  ana,
  bucket,
);
checa(
  "corretor NAO troca a foto do colega",
  avatarAlheio.status === 403,
  String(avatarAlheio.status),
);

const vazio = await responder(pedir("/arquivos/materials/x/vazio.pdf", "PUT", ""), admin, bucket);
checa("recusa arquivo vazio", vazio.status === 400, String(vazio.status));

titulo("remocao");
const apagaCorretor = await responder(
  pedir("/arquivos/materials/dev-sculptor/book.pdf", "DELETE"),
  ana,
  bucket,
);
checa("corretor NAO apaga material", apagaCorretor.status === 403, String(apagaCorretor.status));
checa("e o arquivo continua la", objetos.has("materials/dev-sculptor/book.pdf"));

const apagaAdmin = await responder(
  pedir("/arquivos/materials/dev-sculptor/book.pdf", "DELETE"),
  admin,
  bucket,
);
checa("admin apaga material", apagaAdmin.status === 204, String(apagaAdmin.status));
checa("arquivo saiu do bucket", !objetos.has("materials/dev-sculptor/book.pdf"));

titulo("metodo nao suportado");
const patch = await responder(pedir("/arquivos/materials/a/b.pdf", "PATCH"), admin, bucket);
checa("PATCH e recusado", patch.status === 405, String(patch.status));

encerrar();
