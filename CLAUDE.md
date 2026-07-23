# Acervo do Corretor

Plataforma interna para corretores acessarem materiais comerciais dos empreendimentos da construtora. Interface em pt-BR com dois perfis: **Corretor** e **Administrador**.

**Stack:** TanStack Start (React 19 + Vite) · Tailwind v4 · shadcn/ui · deploy em Cloudflare Workers.

---

## Estado atual (atualizado em 2026-07-23)

O app está **no ar**, publicado no **Cloudflare Workers**, com **CI/CD automático**:
todo envio (push) para a branch `main` no GitHub republica o site sozinho.

- **Repositório:** https://github.com/repos-mendes/acervodocorretor
- **Hospedagem:** Cloudflare Workers (nome do Worker: `acervo-do-corretor`)
- **Link público:** `https://acervo-do-corretor.<subdomínio>.workers.dev`
  _(preencher com a URL exata que apareceu no Cloudflare)_
- **CI/CD:** GitHub Actions — arquivo `.github/workflows/deploy.yml`.
  Segredos já configurados no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.

**Backend hoje = mock 100% local.** Não há banco de verdade ainda: cada aparelho
vê os **próprios dados** (partindo do mesmo exemplo pré-carregado) e nada é
compartilhado entre pessoas. Serve para mostrar a interface e testar em qualquer
lugar/celular; **não** serve para dados reais ou sigilosos.

---

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

### Contas de teste (modo local)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@acervo.local` | `admin123` |
| Corretor | `corretor@acervo.local` | `corretor123` |

---

## Como os dados funcionam (modo local, sem backend)

Para testar o front-end sem depender de serviços externos, **todos os dados vivem no navegador**:

- **Tabelas** (usuários, empreendimentos, arquivos, comunicados, etc.): `localStorage`, chave `acervo.localdb.v1`. Na primeira execução um seed cria as contas de teste, 3 empreendimentos e materiais de demonstração.
- **Sessão de login:** `localStorage`, chave `acervo.session.v1`.
- **Arquivos enviados** (capas, galerias, materiais, avatares): `IndexedDB` (banco `acervo-blobs`), porque o `localStorage` tem limite de ~5MB.

Implementação em `src/lib/localdb/`:

| Arquivo | Papel |
|---|---|
| `client.ts` | Cliente `db` com a interface de consulta usada pelas telas (`from().select().eq()…`, `auth.*`, `rpc()`), storage local e eventos de sessão |
| `seed.ts` | Dados de demonstração |
| `types.ts` | Modelo de dados (tipos das tabelas e enums) |
| `blobs.ts` | Armazenamento de arquivos em IndexedDB |

**Resetar os dados:** no console do navegador, `localStorage.clear()` + apagar o IndexedDB `acervo-blobs` (DevTools → Application), ou chame `resetLocalDb()` exportado de `src/lib/localdb/client.ts`. Ao recarregar, o seed é recriado.

> Atenção: neste modo as senhas ficam em texto plano no navegador. É um modo de demonstração.

---

## Deploy no Cloudflare Workers

O build já está configurado (Nitro preset `cloudflare-module` + `wrangler.jsonc`):

```bash
npx wrangler login         # primeira vez
npm run deploy             # build + wrangler deploy
```

Para testar o build do Worker localmente: `npm run build:cloudflare && npx wrangler dev`.

Enquanto o app estiver no modo local, o deploy funciona normalmente — cada visitante terá seu próprio "banco" no navegador (útil para demonstrações).

### Notas técnicas úteis

- Build do Cloudflare: `npm run build:cloudflare` (usa `cross-env`, funciona em Windows e Linux). Saída em `.output/` (server + public).
- Config de deploy: `wrangler.jsonc` (aponta `main` e o binding de `assets`).
- `.env` e `.claude/` estão no `.gitignore` (nunca vão para o GitHub).
- Observação do ambiente local: a máquina Windows atual bloqueia alguns comandos por política de grupo (ex.: `npm run` direto). O build no CI (Linux) não é afetado. Se esbarrar nesse bloqueio ao rodar localmente, é preciso liberar com a TI ou usar um contorno.

### Gerenciador de pacotes: npm (padronizado)

O projeto usa **npm** em todos os lugares (local e CI). O único lockfile é
`package-lock.json`, e o CI (`.github/workflows/deploy.yml`) depende dele via
`npm ci`. **Não** adicionar `bun.lock`, `bunfig.toml` ou `yarn.lock` — misturar
gerenciadores faz os locks desencontrarem (versões diferentes no PC e no servidor).

> ⚠️ **Nota para o Claude (assistente):** se em algum momento o projeto mudar de
> forma que o **bun** passe a ser tecnicamente melhor para este caso (ex.: tempo
> de build/instalação virar gargalo real, ou surgir necessidade da proteção de
> supply-chain `minimumReleaseAge` que o bun tem e o npm não), **avise o Lucas** —
> ele quer ser consultado antes de qualquer migração para bun. O bun é mais rápido
> na instalação, mas hoje a **consistência** (um só gerenciador) foi escolhida por
> ser mais segura e simples. Trocar exige alinhar CI + docs + lockfile juntos.

---

## Próxima fase: backend real com Supabase

O código do Supabase **já está no projeto, porém desativado** (por isso esses
arquivos não devem ser apagados, mesmo sem uso hoje):

- `src/integrations/supabase/*` — cliente e middleware de autenticação.
- `supabase/migrations/*` — as 3 migrations com o **schema completo** do banco (tabelas, tipos, regras de acesso/RLS).
- Dependência `@supabase/supabase-js` já instalada.

O acesso a dados está concentrado em `src/lib/localdb/client.ts` e o de arquivos
em `src/lib/storage.ts` — as telas não conhecem o backend. Como o mock foi feito
imitando o Supabase, a migração é mais **repontar** do que reescrever.

### Passos para ativar o Supabase

1. **Criar o projeto no Supabase** (supabase.com) e pegar 3 chaves em Project Settings > API: URL, publishable/anon key e service_role key.
2. **Aplicar as migrations** que já estão em `supabase/migrations/` no projeto novo.
3. **Ativar o Supabase no código** (trabalho de programação):
   - **20 arquivos** ainda importam o mock (`@/lib/localdb/client`) — repontar para o cliente Supabase.
   - Migrar o armazenamento de arquivos (`src/lib/storage.ts`) para o Supabase Storage.
4. **Adicionar as variáveis no CI/CD** (`.github/workflows/deploy.yml`) e como secrets no GitHub / no Worker do Cloudflare:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas, no build)
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (runtime do servidor)
   - `SUPABASE_SERVICE_ROLE_KEY` (🔒 **segredo**, só no Worker, nunca no navegador)
5. **Testar** login/dados/upload reais e publicar.

### Decisão ainda em aberto

Backend real via **Supabase** (código já existe → caminho curto) vs **tudo
Cloudflare** (D1 + R2 + auth, do zero). Hoje o plano segue com Supabase.
