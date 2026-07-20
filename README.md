# Acervo do Corretor

Plataforma interna para corretores acessarem materiais comerciais dos empreendimentos da construtora. Interface em pt-BR com dois perfis: **Corretor** e **Administrador**.

**Stack:** TanStack Start (React 19 + Vite) · Tailwind v4 · shadcn/ui · deploy em Cloudflare Workers.

## Rodando localmente

```bash
bun install
bun run dev        # http://localhost:3000
```

### Contas de teste (modo local)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@acervo.local` | `admin123` |
| Corretor | `corretor@acervo.local` | `corretor123` |

## Modo de dados atual: 100% local (sem backend)

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

> Atenção: neste modo as senhas ficam em texto plano no navegador. É um modo de demonstração — a autenticação real virá do Clerk.

## Deploy no Cloudflare Workers

O build já está configurado (Nitro preset `cloudflare-module` + `wrangler.jsonc`):

```bash
bunx wrangler login        # primeira vez
bun run deploy             # build + wrangler deploy
```

Para testar o build do Worker localmente: `bun run build:cloudflare && bunx wrangler dev`.

Enquanto o app estiver no modo local, o deploy funciona normalmente — cada visitante terá seu próprio "banco" no navegador (útil para demonstrações).

## Próxima fase: autenticação com Clerk + dados no Cloudflare

O acesso a dados está concentrado em `src/lib/localdb/client.ts` e o de arquivos em `src/lib/storage.ts` — as telas não conhecem o backend. A migração planejada:

1. **Auth (Clerk)**
   - `bun add @clerk/tanstack-react-start`
   - Preencher `VITE_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` no `.env` (e como secrets no Worker: `wrangler secret put CLERK_SECRET_KEY`).
   - Envolver a aplicação com `<ClerkProvider>` em `src/routes/__root.tsx` e reimplementar `db.auth.*` delegando ao Clerk (login/logout/sessão). As telas de login (`/auth`, `/reset-password`) passam a usar os componentes do Clerk.
   - Papéis (admin/corretor) podem morar no `publicMetadata` do usuário Clerk ou continuar na tabela `user_roles`.
2. **Banco (Cloudflare D1)**
   - Criar o schema a partir de `src/lib/localdb/types.ts` (as tabelas e enums estão todas lá).
   - Substituir a implementação do query builder em `client.ts` por chamadas a server functions do TanStack Start que consultam o D1 (binding no `wrangler.jsonc`).
3. **Arquivos (Cloudflare R2)**
   - Trocar a implementação de `src/lib/storage.ts` por upload/URLs assinadas do R2 (binding no `wrangler.jsonc`).
