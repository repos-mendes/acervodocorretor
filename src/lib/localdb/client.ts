// Banco de dados local em localStorage para testes de front-end.
//
// Expõe `db` com a mesma interface de consulta usada pelas telas
// (from().select().eq()..., auth.*, rpc()). Quando o backend definitivo
// (Cloudflare D1 + Clerk) entrar, apenas este módulo — e o façade de
// auth — precisam ser reimplementados; as telas não mudam.
//
// ATENÇÃO: as senhas ficam em texto plano no localStorage. Isso é aceitável
// apenas neste modo de demonstração local, nunca em produção.

import { buildSeed } from "./seed";
import { deleteBlob, getBlob, putBlob } from "./blobs";
import type { AppRole, TableName } from "./types";

// Versão dos dados locais. Incrementar quando o seed mudar de forma
// incompatível — o navegador descarta a base antiga e recria a partir do seed.
const DB_KEY = "acervo.localdb.v5";
const SESSION_KEY = "acervo.session.v1";

type Row = Record<string, unknown>;
type DbState = ReturnType<typeof buildSeed>;
type DbError = { message: string } | null;
// data é `any[]`/`any` de propósito: as telas tipam o resultado no ponto de
// uso, como faziam com o client anterior totalmente tipado.
/* eslint-disable @typescript-eslint/no-explicit-any */
type QueryResult = { data: any[]; error: DbError; count: number | null };
type SingleResult = { data: any; error: DbError; count: number | null };

const isBrowser = typeof window !== "undefined";

let state: DbState | null = null;

function loadState(): DbState {
  if (!isBrowser) return buildSeed();
  if (state) return state;
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as DbState;
      return state;
    } catch {
      // dados corrompidos: recria a partir do seed
    }
  }
  state = buildSeed();
  persist();
  return state;
}

function persist() {
  if (isBrowser && state) localStorage.setItem(DB_KEY, JSON.stringify(state));
}

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Sessão e eventos de autenticação
// ---------------------------------------------------------------------------

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type AuthUser = { id: string; email: string };
type StoredSession = { userId: string; email: string };

const authListeners = new Set<(event: AuthEvent) => void>();

function readSession(): StoredSession | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeSession(sess: StoredSession | null) {
  if (!isBrowser) return;
  if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
  else localStorage.removeItem(SESSION_KEY);
}

function emitAuth(event: AuthEvent) {
  authListeners.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.error(e);
    }
  });
}

function currentUser(): AuthUser | null {
  const sess = readSession();
  if (!sess) return null;
  return { id: sess.userId, email: sess.email };
}

// ---------------------------------------------------------------------------
// Query builder (subconjunto do PostgREST usado pelas telas)
// ---------------------------------------------------------------------------

// FKs usadas nos selects com relação embutida, ex.: "*, file_categories(name)".
const FK_MAP: Partial<Record<TableName, Record<string, string>>> = {
  development_files: { file_categories: "category_id", developments: "development_id" },
  announcements: { developments: "development_id" },
  file_downloads: { developments: "development_id", development_files: "file_id" },
};

