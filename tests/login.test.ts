// TESTE DA ENTRADA NA PLATAFORMA — PIN de 4 dígitos e bloqueio por tentativas.
//
// O bloqueio é o que sustenta a segurança do PIN curto: sem ele, um programa
// varre as 10.000 combinações em segundos. Este teste confere que ele fecha
// quando deve, abre quando deve, e não pune quem não errou.
//
// Rodar:  npm run test

import {
  BLOQUEIO_MINUTOS,
  MAX_TENTATIVAS,
  criarPrimeiroAdmin,
  entrarComPin,
  entrarComSenha,
  existeAdmin,
  minutosDeBloqueio,
} from "@/lib/db/login";
import { hashSenha, conferirSenha } from "@/lib/db/password";
import { checa, criarBanco, encerrar, titulo } from "./apoio";

const { sqlite, DB } = criarBanco(process.argv[2]);

const IP = "200.100.50.1";
const OUTRO_IP = "200.100.50.2";

sqlite.exec(`
  INSERT INTO profiles (id, full_name, phone, pin, status) VALUES
    ('u-ana',   'Ana Corretora',   '77991110001', '0001', 'ativo'),
    ('u-bruno', 'Bruno Corretor',  '77991110002', '0002', 'ativo'),
    ('u-carla', 'Carla Desligada', '77991110003', '0003', 'inativo');
  INSERT INTO user_roles (id, user_id, role) VALUES
    ('r-ana','u-ana','corretor'), ('r-bruno','u-bruno','corretor'), ('r-carla','u-carla','corretor');
`);

/** Empurra o fim do bloqueio para o passado, simulando a passagem do tempo. */
function passarOTempo(ip: string) {
  sqlite
    .prepare("UPDATE login_attempts SET locked_until = ? WHERE ip = ?")
    .run(new Date(Date.now() - 60_000).toISOString(), ip);
}
const limpar = () => sqlite.exec("DELETE FROM login_attempts");

titulo("entrada normal");
const ok = await entrarComPin(DB, "0001", IP);
checa("PIN correto entra", ok.ok === true);
checa(
  "identifica a pessoa certa",
  ok.ok && ok.session.userId === "u-ana",
  ok.ok ? ok.session.userId : "",
);
checa("papel de corretor", ok.ok && ok.session.role === "corretor");
checa(
  "registra o ultimo acesso",
  (
    sqlite.prepare("SELECT last_access_at FROM profiles WHERE id='u-ana'").get() as Record<
      string,
      string
    >
  ).last_access_at != null,
);

titulo("PIN mal formado");
limpar();
for (const ruim of ["", "12", "12345", "abcd", "12a4", "0001 "]) {
  const r = await entrarComPin(DB, ruim, OUTRO_IP);
  checa(`recusa "${ruim}"`, r.ok === false);
  limpar();
}

titulo(`bloqueio depois de ${MAX_TENTATIVAS} erros`);
limpar();
for (let i = 1; i < MAX_TENTATIVAS; i++) {
  const r = await entrarComPin(DB, "9999", IP);
  checa(`erro ${i} apenas recusado`, r.ok === false && r.motivo === "invalido");
}
// O erro que estoura o limite já avisa do bloqueio, em vez de dizer só
// "PIN incorreto" e deixar a pessoa descobrir na tentativa seguinte.
const ultima = await entrarComPin(DB, "9999", IP);
checa(
  `erro ${MAX_TENTATIVAS} ja avisa do bloqueio`,
  !ultima.ok && ultima.motivo === "bloqueado",
  !ultima.ok ? `${ultima.motivo} (${ultima.minutos} min)` : "",
);
checa(
  "informa os minutos restantes",
  !ultima.ok && typeof ultima.minutos === "number" && ultima.minutos! <= BLOQUEIO_MINUTOS,
  !ultima.ok ? String(ultima.minutos) : "",
);
const quarta = await entrarComPin(DB, "9999", IP);
checa("tentativa seguinte continua bloqueada", !quarta.ok && quarta.motivo === "bloqueado");

titulo("o bloqueio vale ate para quem sabe o PIN certo");
const certoBloqueado = await entrarComPin(DB, "0001", IP);
checa(
  "PIN correto tambem e barrado durante o bloqueio",
  !certoBloqueado.ok && certoBloqueado.motivo === "bloqueado",
);

titulo("o bloqueio e por origem, nao global");
const outraOrigem = await entrarComPin(DB, "0001", OUTRO_IP);
checa("outra origem entra normalmente", outraOrigem.ok === true);

