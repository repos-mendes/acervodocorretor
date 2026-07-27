-- Alinha o schema do Supabase com o app atual e já deixa o catálogo cadastrado.
--
-- 1) Remove os comunicados (funcionalidade retirada do app).
-- 2) Cria a tabela de scripts rápidos, que nasceu depois das migrations
--    originais e por isso nunca existiu aqui.
-- 3) Cria os buckets de Storage que as políticas já pressupunham.
-- 4) Unifica as categorias de arquivo nas 5 que o app usa.
-- 5) Insere os 7 empreendimentos da construtora e seus scripts.
--
-- Escrita para ser re-executável: rodar duas vezes não duplica nada.

-- =========================
-- 1) COMUNICADOS (removidos do app)
-- =========================
DROP TABLE IF EXISTS public.announcements;
DROP TYPE IF EXISTS public.announcement_priority;
DROP TYPE IF EXISTS public.announcement_status;

-- =========================
-- 2) SCRIPTS RÁPIDOS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.script_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  -- NULL = script geral (serve para qualquer empreendimento).
  -- CASCADE: se o empreendimento sai, seus scripts saem junto — um script
  -- específico não pode virar "geral" por acidente.
  development_id UUID REFERENCES public.developments(id) ON DELETE CASCADE,
  category TEXT,
  status public.script_status NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_scripts_updated ON public.scripts;
CREATE TRIGGER trg_scripts_updated BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mesma regra dos materiais: o corretor ativo vê o script ativo, e se o script
-- for de um empreendimento, só quando esse empreendimento estiver publicado.
DROP POLICY IF EXISTS "Active corretores view active scripts" ON public.scripts;
CREATE POLICY "Active corretores view active scripts" ON public.scripts
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND status = 'active'
    AND (development_id IS NULL OR EXISTS (
      SELECT 1 FROM public.developments d
      WHERE d.id = development_id AND d.publication_status = 'published'
    ))
  );
DROP POLICY IF EXISTS "Admins view all scripts" ON public.scripts;
CREATE POLICY "Admins view all scripts" ON public.scripts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins manage scripts" ON public.scripts;
CREATE POLICY "Admins manage scripts" ON public.scripts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_scripts_dev ON public.scripts(development_id);

-- =========================
-- 3) BUCKETS DE STORAGE
-- =========================
-- As políticas de storage já existiam, mas nenhuma migration criava os
-- buckets. Privados de propósito: o app acessa por URL assinada.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('covers',    'covers',    false),
  ('galleries', 'galleries', false),
  ('materials', 'materials', false),
  ('avatars',   'avatars',   false)
ON CONFLICT (id) DO NOTHING;

-- =========================
-- 4) CATEGORIAS DE ARQUIVO
-- =========================
-- A migration original semeou 11 categorias; o app trabalha com 5. Esta é a
-- lista única, a mesma do seed local (src/lib/localdb/seed.ts).
--
-- "Plantas" e "Tabelas de preço" já existem com esses nomes e são atualizadas
-- no lugar (ON CONFLICT), preservando o id — assim nenhum arquivo já
-- classificado perde a categoria.
--
-- A coluna `icon` fica NULL como no mock: o app resolve o ícone pelo nome da
-- categoria (categoryIcon em DevelopmentCard.tsx), então a coluna não é usada.
INSERT INTO public.file_categories (name, description, icon, sort_order, is_active) VALUES
  ('Book',                             'Apresentação institucional de vendas', NULL, 1, true),
  ('Implantação',                      'Implantação geral e mapa de quadras',  NULL, 2, true),
  ('Plantas',                          'Plantas baixas por tipologia',         NULL, 3, true),
  ('Vídeos e imagens de apresentação', 'Perspectivas, fotos e vídeos',         NULL, 4, true),
  ('Tabelas de preço',                 'Tabelas de venda vigentes',            NULL, 5, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  is_active   = true;

-- Remove as 9 categorias que sobraram da lista antiga.
-- `development_files.category_id` é ON DELETE SET NULL: se algum arquivo
-- estivesse numa dessas categorias, ele ficaria sem categoria — o arquivo em si
-- não é apagado. Na primeira aplicação não existe arquivo nenhum.
DELETE FROM public.file_categories
WHERE name NOT IN (
  'Book',
  'Implantação',
  'Plantas',
  'Vídeos e imagens de apresentação',
  'Tabelas de preço'
);

-- =========================
-- 5) CATÁLOGO DE EMPREENDIMENTOS
-- =========================
-- `created_by` fica NULL: na hora que esta migration roda ainda não existe
-- nenhum usuário. Capa, galeria e materiais entram depois, pelo painel do
-- admin — SQL não sobe arquivo.
--
-- ATENÇÃO: `commercial_status` entra como 'lancamento' para todos porque a
-- situação real de cada um ainda não foi informada. Ajustar no painel.
INSERT INTO public.developments
  (name, slug, short_description, development_type, commercial_status, city, neighborhood, highlights, publication_status, sort_order)