// Valores default aplicados em inserts (equivalente aos DEFAULTs do schema).
function applyInsertDefaults(table: TableName, payload: Row): Row {
  const base: Row = { id: uid(), created_at: now(), ...payload };
  switch (table) {
    case "developments":
      return {
        short_description: null, full_description: null, commercial_information: null,
        commercial_status: "lancamento", publication_status: "draft",
        development_type: null, address: null, neighborhood: null, city: null,
        maps_url: null, cover_image_url: null, logo_url: null, gallery_urls: null,
        highlights: [], is_featured: false, launch_date: null, sort_order: 0,
        created_by: currentUser()?.id ?? null, updated_at: now(), ...base,
      };
    case "development_files":
      return {
        category_id: null, description: null, development_id: null,
        file_size: null, file_extension: null, mime_type: null,
        publication_status: "draft", is_featured: false, download_count: 0,
        uploaded_by: currentUser()?.id ?? null, updated_at: now(), ...base,
      };
    case "file_categories":
      return { description: null, icon: null, sort_order: 0, is_active: true, ...base };
    case "announcements":
      return {
        priority: "informativo", status: "active", published_at: now(),
        expires_at: null, link_url: null, development_id: null,
        created_by: currentUser()?.id ?? null, updated_at: now(), ...base,
      };
    case "scripts":
      return {
        development_id: null, category: null, status: "active", sort_order: 0,
        created_by: currentUser()?.id ?? null, updated_at: now(), ...base,
      };
    case "file_downloads":
      return { development_id: null, downloaded_at: now(), ...base };
    case "development_views":
      return { user_id: null, viewed_at: now(), ...base };
    case "user_roles":
      return { ...base };
    case "profiles":
      return {
        full_name: "", phone: null, creci: null, avatar_url: null,
        status: "ativo", updated_at: now(), last_access_at: null, ...base,
      };
    default:
      return base;
  }
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private singleMode: "maybe" | "strict" | null = null;
  private embeds: string[] = [];
  private countMode = false;
  private headMode = false;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private executed: Promise<SingleResult> | null = null;

  constructor(private table: TableName) {}

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.op = this.op === "select" ? "select" : this.op;
    for (const m of columns.matchAll(/(\w+)\(([^)]*)\)/g)) this.embeds.push(m[1]);
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload as Row;
    this.scheduleAutoRun();
    return this;
  }

  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    this.scheduleAutoRun();
    return this;
  }

  delete() {
    this.op = "delete";
    this.scheduleAutoRun();
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((row) => String(row[col] ?? "") >= String(val));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  maybeSingle(): PromiseLike<SingleResult> {
    this.singleMode = "maybe";
    return this as unknown as PromiseLike<SingleResult>;
  }

  single(): PromiseLike<SingleResult> {
    this.singleMode = "strict";
    return this as unknown as PromiseLike<SingleResult>;
  }

  // Mutations executam mesmo sem await (padrão fire-and-forget usado nas telas).
  private scheduleAutoRun() {
    if (!isBrowser) return;
    queueMicrotask(() => void this.run());
  }

  then<T1 = QueryResult, T2 = never>(
    onfulfilled?: ((value: QueryResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private run(): Promise<SingleResult> {
    if (!this.executed) this.executed = Promise.resolve(this.execute());
    return this.executed;
  }

  private rows(): Row[] {
    const store = loadState() as unknown as Record<string, Row[]>;
    // Garante que a tabela exista no estado. Sem isso, um insert numa tabela
    // ausente (ex.: adicionada ao modelo depois que o navegador já salvou a
    // base) era descartado silenciosamente, porque `?? []` devolvia um array
    // temporário que nunca era persistido.
    if (!Array.isArray(store[this.table])) store[this.table] = [];
    return store[this.table];
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((f) => f(row)));
  }

  private execute(): SingleResult {
    if (!isBrowser) return { data: this.singleMode ? null : [], error: null, count: 0 };
    try {
      switch (this.op) {
        case "insert": {
          const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
          for (const item of list) {
            const row = applyInsertDefaults(this.table, { ...item });
            this.rows().push(row);
            if (this.table === "file_downloads") {
              const file = (loadState().development_files as unknown as Row[]).find((f) => f.id === row.file_id);
              if (file) file.download_count = ((file.download_count as number) ?? 0) + 1;
            }
          }
          persist();
          return { data: null, error: null, count: null };
        }
        case "update": {
          for (const row of this.matching()) {
            Object.assign(row, this.payload, "updated_at" in row ? { updated_at: now() } : {});
          }
          persist();
          return { data: null, error: null, count: null };
        }
        case "delete": {
          const keep = this.rows().filter((row) => !this.filters.every((f) => f(row)));
          (loadState() as unknown as Record<string, Row[]>)[this.table] = keep;
          persist();
          return { data: null, error: null, count: null };
        }
        case "select":
        default: {
          let rows = this.matching();
          const count = this.countMode ? rows.length : null;
          if (this.orders.length) {
            rows = [...rows].sort((a, b) => {
              for (const { col, asc } of this.orders) {
                const av = a[col];
                const bv = b[col];
                if (av === bv) continue;
                if (av == null) return 1;
                if (bv == null) return -1;
                const cmp = av < bv ? -1 : 1;
                return asc ? cmp : -cmp;
              }
              return 0;
            });
          }
          if (this.limitN != null) rows = rows.slice(0, this.limitN);
          let data: any = rows.map((row) => this.attachEmbeds({ ...row }));
          if (this.headMode) data = null;
          if (this.singleMode) {
            const first = (data as Row[] | null)?.[0] ?? null;
            if (this.singleMode === "strict" && !first) {
              return { data: null, error: { message: "Row not found" }, count };
            }
            data = first;
          }
          return { data, error: null, count };
        }
      }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null };
    }
  }

  private attachEmbeds(row: Row): Row {
    for (const embedTable of this.embeds) {
      const fkCol = FK_MAP[this.table]?.[embedTable];
      if (!fkCol) continue;
      const related = (loadState() as unknown as Record<string, Row[]>)[embedTable] ?? [];
      row[embedTable] = related.find((r) => r.id === row[fkCol]) ?? null;
    }
    return row;
  }
}

// ---------------------------------------------------------------------------
// Autenticação local
// ---------------------------------------------------------------------------

const auth = {
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: DbError }> {
    return { data: { user: currentUser() }, error: null };
  },

  async getSession() {
    const user = currentUser();
    return {
      data: { session: user ? { user, access_token: "local" } : null },
      error: null,
    };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const db = loadState();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
    }
    writeSession({ userId: user.id, email: user.email });
    emitAuth("SIGNED_IN");
    const authUser = { id: user.id, email: user.email };
    return { data: { user: authUser, session: { user: authUser, access_token: "local" } }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
    const db = loadState();
    const normalized = email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
      return { data: { user: null, session: null }, error: { message: "Este e-mail já está cadastrado." } };
    }
    const id = uid();
    db.users.push({ id, email: normalized, password, created_at: now() });
    // Equivalente ao trigger handle_new_user: cria perfil + papel padrão.
    db.profiles.push({
      id, email: normalized, full_name: options?.data?.full_name ?? "",
      phone: null, creci: null, avatar_url: null, status: "ativo",
      created_at: now(), updated_at: now(), last_access_at: null,
    });
    db.user_roles.push({ id: uid(), user_id: id, role: "corretor", created_at: now() });
    persist();
    // Não troca a sessão atual: quem cria usuários é o admin logado.
    return { data: { user: { id, email: normalized }, session: null }, error: null };
  },

  async signOut() {
    writeSession(null);
    emitAuth("SIGNED_OUT");
    return { error: null };
  },

  async resetPasswordForEmail(_email: string, _opts?: { redirectTo?: string }): Promise<{ data: object; error: DbError }> {
    // Sem servidor de e-mail no modo local. A senha pode ser trocada em
    // "Meu perfil" ou pelo painel admin recriando o usuário.
    return { data: {}, error: null };
  },

  async updateUser({ password }: { password?: string }) {
    const sess = readSession();
    if (!sess) return { data: { user: null }, error: { message: "Sessão expirada. Faça login novamente." } };
    if (password) {
      const db = loadState();
      const user = db.users.find((u) => u.id === sess.userId);
      if (user) {
        user.password = password;
        persist();
      }
    }
    emitAuth("USER_UPDATED");
    return { data: { user: currentUser() }, error: null };
  },

  onAuthStateChange(callback: (event: AuthEvent) => void) {
    authListeners.add(callback);
    const unsubscribe = () => {
      authListeners.delete(callback);
    };
    return { data: { subscription: { unsubscribe } } };
  },
};

