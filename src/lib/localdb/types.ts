// Modelo de dados da aplicação.
// Mantém o formato Database["public"]["Tables"|"Enums"] para que os tipos
// usados nas telas continuem válidos independentemente do backend (localStorage
// hoje, Cloudflare D1 no futuro).

export type CommercialStatus =
  | "lancamento"
  | "em_construcao"
  | "pronto_para_morar"
  | "ultimas_unidades"
  | "em_breve"
  | "indisponivel";

export type PublicationStatus = "published" | "draft" | "archived";
export type ScriptStatus = "active" | "inactive";
export type AppRole = "admin" | "corretor";
export type UserStatus = "ativo" | "inativo";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  creci: string | null;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_access_at: string | null;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

export type DevelopmentRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  commercial_information: string | null;
  commercial_status: CommercialStatus;
  publication_status: PublicationStatus;
  development_type: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  maps_url: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  gallery_urls: string[] | null;
  highlights: string[] | null;
  is_featured: boolean;
  launch_date: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FileCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type DevelopmentFileRow = {
  id: string;
  development_id: string | null;
  category_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  original_file_name: string;
  file_size: number | null;
  file_extension: string | null;
  mime_type: string | null;
  publication_status: PublicationStatus;
  is_featured: boolean;
  download_count: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FileDownloadRow = {
  id: string;
  file_id: string;
  development_id: string | null;
  user_id: string;
  downloaded_at: string;
};

export type DevelopmentViewRow = {
  id: string;
  development_id: string;
  user_id: string | null;
  viewed_at: string;
};

// Scripts rápidos: frases/parágrafos que o admin cadastra e o corretor copia
// com um clique (abordagem, follow-up, objeções, etc.).
export type ScriptRow = {
  id: string;
  title: string;
  content: string;
  /** Empreendimento a que o script pertence; `null` = script geral. */
  development_id: string | null;
  category: string | null;
  status: ScriptStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type TableDef<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row> };

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      user_roles: TableDef<UserRoleRow>;
      developments: TableDef<DevelopmentRow>;
      file_categories: TableDef<FileCategoryRow>;
      development_files: TableDef<DevelopmentFileRow>;
      file_downloads: TableDef<FileDownloadRow>;
      development_views: TableDef<DevelopmentViewRow>;
      scripts: TableDef<ScriptRow>;
    };
    Enums: {
      commercial_status: CommercialStatus;
      publication_status: PublicationStatus;
      script_status: ScriptStatus;
      app_role: AppRole;
      user_status: UserStatus;
    };
  };
};

export type TableName = keyof Database["public"]["Tables"];

/** Usuário de autenticação local (somente para o modo de testes em localStorage). */
export type LocalUser = {
  id: string;
  email: string;
  password: string;
  created_at: string;
};