VALUES
  ('Uni House Leste', 'uni-house-leste',
   'Casa solta de 2 e 3/4, com 45m² e 47m², com quintal amplo e área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Casa solta', '2 e 3 quartos', '45m² e 47m²', 'Quintal amplo', 'Área de lazer completa'],
   'published', 1),
  ('Uni House do Marquês', 'uni-house-do-marques',
   'Casa solta de 2 e 3/4, com 37m² e 45m², com quintal amplo e área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Casa solta', '2 e 3 quartos', '37m² e 45m²', 'Quintal amplo', 'Área de lazer completa'],
   'published', 2),
  ('Bellator Olívia', 'bellator-olivia',
   'Casa solta de 2 e 3/4, sendo ambos 2 suítes, na Olívia Flores, com área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', 'Olívia Flores',
   ARRAY['Casa solta', '2 e 3 quartos', '2 suítes', 'Olívia Flores', 'Área de lazer completa'],
   'published', 3),
  ('Sculptor', 'sculptor',
   'Casa solta e Casa geminada de 4/4 de 100m², 1 suíte + 2 banheiros sociais e quintal amplo.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Casa solta e geminada', '4 quartos', '100m²', '1 suíte + 2 banheiros sociais', 'Quintal amplo'],
   'published', 4),
  ('Vila do Servidor', 'vila-do-servidor',
   'Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Duo Residence', '2 e 3 quartos', 'Com e sem suíte', 'Área de lazer completa', 'Localização privilegiada'],
   'published', 5),
  ('Uni Ville', 'uni-ville',
   'Duo Residence, 2/4 com e sem suíte. Área de lazer completa e ótima localização.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Duo Residence', '2 quartos', 'Com e sem suíte', 'Área de lazer completa', 'Ótima localização'],
   'published', 6),
  ('Dona Lys', 'dona-lys',
   'Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   ARRAY['Duo Residence', '2 e 3 quartos', 'Com e sem suíte', 'Área de lazer completa', 'Localização privilegiada'],
   'published', 7)
ON CONFLICT (slug) DO NOTHING;

-- =========================
-- 6) SCRIPTS DO CATÁLOGO
-- =========================
-- Um script de apresentação por empreendimento. O empreendimento é resolvido
-- pelo slug, então não dependemos de UUID fixo.
INSERT INTO public.scripts (title, content, development_id, category, sort_order)
SELECT v.title, v.content, d.id, 'Prospecção', 1
FROM (VALUES
  ('Apresentação — Uni House Leste',
   'O Uni House Leste é casa solta de 2 e 3/4, com 45m² e 47m², quintal amplo e área de lazer completa. Quer que eu te envie o book com as plantas e as condições de pagamento?',
   'uni-house-leste'),
  ('Apresentação — Uni House do Marquês',
   'O Uni House do Marquês é casa solta de 2 e 3/4, com 37m² e 45m², quintal amplo e área de lazer completa. Posso te mandar o book com as plantas e os valores?',
   'uni-house-do-marques'),
  ('Apresentação — Bellator Olívia',
   'O Bellator Olívia fica na Olívia Flores e tem casa solta de 2 e 3/4, ambos com 2 suítes, além de área de lazer completa. Quer conhecer as plantas e a localização?',
   'bellator-olivia'),
  ('Apresentação — Sculptor',
   'O Sculptor tem casa solta e geminada de 4/4 com 100m², 1 suíte, 2 banheiros sociais e quintal amplo. É a opção ideal para famílias que precisam de espaço. Posso te enviar as plantas?',
   'sculptor'),
  ('Apresentação — Vila do Servidor',
   'A Vila do Servidor é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o material completo?',
   'vila-do-servidor'),
  ('Apresentação — Uni Ville',
   'O Uni Ville é Duo Residence de 2/4, com e sem suíte, área de lazer completa e ótima localização. Posso te mandar as plantas e as condições de entrada?',
   'uni-ville'),
  ('Apresentação — Dona Lys',
   'A Dona Lys é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o book com as plantas?',
   'dona-lys')
) AS v(title, content, slug)
JOIN public.developments d ON d.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM public.scripts s WHERE s.title = v.title);

-- Scripts gerais: servem para qualquer empreendimento.
INSERT INTO public.scripts (title, content, development_id, category, sort_order)
SELECT v.title, v.content, NULL, v.category, v.sort_order
FROM (VALUES
  ('Primeiro contato (WhatsApp)',
   'Olá! Tudo bem? Aqui é o(a) corretor(a) da nossa construtora. Vi que você demonstrou interesse em conhecer nossos empreendimentos. Posso te enviar algumas opções que combinam com o que você procura?',
   'Prospecção', 1),
  ('Retomar conversa (follow-up)',
   'Oi! Passando para saber se você teve a chance de analisar o material que enviei. Fico à disposição para tirar qualquer dúvida e, se preferir, podemos agendar uma visita ao decorado.',
   'Follow-up', 2),
  ('Objeção de preço',
   'Entendo perfeitamente a sua preocupação com o investimento. Posso te mostrar as condições de entrada facilitada e as opções de financiamento? Muitas vezes a parcela cabe melhor no orçamento do que se imagina.',
   'Objeções', 3),
  ('Convite para visita',
   'Que tal conhecermos o apartamento decorado pessoalmente? Tenho horários disponíveis esta semana. Qual fica melhor para você: sábado de manhã ou à tarde?',
   'Fechamento', 4),
  ('Agradecimento pós-venda',
   'Muito obrigado(a) pela confiança! Foi um prazer participar dessa conquista. Qualquer coisa que precisar, pode contar comigo. Indicações de amigos e familiares são sempre muito bem-vindas!',
   'Pós-venda', 5)
) AS v(title, content, category, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.scripts s WHERE s.title = v.title);
