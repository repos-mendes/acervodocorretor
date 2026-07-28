-- Conteúdo inicial: as 5 categorias de arquivo e o catálogo real da construtora
-- (7 empreendimentos + 12 scripts). Traduzido da migration do Supabase que foi
-- descartada (20260727153000_scripts_buckets_e_catalogo.sql).
--
-- Os ids são textos legíveis em vez de UUID. Assim o seed é idempotente
-- (INSERT OR IGNORE não duplica) e dá para ler o banco sem decorar códigos.
--
-- NÃO entram aqui: capas, galerias e materiais — SQL não sobe arquivo. Eles são
-- enviados pelo painel do admin e vão para o bucket R2.
--
-- Também não entra o usuário administrador: a senha precisa ser cifrada, o que
-- SQL não faz. Ele é criado no primeiro acesso (ver a tela de login).

-- ---------------------------------------------------------------------------
-- Categorias de arquivo (as 5 que o app usa)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO file_categories (id, name, description, icon, sort_order, is_active) VALUES
  ('cat-book',      'Book',                             'Apresentação institucional de vendas', NULL, 1, 1),
  ('cat-implanta',  'Implantação',                      'Implantação geral e mapa de quadras',  NULL, 2, 1),
  ('cat-plantas',   'Plantas',                          'Plantas baixas por tipologia',         NULL, 3, 1),
  ('cat-midia',     'Vídeos e imagens de apresentação', 'Perspectivas, fotos e vídeos',         NULL, 4, 1),
  ('cat-tabelas',   'Tabelas de preço',                 'Tabelas de venda vigentes',            NULL, 5, 1);

-- ---------------------------------------------------------------------------
-- Empreendimentos
-- ---------------------------------------------------------------------------
-- ATENÇÃO: `commercial_status` entra como 'lancamento' para todos porque a
-- situação real de cada um ainda não foi informada. Endereço, descrição longa e
-- galeria também ficam vazios — tudo isso é preenchido no painel do admin.
INSERT OR IGNORE INTO developments
  (id, name, slug, short_description, development_type, commercial_status, city, neighborhood, highlights, publication_status, sort_order)
VALUES
  ('dev-uni-house-leste', 'Uni House Leste', 'uni-house-leste',
   'Casa solta de 2 e 3/4, com 45m² e 47m², com quintal amplo e área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   '["Casa solta","2 e 3 quartos","45m² e 47m²","Quintal amplo","Área de lazer completa"]',
   'published', 1),

  ('dev-uni-house-marques', 'Uni House do Marquês', 'uni-house-do-marques',
   'Casa solta de 2 e 3/4, com 37m² e 45m², com quintal amplo e área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   '["Casa solta","2 e 3 quartos","37m² e 45m²","Quintal amplo","Área de lazer completa"]',
   'published', 2),

  ('dev-bellator-olivia', 'Bellator Olívia', 'bellator-olivia',
   'Casa solta de 2 e 3/4, sendo ambos 2 suítes, na Olívia Flores, com área de lazer completa.',
   'Casa', 'lancamento', 'Vitória da Conquista', 'Olívia Flores',
   '["Casa solta","2 e 3 quartos","2 suítes","Olívia Flores","Área de lazer completa"]',
   'published', 3),

  ('dev-sculptor', 'Sculptor', 'sculptor',
   'Casa solta e Casa geminada de 4/4 de 100m², 1 suíte + 2 banheiros sociais e quintal amplo.',
   'Casa', 'lancamento', 'Vitória da Conquista', NULL,
   '["Casa solta e geminada","4 quartos","100m²","1 suíte + 2 banheiros sociais","Quintal amplo"]',
   'published', 4),

  ('dev-vila-do-servidor', 'Vila do Servidor', 'vila-do-servidor',
   'Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   '["Duo Residence","2 e 3 quartos","Com e sem suíte","Área de lazer completa","Localização privilegiada"]',
   'published', 5),

  ('dev-uni-ville', 'Uni Ville', 'uni-ville',
   'Duo Residence, 2/4 com e sem suíte. Área de lazer completa e ótima localização.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   '["Duo Residence","2 quartos","Com e sem suíte","Área de lazer completa","Ótima localização"]',
   'published', 6),

  ('dev-dona-lys', 'Dona Lys', 'dona-lys',
   'Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.',
   'Duo Residence', 'lancamento', 'Vitória da Conquista', NULL,
   '["Duo Residence","2 e 3 quartos","Com e sem suíte","Área de lazer completa","Localização privilegiada"]',
   'published', 7);

