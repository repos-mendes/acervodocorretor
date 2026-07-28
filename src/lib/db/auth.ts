// Funções de entrada e saída da plataforma, chamadas pelas telas.
//
// Assim como em server.ts, aqui só mora o que depende da requisição (o cookie e
// o endereço de origem). As regras estão em login.ts, que é testado à parte.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getDb } from "./bindings";
import {
  criarPrimeiroAdmin,
  entrarComPin,
  entrarComSenha,
  existeAdmin,
  type ResultadoLogin,
} from "./login";
import { endSession, readSession, startSession, type AppRole } from "./session";

/** Resposta enxuta para as telas — nunca devolve dados de outras pessoas. */
export type RespostaLogin =
  { ok: true } | { ok: false; mensagem: string; bloqueado?: boolean; inativo?: boolean };

/**
 * Endereço de quem está chamando, usado para contar tentativas de login.
 * Na Cloudflare vem sempre no cabeçalho `cf-connecting-ip` — é preenchido pela
 * própria rede e não dá para o navegador forjar.
 */
function origem(): string {
  return getRequest().headers.get("cf-connecting-ip") ?? "desconhecida";
}

function traduzir(resultado: Exclude<ResultadoLogin, { ok: true }>): RespostaLogin {
  switch (resultado.motivo) {
    case "bloqueado":
      return {
        ok: false,
        bloqueado: true,
        mensagem:
          `Muitas tentativas erradas. Tente de novo em ${resultado.minutos} ` +
          `minuto${resultado.minutos === 1 ? "" : "s"}.`,
      };
    case "inativo":
      return {
        ok: false,
        inativo: true,
        mensagem: "Seu acesso está inativo. Fale com o administrador.",
      };
    default:
      return { ok: false, mensagem: "PIN incorreto." };
  }
}

export const entrarComPinFn = createServerFn({ method: "POST" })
  .validator((data: { pin: string }) => data)
  .handler(async ({ data }): Promise<RespostaLogin> => {
    const resultado = await entrarComPin(getDb(), data.pin ?? "", origem());
    if (!resultado.ok) return traduzir(resultado);
    await startSession(resultado.session);
    return { ok: true };
  });

export const entrarComSenhaFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; senha: string }) => data)
  .handler(async ({ data }): Promise<RespostaLogin> => {
    const resultado = await entrarComSenha(getDb(), data.email ?? "", data.senha ?? "", origem());
    if (!resultado.ok) {
      const resposta = traduzir(resultado);
      // Na tela de admin a mensagem certa fala de e-mail e senha, não de PIN.
      if (!resposta.ok && !resposta.bloqueado && !resposta.inativo) {
        return { ok: false, mensagem: "E-mail ou senha incorretos." };
      }
      return resposta;
    }
    await startSession(resultado.session);
    return { ok: true };
  });

export const sairFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    endSession();
    return { ok: true };
  },
);

export type SessaoAtual = { userId: string; role: AppRole } | null;

export const sessaoAtualFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessaoAtual> => readSession(),
);

/** A plataforma ainda não tem administrador? Então mostra a tela de configuração. */
export const precisaConfigurarFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ precisa: boolean }> => ({ precisa: !(await existeAdmin(getDb())) }),
);

export const criarPrimeiroAdminFn = createServerFn({ method: "POST" })
  .validator((data: { nome: string; email: string; senha: string }) => data)
  .handler(async ({ data }): Promise<RespostaLogin> => {
    const resultado = await criarPrimeiroAdmin(getDb(), data);
    if (!resultado.ok) return { ok: false, mensagem: resultado.erro };
    await startSession(resultado.session);
    return { ok: true };
  });
