// Arquivos do acervo, vistos pelas telas.
//
// Os arquivos ficam no Cloudflare R2, num bucket privado — não existe endereço
// público para nenhum deles. O que estas funções devolvem é um caminho do
// próprio site (/arquivos/...), atendido pelo servidor, que confere a sessão
// antes de entregar (src/lib/db/arquivos.ts).
//
// Por isso não há mais "URL assinada com prazo": a autorização é o cookie de
// quem está logado. O nome `getSignedUrl` ficou para não mexer nas telas.

const PREFIXO = "/arquivos";

/** Monta o endereço preservando as barras que separam as pastas. */
function montar(bucket: string, path: string): string {
  const partes = path.split("/").map(encodeURIComponent).join("/");
  return `${PREFIXO}/${bucket}/${partes}`;
}

/**
 * Endereço para exibir ou baixar um arquivo.
 * O terceiro parâmetro existia para o prazo da URL assinada e não é mais usado.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  _expiresIn = 600,
): Promise<string | null> {
  if (!path) return null;
  return montar(bucket, path);
}

/** Endereço que força o "salvar como" com o nome original do arquivo. */
export function getDownloadUrl(bucket: string, path: string, nomeOriginal?: string): string {
  const base = `${montar(bucket, path)}?download=1`;
  return nomeOriginal ? `${base}&nome=${encodeURIComponent(nomeOriginal)}` : base;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  _upsert = false,
): Promise<{ error: { message: string } | null }> {
  try {
    const resposta = await fetch(montar(bucket, path), {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
    });
    if (!resposta.ok) {
      return { error: { message: (await resposta.text()) || "Falha ao enviar o arquivo." } };
    }
    return { error: null };
  } catch {
    return { error: { message: "Sem conexão com o servidor. O arquivo não foi enviado." } };
  }
}

export async function removeFile(
  bucket: string,
  path: string,
): Promise<{ error: { message: string } | null }> {
  try {
    const resposta = await fetch(montar(bucket, path), { method: "DELETE" });
    if (!resposta.ok) {
      return { error: { message: (await resposta.text()) || "Falha ao apagar o arquivo." } };
    }
    return { error: null };
  } catch {
    return { error: { message: "Sem conexão com o servidor. O arquivo não foi apagado." } };
  }
}
