# Acervo do Corretor

Plataforma interna para corretores acessarem materiais comerciais dos empreendimentos da construtora. Interface em pt-BR com dois perfis: **Corretor** e **Administrador**.

**Stack:** TanStack Start (React 19 + Vite) · Tailwind v4 · shadcn/ui · **tudo na Cloudflare**: Workers (site) + D1 (banco) + R2 (arquivos).

---

## Estado atual (atualizado em 2026-07-28)

O app está **no ar** no Cloudflare Workers, com **CI/CD automático**: todo envio
(push) para a branch `main` no GitHub roda os testes, atualiza o banco e
republica o site sozinho.

- **Repositório:** https://github.com/repos-mendes/acervodocorretor
- **Hospedagem:** Cloudflare Workers (Worker `acervo-do-corretor`)
- **Link público:** https://acervo-do-corretor.leadrouter.workers.dev
- **CI/CD:** GitHub Actions — `.github/workflows/deploy.yml`.
  Segredos no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.

### Infraestrutura (provisionada em 28/07)

| Recurso | Nome | Observação |
|---|---|---|
| Banco | D1 `acervo` | id no `wrangler.jsonc`; migrations aplicadas |
| Arquivos | R2 `acervo-arquivos` | privado; o R2 precisou ser habilitado no painel |
| Segredo | `SESSION_SECRET` | no Worker; o `.dev.vars` local tem um **diferente** |

Conferido no ar: as páginas carregam, o portão de arquivos devolve 401 sem
login, e caminhos maliciosos são recusados com 400.

### O que ainda falta

1. **Criar o administrador**: abrir o site — a tela de login mostra "Primeiro
   acesso" enquanto não existir nenhum admin. (Ainda não feito: o banco tem 0
   pessoas.)
2. **Cadastrar os corretores** (nome, telefone, PIN) pelo painel.
3. **Subir capas, galerias e materiais** — SQL não sobe arquivo.
4. Completar dos 7 empreendimentos: situação comercial (todos entraram como
   "lançamento"), endereço, descrição longa e galeria.

---

## Rodando localmente

```bash
npm install
npm run dev:cloudflare    # http://localhost:8787
```

**Use `dev:cloudflare`, não `dev`.** O `npm run dev` (vite puro) não enxerga o
banco nem os arquivos — eles só existem dentro da Cloudflare. O
`dev:cloudflare` monta o site e sobe o `wrangler dev`, que **simula D1 e R2 na
sua máquina**, offline e sem custo, com dados separados dos de produção.

Para criar o banco local na primeira vez:

```bash
npx wrangler d1 migrations apply acervo --local
```

### 🚧 Problema conhecido na máquina do Lucas (28/07)

O `wrangler dev` **não sobe** neste Windows: o runtime da Cloudflare (workerd)
morre com "access violation" antes de abrir a porta. A própria mensagem aponta a
causa provável — **Microsoft Visual C++ Redistributable desatualizado**:
https://learn.microsoft.com/pt-br/cpp/windows/latest-supported-vc-redist

O que **funciona** nessa máquina: `npm install`, `npm run test`,
`npm run build:cloudflare` e o `npx wrangler` para comandos que não sobem
servidor (`d1 create`, `d1 migrations apply --remote`, `r2 bucket create`,
`secret put`). O CI no GitHub (Linux) não é afetado por nada disso.

**Enquanto não resolver:** testar publicando (o push na `main` republica em ~2
min) ou pedir à TI a atualização do redistributable.

> Nota histórica: o `CLAUDE.md` antigo dizia que "a política de grupo bloqueia
> `npm run`". Isso era impreciso — o que a política bloqueava era o executável
> `cross-env`, usado só para definir uma variável de ambiente no build. Ele foi
> **removido** em 28/07 (o preset agora está no `vite.config.ts`), então os
> comandos do projeto rodam normalmente. Esse bloqueio e o do workerd são
> problemas diferentes.

---

## Como entrar na plataforma

**Não existe sistema de autenticação, e isso é uma decisão, não uma pendência.**

| Perfil | Como entra |
|---|---|
| **Corretor** | PIN de 4 números. O padrão são os 4 últimos dígitos do telefone, mas o admin pode escolher outro no cadastro. |
| **Administrador** | E-mail e senha, pelo link "Sou administrador" na tela de login. |

- **Bloqueio após 3 erros**, por 15 minutos, contado **por endereço de origem**
  (o PIN vem sem nome de usuário, então não há como contar por pessoa). É o que
  impede um programa de varrer as 10.000 combinações. Constantes em
  `src/lib/db/login.ts`.
- O PIN fica **em texto** no banco de propósito: é um pedaço do telefone que o
  admin já conhece, e guardá-lo cifrado só impediria o admin de reenviá-lo a
  quem esqueceu. Quem protege o acesso é o bloqueio acima.
- A **senha do admin é diferente**: vai cifrada (PBKDF2) e nunca sai do
  servidor. **Não há recuperação por e-mail** — se perder, só mexendo no banco.

---

## Como os dados funcionam

### Banco: Cloudflare D1 (SQLite)

O schema vive em `migrations/`, aplicado com `wrangler d1 migrations apply`:

| Arquivo | Conteúdo |
|---|---|
| `0001_init.sql` | As 9 tabelas, com as regras do banco (PIN único, papéis válidos, etc.) |
| `0002_seed.sql` | As 5 categorias de arquivo, os 7 empreendimentos e os 12 scripts |

Diferenças do Postgres que valem lembrar ao escrever SQL aqui: **sem ENUM**
(virou `TEXT` + `CHECK`), **sem array** (JSON em `TEXT`), **sem booleano**
(0/1). A conversão para o que as telas esperam acontece em
`src/lib/db/schema.ts`.

