# Estado do projeto — Acervo do Corretor

> Documento de continuidade. Atualizado em **2026-07-20**.
> Objetivo: retomar o trabalho sem retrabalho.

## ✅ Onde chegamos

O app está **no ar**, publicado no **Cloudflare Workers**, com **CI/CD automático**:
todo envio (push) para a branch `main` no GitHub republica o site sozinho.

- **Repositório:** https://github.com/repos-mendes/acervodocorretor
- **Hospedagem:** Cloudflare Workers (nome do Worker: `acervo-do-corretor`)
- **Link público:** `https://acervo-do-corretor.<subdomínio>.workers.dev`
  _(preencher com a URL exata que apareceu no Cloudflare)_
- **CI/CD:** GitHub Actions — arquivo `.github/workflows/deploy.yml`.
  Segredos já configurados no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.

## ⚙️ Como o app funciona hoje

- **Backend = mock local** (`src/lib/localdb`, localStorage/IndexedDB).
  Cada aparelho vê os **próprios dados** (partindo do mesmo exemplo pré-carregado);
  nada é compartilhado entre pessoas. Login usa usuários de demonstração.
- **Serve para:** mostrar a interface e testar em qualquer lugar/celular.
- **NÃO serve para:** dados reais/sigilosos (ainda não há banco de verdade).

## 🧩 O que já está pronto para a próxima fase (Supabase)

O código do Supabase **já está no projeto, porém desativado**:
- `src/integrations/supabase/*` — cliente e middleware de autenticação.
- `supabase/migrations/*` — as 3 migrations com o **schema completo** do banco
  (tabelas, tipos, regras de acesso/RLS).
- Dependência `@supabase/supabase-js` já instalada.

## 🚧 Próximos passos (para amanhã)

Objetivo: trocar o mock por um **banco Supabase de verdade**.

1. **Criar o projeto no Supabase** (supabase.com) e pegar 3 chaves em
   Project Settings > API: URL, publishable/anon key e service_role key.
2. **Aplicar as migrations** que já estão em `supabase/migrations/` no projeto novo.
3. **Ativar o Supabase no código** (trabalho de programação):
   - **20 arquivos** ainda importam o mock (`@/lib/localdb/client`) — repontar para
     o cliente Supabase. Como o mock foi feito imitando o Supabase, é mais
     repontar do que reescrever.
   - Migrar o armazenamento de arquivos (`src/lib/storage.ts`) para o Supabase Storage.
4. **Adicionar as variáveis no CI/CD** (`.github/workflows/deploy.yml`) e como
   secrets no GitHub / no Worker do Cloudflare:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas, no build)
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (runtime do servidor)
   - `SUPABASE_SERVICE_ROLE_KEY` (🔒 **segredo**, só no Worker, nunca no navegador)
5. **Testar** login/dados/upload reais e publicar.

### Decisão ainda em aberto
Backend real via **Supabase** (código já existe → caminho curto) vs **tudo
Cloudflare** (D1 + R2 + auth, do zero). Hoje o plano segue com Supabase.

## 📌 Notas técnicas úteis

- Build do Cloudflare: `npm run build:cloudflare` (usa `cross-env`, funciona em
  Windows e Linux). Saída em `.output/` (server + public).
- Config de deploy: `wrangler.jsonc` (aponta `main` e o binding de `assets`).
- O projeto está **limpo de qualquer menção ao Lovable**.
- `.env` e `.claude/` estão no `.gitignore` (nunca vão para o GitHub).
- Observação do ambiente local: a máquina Windows atual bloqueia alguns
  comandos por política de grupo (ex.: `npm run` direto). O build no CI (Linux)
  não é afetado.
