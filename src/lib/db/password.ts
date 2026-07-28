// Senha do administrador: transformação em "resumo" (hash) e conferência.
//
// Diferente do PIN do corretor — que é um pedaço do telefone e fica em texto —,
// a senha do admin é um segredo de verdade e nunca é guardada como foi
// digitada. Guardamos o resultado de um cálculo que não tem volta, junto com um
// "sal" aleatório (para que duas pessoas com a mesma senha tenham resumos
// diferentes) e a contagem de repetições (para deixar o cálculo lento de
// propósito, o que atrapalha quem tenta adivinhar em massa).
//
// PBKDF2 é usado por ser o único algoritmo desse tipo disponível no WebCrypto
// dos Workers da Cloudflare (não há bcrypt/argon2 sem instalar biblioteca).

/**
 * Repetições do cálculo. Quanto mais, mais lento fica adivinhar a senha.
 *
 * O runtime da Cloudflare (workerd) **recusa mais de 100.000** — pedir 210.000,
 * como estava aqui antes, fazia o cadastro do administrador falhar em produção
 * com "iteration counts above 100000 are not supported". Este é o teto, então
 * é o valor usado.
 *
 * Fica abaixo do que o OWASP recomenda hoje para PBKDF2-SHA256. O que compensa
 * a diferença neste caso: a senha do admin tem no mínimo 10 caracteres, é de
 * uma pessoa só, e as tentativas de login são bloqueadas após 3 erros
 * (src/lib/db/login.ts) — o ataque prático seria ter o banco em mãos, não
 * chutar pela tela.
 */
export const ITERACOES = 100_000;
/** Limite do workerd. Existe para o teste travar se alguém aumentar ITERACOES. */
export const MAX_ITERACOES_CLOUDFLARE = 100_000;
const TAMANHO_SAL = 16;
const TAMANHO_CHAVE = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal as BufferSource, iterations: iteracoes, hash: "SHA-256" },
    chave,
    TAMANHO_CHAVE * 8,
  );
  return new Uint8Array(bits);
}

/** Gera o texto que vai para a coluna `password_hash`. */
export async function hashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(TAMANHO_SAL));
  const resumo = await derivar(senha, sal, ITERACOES);
  return `pbkdf2$${ITERACOES}$${toBase64(sal)}$${toBase64(resumo)}`;
}

/** Comparação em tempo constante: não vaza, pelo tempo, o quanto acertou. */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function conferirSenha(senha: string, guardado: string | null): Promise<boolean> {
  if (!guardado) return false;
  const [algoritmo, iteracoes, sal, resumo] = guardado.split("$");
  if (algoritmo !== "pbkdf2" || !iteracoes || !sal || !resumo) return false;
  try {
    const calculado = await derivar(senha, fromBase64(sal), Number(iteracoes));
    return iguais(calculado, fromBase64(resumo));
  } catch {
    return false;
  }
}