-- ---------------------------------------------------------------------------
-- Scripts de apresentação (um por empreendimento)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO scripts (id, title, content, development_id, category, sort_order) VALUES
  ('scr-apres-uni-house-leste', 'Apresentação — Uni House Leste',
   'O Uni House Leste é casa solta de 2 e 3/4, com 45m² e 47m², quintal amplo e área de lazer completa. Quer que eu te envie o book com as plantas e as condições de pagamento?',
   'dev-uni-house-leste', 'Prospecção', 1),

  ('scr-apres-uni-house-marques', 'Apresentação — Uni House do Marquês',
   'O Uni House do Marquês é casa solta de 2 e 3/4, com 37m² e 45m², quintal amplo e área de lazer completa. Posso te mandar o book com as plantas e os valores?',
   'dev-uni-house-marques', 'Prospecção', 1),

  ('scr-apres-bellator-olivia', 'Apresentação — Bellator Olívia',
   'O Bellator Olívia fica na Olívia Flores e tem casa solta de 2 e 3/4, ambos com 2 suítes, além de área de lazer completa. Quer conhecer as plantas e a localização?',
   'dev-bellator-olivia', 'Prospecção', 1),

  ('scr-apres-sculptor', 'Apresentação — Sculptor',
   'O Sculptor tem casa solta e geminada de 4/4 com 100m², 1 suíte, 2 banheiros sociais e quintal amplo. É a opção ideal para famílias que precisam de espaço. Posso te enviar as plantas?',
   'dev-sculptor', 'Prospecção', 1),

  ('scr-apres-vila-do-servidor', 'Apresentação — Vila do Servidor',
   'A Vila do Servidor é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o material completo?',
   'dev-vila-do-servidor', 'Prospecção', 1),

  ('scr-apres-uni-ville', 'Apresentação — Uni Ville',
   'O Uni Ville é Duo Residence de 2/4, com e sem suíte, área de lazer completa e ótima localização. Posso te mandar as plantas e as condições de entrada?',
   'dev-uni-ville', 'Prospecção', 1),

  ('scr-apres-dona-lys', 'Apresentação — Dona Lys',
   'A Dona Lys é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o book com as plantas?',
   'dev-dona-lys', 'Prospecção', 1);

-- ---------------------------------------------------------------------------
-- Scripts gerais (servem para qualquer empreendimento)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO scripts (id, title, content, development_id, category, sort_order) VALUES
  ('scr-primeiro-contato', 'Primeiro contato (WhatsApp)',
   'Olá! Tudo bem? Aqui é o(a) corretor(a) da nossa construtora. Vi que você demonstrou interesse em conhecer nossos empreendimentos. Posso te enviar algumas opções que combinam com o que você procura?',
   NULL, 'Prospecção', 1),

  ('scr-follow-up', 'Retomar conversa (follow-up)',
   'Oi! Passando para saber se você teve a chance de analisar o material que enviei. Fico à disposição para tirar qualquer dúvida e, se preferir, podemos agendar uma visita ao decorado.',
   NULL, 'Follow-up', 2),

  ('scr-objecao-preco', 'Objeção de preço',
   'Entendo perfeitamente a sua preocupação com o investimento. Posso te mostrar as condições de entrada facilitada e as opções de financiamento? Muitas vezes a parcela cabe melhor no orçamento do que se imagina.',
   NULL, 'Objeções', 3),

  ('scr-convite-visita', 'Convite para visita',
   'Que tal conhecermos o apartamento decorado pessoalmente? Tenho horários disponíveis esta semana. Qual fica melhor para você: sábado de manhã ou à tarde?',
   NULL, 'Fechamento', 4),

  ('scr-pos-venda', 'Agradecimento pós-venda',
   'Muito obrigado(a) pela confiança! Foi um prazer participar dessa conquista. Qualquer coisa que precisar, pode contar comigo. Indicações de amigos e familiares são sempre muito bem-vindas!',
   NULL, 'Pós-venda', 5);
