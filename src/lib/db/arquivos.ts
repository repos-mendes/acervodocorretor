// Entrega e recebimento dos arquivos guardados no Cloudflare R2.
//
// O bucket é PRIVADO: não existe endereço público para nenhum arquivo. Tudo
// passa por aqui, e aqui a sessão é conferida antes de qualquer byte sair. Foi
// essa a razão de escolher o R2 — download não é cobrado —, mas a contrapartida
// é que a proteção, que no Supabase vinha pronta, é este arquivo.
//
// Endereços atendidos:
//   GET    /arquivos/<pasta>/<caminho>   baixa ou exibe (precisa estar logado)
//   PUT    /arquivos/<pasta>/<caminho>   envia (admin; corretor só o próprio avatar)
//   DELETE /arquivos/<pasta>/<caminho>   remove (admin)
//
// O corpo do PUT é o arquivo cru, sem formulário multipart: o navegador manda
// o File direto e o Worker repassa ao R2 sem precisar interpretar nada.

import { getFiles, type R2Bucket } from "./bindings";
import { readSession, type Session } from "./session";

export const PREFIXO = "/arquivos/";

/** As quatro pastas do acervo. Vira o começo do nome do objeto no R2. */
const PASTAS = ["covers", "galleries", "materials", "avatars"] as const;
type Pasta = (typeof PASTAS)[number];

function ehPasta(valor: string): valor is Pasta {
  return (PASTAS as readonly string[]).includes(valor);
}

const erro = (status: number, mensagem: string) =>
  new Response(mensagem, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * Confere o caminho pedido. Sem isto, um caminho com ".." poderia apontar para
 * fora da pasta e alcançar arquivos de outra área.
 */
function separarCaminho(pathname: string): { pasta: Pasta; caminho: string } | null {
  const resto = decodeURIComponent(pathname.slice(PREFIXO.length));
  const barra = resto.indexOf("/");
  if (barra <= 0) return null;

  const pasta = resto.slice(0, barra);
  const caminho = resto.slice(barra + 1);
  if (!ehPasta(pasta) || !caminho) return null;

  // eslint-disable-next-line no-control-regex
  if (caminho.includes("..") || caminho.startsWith("/") || /[\\\x00-\x1f]/.test(caminho)) {
    return null;
  }
  return { pasta, caminho };
}

/**
 * Quem pode gravar/apagar. O administrador mexe em tudo; o corretor só pode
 * trocar a própria foto, e apenas dentro de uma pasta com o id dele — assim
 * não sobrescreve a foto de um colega.
 */
function podeEscrever(sessao: Session, pasta: Pasta, caminho: string): boolean {
  if (sessao.role === "admin") return true;
  return pasta === "avatars" && caminho.startsWith(`${sessao.userId}/`);
}

/**
 * Trata a requisição de arquivo, ou devolve null quando o endereço não é nosso
 * (aí o site segue o caminho normal).
 */
export async function tratarArquivo(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIXO)) return null;
  // A sessão só é lida depois de confirmar que o endereço é nosso, para não
  // pagar esse custo em toda página do site.
  return responder(request, await readSession(), getFiles());
}

/**
 * O miolo, com a sessão e o bucket recebidos de fora — é assim que
 * tests/arquivos.test.ts consegue exercitar as permissões sem subir servidor.
 */
export async function responder(
  request: Request,
  sessao: Session | null,
  bucket: R2Bucket,
): Promise<Response> {
  const url = new URL(request.url);
  const alvo = separarCaminho(url.pathname);
  if (!alvo) return erro(400, "Endereço de arquivo inválido.");

  if (!sessao) return erro(401, "É preciso entrar na plataforma para acessar os arquivos.");

  const chave = `${alvo.pasta}/${alvo.caminho}`;

  if (request.method === "GET") {
    const objeto = await bucket.get(chave);
    if (!objeto) return erro(404, "Arquivo não encontrado.");

    const headers = new Headers();
    headers.set("content-type", objeto.httpMetadata?.contentType || "application/octet-stream");
    if (objeto.size != null) headers.set("content-length", String(objeto.size));
    // "private": pode ficar no navegador de quem baixou, mas nunca num cache
    // compartilhado — o arquivo depende de quem está logado.
    headers.set("cache-control", "private, max-age=3600");

    // ?download=1 força o "salvar como" em vez de abrir na aba.
    const nome = url.searchParams.get("nome");
    if (url.searchParams.get("download") === "1") {
      const seguro = (nome || alvo.caminho.split("/").pop() || "arquivo").replace(/["\\]/g, "");
      headers.set(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(seguro)}`,
      );
    }

    return new Response(objeto.body as BodyInit, { headers });
  }

  if (request.method === "PUT") {
    if (!podeEscrever(sessao, alvo.pasta, alvo.caminho)) {
      return erro(403, "Você não tem permissão para enviar arquivos aqui.");
    }
    const corpo = await request.arrayBuffer();
    if (corpo.byteLength === 0) return erro(400, "Arquivo vazio.");
    await bucket.put(chave, corpo, {
      httpMetadata: {
        contentType: request.headers.get("content-type") || "application/octet-stream",
      },
    });
    return new Response(null, { status: 204 });
  }

  if (request.method === "DELETE") {
    if (!podeEscrever(sessao, alvo.pasta, alvo.caminho)) {
      return erro(403, "Você não tem permissão para apagar este arquivo.");
    }
    await bucket.delete(chave);
    return new Response(null, { status: 204 });
  }

  return erro(405, "Método não suportado.");
}