### Arquivos: Cloudflare R2

Bucket **privado**: nenhum arquivo tem endereço público. Tudo passa por
`/arquivos/<pasta>/<caminho>`, atendido por `src/lib/db/arquivos.ts`, que
confere a sessão antes de entregar. As pastas são `covers`, `galleries`,
`materials` e `avatars`.

Foi o R2 que resolveu o problema de custo: **download não é cobrado**, e o
piloto (10 corretores, ~800 MB) cabe folgado na camada gratuita de 10 GB.

### Como as telas falam com o banco

```
tela  →  src/lib/db/client.ts   (db.from("x").select("*").eq(...))
      →  src/lib/db/server.ts   (ponte com o framework)
      →  src/lib/db/query.ts    (monta o SQL, aplica as regras)
      →  D1
```

A interface `db.from(...)` foi mantida da versão anterior de propósito, para que
a migração não exigisse reescrever as 19 telas.

| Arquivo | Papel |
|---|---|
| `access.ts` | **Quem pode ver e escrever o quê.** Leia antes de mexer |
| `query.ts` | Motor: pedido → SQL. Não depende do framework (por isso é testável) |
| `server.ts` / `auth.ts` | Ponte com o TanStack Start (sessão, requisição, erros) |
| `client.ts` | O que as telas importam |
| `login.ts` / `password.ts` | Conferência de PIN e senha, bloqueio por tentativas |
| `session.ts` | O "crachá" assinado de quem está logado (cookie) |
| `arquivos.ts` | O portão do R2 |
| `schema.ts` | Lista de tabelas/colunas + conversões |
| `bindings.ts` | Acesso ao D1 e ao R2 |

---

## ⚠️ Segurança: leia antes de mexer em `access.ts`

No Supabase as regras de quem-vê-o-quê moravam **dentro do banco** (RLS): mesmo
um erro no app não deixava um corretor ver o que não devia. **O D1 não tem esse
recurso.** As regras passaram a ser código nosso, em `src/lib/db/access.ts`.
Afrouxar uma linha ali afrouxa o app inteiro.

Por isso existe `tests/acesso.test.ts`, que roda o motor real contra um SQLite
real e confere cada porta. **Se você mudar `access.ts` e um teste falhar, o
teste provavelmente está certo.**

---

## Testes

```bash
npm run test
```

Quatro suítes, ~119 verificações, sem precisar de servidor nem de internet
(usam `node:sqlite` e um R2 de mentira):

| Suíte | O que garante |
|---|---|
| `tests/schema.test.ts` | As migrations aplicam, o seed não duplica, as regras do banco pegam |
| `tests/acesso.test.ts` | O corretor não vê rascunho, não lê o colega, não escreve o que não deve |
| `tests/login.test.ts` | PIN, bloqueio em 3 erros, senha do admin cifrada |
| `tests/arquivos.test.ts` | O portão do R2: sessão, permissões, caminhos maliciosos |

O CI roda tudo antes de publicar: teste vermelho não vira deploy.

**O que os testes NÃO cobrem:** o app rodando de verdade. Eles usam bancos de
mentira, então a primeira execução real ainda pode esbarrar em coisas como o
cookie de sessão viajando ou o upload de um PDF grande. Clique no app inteiro
antes de confiar — e veja o problema conhecido do `wrangler dev` acima.

O que **já foi conferido de verdade** (28/07): o build para a Cloudflare passa, e
os bindings `DB` (D1) e `FILES` (R2) chegam na configuração que o Nitro gera em
`.output/server/wrangler.json` — era o principal risco técnico da migração.

---

## Deploy

Automático a cada push na `main`. Manual:

```bash
npx wrangler login    # primeira vez
npm run deploy
```

O `wrangler.jsonc` aponta o Worker, o banco D1 (`DB`) e o bucket R2 (`FILES`).
O `database_id` é público — pode ficar no GitHub. O `SESSION_SECRET`, não.

### Gerenciador de pacotes: npm (padronizado)

O projeto usa **npm** em todos os lugares (local e CI). O único lockfile é
`package-lock.json`, e o CI depende dele via `npm ci`. **Não** adicionar
`bun.lock`, `bunfig.toml` ou `yarn.lock` — misturar gerenciadores faz os locks
desencontrarem (versões diferentes no PC e no servidor).

> ⚠️ **Nota para o Claude (assistente):** se em algum momento o **bun** passar a
> ser tecnicamente melhor para este caso (ex.: tempo de build/instalação virar
> gargalo real, ou surgir necessidade da proteção de supply-chain
> `minimumReleaseAge`), **avise o Lucas** — ele quer ser consultado antes de
> qualquer migração. Trocar exige alinhar CI + docs + lockfile juntos.

---

## Histórico das decisões de backend

Vale registrar para ninguém reabrir discussão encerrada:

- **Supabase (27/07)** — escolhido porque o código de autenticação dele já
  estava pronto no projeto.
- **Revertido (28/07)** — o Lucas definiu que o login seria um **PIN de 4
  dígitos, sem sistema de autenticação**. Isso derrubou o único motivo do
  Supabase: sem o login dele, o RLS não servia e o PIN teria que ser escrito de
  qualquer forma. Ficariam dois fornecedores e a cota de 5 GB de download/mês.
- **Cloudflare D1 + R2 (28/07, atual)** — uma conta só, custo zero, download
  ilimitado. Todo o código do Supabase foi removido nesta data.
- **Google Drive** — descartado antes disso. Vídeo como link externo continua
  **adiado**: não implementar sem pedido.
