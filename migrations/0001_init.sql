-- Schema inicial do Cloudflare D1 (SQLite).
--
-- Substitui as migrations do Supabase (Postgres), que foram descartadas junto
-- com o Supabase em 2026-07-28. Diferenças que valem registrar:
--
--   * Sem RLS. O D1 não tem regras de acesso no banco — quem decide o que cada
--     papel pode ler/escrever é o servidor (Worker), num único lugar.
--   * Sem ENUM: SQLite não tem. Viraram TEXT com CHECK.
--   * Sem UUID nativo: os ids são TEXT (crypto.randomUUID() no app).
--   * Sem array: `highlights` e `gallery_urls` guardam JSON em TEXT.
--   * Sem boolean: 0/1 em INTEGER.
--   * Datas em TEXT no formato ISO 8601 (o mesmo que o app já usava).
--
-- Aplicar:  npx wrangler d1 migrations apply acervo --remote

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------

-- O login é por PIN de 4 dígitos (padrão: 4 últimos dígitos do telefone), então
-- não existe tabela de usuários de autenticação: o perfil é o usuário.
--
-- Sobre `pin` em texto puro: o PIN é, por definição, um pedaço do telefone que
-- o admin já conhece — guardá-lo cifrado não esconderia nada de quem tivesse o
-- banco, e impediria o admin de consultar/reenviar o PIN de um corretor que
-- esqueceu. Quem protege o acesso de verdade é o bloqueio por tentativas
-- (tabela login_attempts). Já a senha de admin é um segredo real e por isso vai
-- cifrada em `password_hash`.
CREATE TABLE IF NOT EXISTS profiles (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL DEFAULT '',
  email          TEXT,
  phone          TEXT,
  creci          TEXT,
  avatar_url     TEXT,
  status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  pin            TEXT CHECK (pin IS NULL OR length(pin) = 4),
  password_hash  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_access_at TEXT
);

-- Dois corretores podem ter os mesmos 4 últimos dígitos de telefone. O índice
-- único impede que isso passe batido: o cadastro falha e o admin escolhe outro
-- PIN. Sem ele, o login não teria como saber quem é quem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_pin ON profiles(pin) WHERE pin IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_roles (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'corretor')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, role)
);

-- Bloqueio de tentativas de login, por endereço de origem (IP).
-- O PIN não vem acompanhado de um nome de usuário, então não há como contar
-- erros "por pessoa": quem tenta adivinhar tenta contra todo mundo de uma vez.
-- Contar por IP é o que efetivamente barra um robô varrendo os 10.000 números.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS developments (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  short_description      TEXT,
  full_description       TEXT,
  commercial_information TEXT,
  commercial_status      TEXT NOT NULL DEFAULT 'lancamento'
                           CHECK (commercial_status IN ('lancamento', 'em_construcao',
                                  'pronto_para_morar', 'ultimas_unidades', 'em_breve', 'indisponivel')),
  publication_status     TEXT NOT NULL DEFAULT 'draft'
                           CHECK (publication_status IN ('published', 'draft', 'archived')),
  development_type       TEXT,
  address                TEXT,
  neighborhood           TEXT,
  city                   TEXT,
  maps_url               TEXT,
  cover_image_url        TEXT,
  logo_url               TEXT,
  gallery_urls           TEXT,  -- JSON: ["caminho1", "caminho2"]
  highlights             TEXT,  -- JSON: ["2 quartos", "45m²"]
  is_featured            INTEGER NOT NULL DEFAULT 0,
  launch_date            TEXT,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_by             TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS file_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Fica NULL de propósito: o app resolve o ícone pelo nome da categoria
  -- (categoryIcon em DevelopmentCard.tsx). A coluna existe só para compatibilidade.
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS development_files (
  id                 TEXT PRIMARY KEY,
  development_id     TEXT REFERENCES developments(id) ON DELETE CASCADE,
  category_id        TEXT REFERENCES file_categories(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  -- Caminho do objeto dentro do bucket R2 (ex.: "materials/<dev>/book.pdf").
  storage_path       TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_size          INTEGER,
  file_extension     TEXT,
  mime_type          TEXT,
  publication_status TEXT NOT NULL DEFAULT 'draft'
                       CHECK (publication_status IN ('published', 'draft', 'archived')),
  is_featured        INTEGER NOT NULL DEFAULT 0,
  download_count     INTEGER NOT NULL DEFAULT 0,
  uploaded_by        TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_files_dev ON development_files(development_id);
CREATE INDEX IF NOT EXISTS idx_files_cat ON development_files(category_id);

-- Scripts rápidos. development_id NULL = script geral.
-- CASCADE: se o empreendimento sai, seus scripts saem junto — um script
-- específico não pode virar "geral" por acidente.
CREATE TABLE IF NOT EXISTS scripts (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  development_id TEXT REFERENCES developments(id) ON DELETE CASCADE,
  category       TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scripts_dev ON scripts(development_id);

-- ---------------------------------------------------------------------------
-- Métricas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS file_downloads (
  id             TEXT PRIMARY KEY,
  file_id        TEXT NOT NULL REFERENCES development_files(id) ON DELETE CASCADE,
  development_id TEXT REFERENCES developments(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  downloaded_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_downloads_at ON file_downloads(downloaded_at);

CREATE TABLE IF NOT EXISTS development_views (
  id             TEXT PRIMARY KEY,
  development_id TEXT NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  user_id        TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_views_at ON development_views(viewed_at);