// ---------------------------------------------------------------------------
// RPCs (funções que existiam no banco)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc(name: string, args: Record<string, any> = {}): Promise<{ data: any; error: DbError }> {
  const db = loadState();
  switch (name) {
    case "is_admin":
      return { data: db.user_roles.some((r) => r.user_id === args._user_id && r.role === "admin"), error: null };
    case "has_role":
      return { data: db.user_roles.some((r) => r.user_id === args._user_id && r.role === (args._role as AppRole)), error: null };
    case "is_active_user":
      return { data: db.profiles.some((p) => p.id === args._user_id && p.status === "ativo"), error: null };
    default:
      return { data: null, error: { message: `RPC desconhecida: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// Storage local (usado por src/lib/storage.ts)
// ---------------------------------------------------------------------------

const objectUrlCache = new Map<string, string>();

export async function storageGetUrl(bucket: string, path: string): Promise<string | null> {
  if (!isBrowser || !path) return null;
  const key = `${bucket}/${path}`;
  const seeded = loadState().storage_objects[key];
  if (seeded) return seeded;
  const cached = objectUrlCache.get(key);
  if (cached) return cached;
  try {
    const blob = await getBlob(key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export async function storagePut(bucket: string, path: string, file: File): Promise<{ error: DbError }> {
  if (!isBrowser) return { error: { message: "Storage indisponível no servidor." } };
  try {
    await putBlob(`${bucket}/${path}`, file);
    return { error: null };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "Falha ao salvar o arquivo." } };
  }
}

export async function storageRemove(bucket: string, path: string): Promise<{ error: DbError }> {
  if (!isBrowser) return { error: null };
  const key = `${bucket}/${path}`;
  const db = loadState();
  if (db.storage_objects[key]) {
    delete db.storage_objects[key];
    persist();
  }
  const cached = objectUrlCache.get(key);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(key);
  }
  try {
    await deleteBlob(key);
  } catch {
    // ignora: blob pode não existir
  }
  return { error: null };
}

// ---------------------------------------------------------------------------

export const db = {
  from: (table: TableName) => new QueryBuilder(table),
  rpc,
  auth,
};

/** Apaga todos os dados locais e volta ao seed (útil durante testes). */
export function resetLocalDb() {
  if (!isBrowser) return;
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  state = null;
  indexedDB.deleteDatabase("acervo-blobs");
  location.reload();
}
