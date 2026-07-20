
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'corretor');
CREATE TYPE public.user_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.commercial_status AS ENUM ('lancamento', 'em_construcao', 'pronto_para_morar', 'ultimas_unidades', 'em_breve', 'indisponivel');
CREATE TYPE public.publication_status AS ENUM ('published', 'draft', 'archived');
CREATE TYPE public.announcement_priority AS ENUM ('informativo', 'importante', 'urgente');
CREATE TYPE public.announcement_status AS ENUM ('active', 'inactive');

-- =========================
-- HELPER: updated_at
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  creci TEXT,
  avatar_url TEXT,
  status public.user_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- USER_ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'ativo');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- Trigger: create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'corretor'));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- User roles RLS
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- DEVELOPMENTS
-- =========================
CREATE TABLE public.developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  full_description TEXT,
  development_type TEXT,
  commercial_status public.commercial_status NOT NULL DEFAULT 'lancamento',
  city TEXT,
  neighborhood TEXT,
  address TEXT,
  maps_url TEXT,
  highlights TEXT[],
  commercial_information TEXT,
  cover_image_url TEXT,
  logo_url TEXT,
  gallery_urls TEXT[],
  launch_date DATE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  publication_status public.publication_status NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developments TO authenticated;
GRANT ALL ON public.developments TO service_role;
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dev_updated BEFORE UPDATE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Active corretores view published" ON public.developments
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND publication_status = 'published');
CREATE POLICY "Admins view all developments" ON public.developments
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage developments" ON public.developments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- FILE CATEGORIES
-- =========================
CREATE TABLE public.file_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_categories TO authenticated;
GRANT ALL ON public.file_categories TO service_role;
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active categories" ON public.file_categories
  FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage categories" ON public.file_categories
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed initial categories
INSERT INTO public.file_categories (name, icon, sort_order) VALUES
  ('Fotos', 'Image', 1),
  ('Vídeos', 'Video', 2),
  ('Apresentações', 'Presentation', 3),
  ('Tabelas de preço', 'Table', 4),
  ('Plantas', 'Map', 5),
  ('Book digital', 'BookOpen', 6),
  ('Memorial descritivo', 'FileText', 7),
  ('Materiais para redes sociais', 'Share2', 8),
  ('Documentos comerciais', 'FileSpreadsheet', 9),
  ('Planilhas', 'Sheet', 10),
  ('Outros materiais', 'Folder', 11);

-- =========================
-- DEVELOPMENT FILES
-- =========================
CREATE TABLE public.development_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID REFERENCES public.developments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.file_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  original_file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_extension TEXT,
  file_size BIGINT,
  publication_status public.publication_status NOT NULL DEFAULT 'published',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  download_count INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.development_files TO authenticated;
GRANT ALL ON public.development_files TO service_role;
ALTER TABLE public.development_files ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_files_updated BEFORE UPDATE ON public.development_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Active corretores view published files" ON public.development_files
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND publication_status = 'published'
    AND (development_id IS NULL OR EXISTS (
      SELECT 1 FROM public.developments d
      WHERE d.id = development_id AND d.publication_status = 'published'
    ))
  );
CREATE POLICY "Admins view all files" ON public.development_files
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage files" ON public.development_files
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- FILE DOWNLOADS
-- =========================
CREATE TABLE public.file_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.development_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  development_id UUID REFERENCES public.developments(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.file_downloads TO authenticated;
GRANT ALL ON public.file_downloads TO service_role;
ALTER TABLE public.file_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own downloads" ON public.file_downloads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users view own downloads" ON public.file_downloads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all downloads" ON public.file_downloads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.increment_download_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.development_files SET download_count = download_count + 1 WHERE id = NEW.file_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_increment_download AFTER INSERT ON public.file_downloads
  FOR EACH ROW EXECUTE FUNCTION public.increment_download_count();

-- =========================
-- DEVELOPMENT VIEWS
-- =========================
CREATE TABLE public.development_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.development_views TO authenticated;
GRANT ALL ON public.development_views TO service_role;
ALTER TABLE public.development_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert views" ON public.development_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all views" ON public.development_views
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- =========================
-- ANNOUNCEMENTS
-- =========================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority public.announcement_priority NOT NULL DEFAULT 'informativo',
  status public.announcement_status NOT NULL DEFAULT 'active',
  development_id UUID REFERENCES public.developments(id) ON DELETE SET NULL,
  link_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ann_updated BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Active users view active announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND status = 'active' AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Admins view all announcements" ON public.announcements
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_developments_slug ON public.developments(slug);
CREATE INDEX idx_developments_pub ON public.developments(publication_status);
CREATE INDEX idx_files_dev ON public.development_files(development_id);
CREATE INDEX idx_files_cat ON public.development_files(category_id);
CREATE INDEX idx_downloads_file ON public.file_downloads(file_id);
CREATE INDEX idx_downloads_user ON public.file_downloads(user_id);
CREATE INDEX idx_views_dev ON public.development_views(development_id);