titulo("o bloqueio termina sozinho");
passarOTempo(IP);
checa("nao ha mais bloqueio registrado", (await minutosDeBloqueio(DB, IP)) === null);
const depois = await entrarComPin(DB, "0001", IP);
checa("entra de novo apos o prazo", depois.ok === true);

titulo("acerto zera o contador");
limpar();
await entrarComPin(DB, "9999", IP);
await entrarComPin(DB, "9999", IP);
await entrarComPin(DB, "0001", IP); // acertou
const depoisDoAcerto = sqlite
  .prepare("SELECT count(*) AS t FROM login_attempts WHERE ip = ?")
  .get(IP) as Record<string, number>;
checa("tentativas anteriores foram apagadas", depoisDoAcerto.t === 0);
const erroAposAcerto = await entrarComPin(DB, "9999", IP);
checa(
  "um erro depois do acerto nao bloqueia",
  !erroAposAcerto.ok && erroAposAcerto.motivo === "invalido",
);

titulo("acesso desativado");
limpar();
const inativa = await entrarComPin(DB, "0003", IP);
checa("corretor inativo nao entra", !inativa.ok && inativa.motivo === "inativo");
const naoContou = sqlite
  .prepare("SELECT count(*) AS t FROM login_attempts WHERE ip = ?")
  .get(IP) as Record<string, number>;
checa("e nao gasta tentativa (o PIN dela esta certo)", naoContou.t === 0);

titulo("senha do administrador");
limpar();
checa("ainda nao existe admin", (await existeAdmin(DB)) === false);
const curta = await criarPrimeiroAdmin(DB, { nome: "Lucas", email: "lucas@vca.com", senha: "123" });
checa("recusa senha curta", curta.ok === false);
const semArroba = await criarPrimeiroAdmin(DB, {
  nome: "Lucas",
  email: "lucas",
  senha: "senha-bem-longa",
});
checa("recusa e-mail invalido", semArroba.ok === false);
const criado = await criarPrimeiroAdmin(DB, {
  nome: "Lucas",
  email: "lucas@vca.com",
  senha: "senha-bem-longa",
});
checa("cria o primeiro admin", criado.ok === true);
checa("agora existe admin", (await existeAdmin(DB)) === true);

const segundo = await criarPrimeiroAdmin(DB, {
  nome: "Invasor",
  email: "x@y.com",
  senha: "outra-senha-longa",
});
checa(
  "a porta de configuracao se fecha depois do primeiro",
  segundo.ok === false,
  segundo.ok ? "" : segundo.erro,
);

titulo("entrada do administrador");
limpar();
const admOk = await entrarComSenha(DB, "lucas@vca.com", "senha-bem-longa", IP);
checa("entra com a senha certa", admOk.ok === true);
checa("papel de admin", admOk.ok && admOk.session.role === "admin");
const admMaiuscula = await entrarComSenha(DB, "LUCAS@VCA.COM", "senha-bem-longa", IP);
checa("e-mail nao diferencia maiuscula", admMaiuscula.ok === true);
const admErro = await entrarComSenha(DB, "lucas@vca.com", "chute", IP);
checa("senha errada recusada", admErro.ok === false);
const inexistente = await entrarComSenha(DB, "ninguem@vca.com", "chute", IP);
checa("e-mail inexistente recusado", inexistente.ok === false);
const admBloqueado = await entrarComSenha(DB, "lucas@vca.com", "chute", IP);
checa(
  `senha tambem bloqueia apos ${MAX_TENTATIVAS} erros`,
  !admBloqueado.ok && admBloqueado.motivo === "bloqueado",
);

titulo("a senha nunca fica no banco em texto");
const guardado = (
  sqlite.prepare("SELECT password_hash FROM profiles WHERE email='lucas@vca.com'").get() as Record<
    string,
    string
  >
).password_hash;
checa("nao contem a senha digitada", !guardado.includes("senha-bem-longa"));
checa("usa PBKDF2 com sal", guardado.startsWith("pbkdf2$210000$"), guardado.slice(0, 24) + "...");
checa("confere a senha certa", await conferirSenha("senha-bem-longa", guardado));
checa("recusa a senha errada", !(await conferirSenha("senha-bem-long", guardado)));
const outroHash = await hashSenha("senha-bem-longa");
checa("mesma senha gera resumos diferentes (sal aleatorio)", outroHash !== guardado);

titulo("PIN de admin nao existe");
limpar();
const adminPorPin = await entrarComPin(DB, "0000", IP);
checa("admin nao entra por PIN (nao tem PIN cadastrado)", adminPorPin.ok === false);

encerrar();
