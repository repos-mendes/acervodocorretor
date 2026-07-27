// Dados de demonstração criados na primeira execução do modo local.
// Contas de teste:
//   admin@acervo.local    / admin123
//   corretor@acervo.local / corretor123

import type {
  AnnouncementRow,
  DevelopmentFileRow,
  DevelopmentRow,
  FileCategoryRow,
  LocalUser,
  ProfileRow,
  ScriptRow,
  UserRoleRow,
} from "./types";

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

function svgCover(title: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1280" height="800" fill="url(#g)"/><g fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2"><rect x="180" y="260" width="200" height="380"/><rect x="420" y="180" width="240" height="460"/><rect x="700" y="300" width="180" height="340"/><rect x="920" y="220" width="220" height="420"/></g><text x="64" y="720" font-family="Georgia, serif" font-size="54" fill="rgba(255,255,255,0.92)">${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Gera um PDF mínimo válido (offsets de xref calculados) para os materiais de demonstração. */
function demoPdf(title: string): string {
  const text = title.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  const stream = `BT /F1 20 Tf 72 760 Td (${text}) Tj ET\nBT /F1 12 Tf 72 730 Td (Arquivo de demonstracao - Acervo do Corretor) Tj ET`;
  const objects = [
    `<</Type/Catalog/Pages 2 0 R>>`,
    `<</Type/Pages/Kids[3 0 R]/Count 1>>`,
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>`,
    `<</Length ${stream.length}>>stream\n${stream}\nendstream`,
    `<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}

const ADMIN_ID = "u-admin-0000";
const CORRETOR_ID = "u-corretor-0000";
const CAT_BOOK = "c-book";
const CAT_IMPLANTACAO = "c-implantacao";
const CAT_PLANTAS = "c-plantas";
const CAT_MIDIAS = "c-midias";
const CAT_TABELAS = "c-tabelas";

/**
 * Catálogo de empreendimentos pré-cadastrados. Cada item gera: o
 * empreendimento publicado, a capa em SVG, dois materiais de demonstração
 * (book e tabela) e o script de apresentação que aparece no menu do
 * empreendimento em /scripts.
 *
 * `description` é o texto fornecido pela construtora. Os campos que ela ainda
 * não informou (endereço, situação comercial real, galeria) ficam vazios ou no
 * padrão e devem ser ajustados no painel do admin.
 */
const CATALOGO = [
  {
    slug: "uni-house-leste", name: "Uni House Leste", type: "Casa",
    description: "Casa solta de 2 e 3/4, com 45m² e 47m², com quintal amplo e área de lazer completa.",
    highlights: ["Casa solta", "2 e 3 quartos", "45m² e 47m²", "Quintal amplo", "Área de lazer completa"],
    neighborhood: null,
    gradient: ["#22333f", "#3d5a6c"],
    script:
      "O Uni House Leste é casa solta de 2 e 3/4, com 45m² e 47m², quintal amplo e área de lazer completa. Quer que eu te envie o book com as plantas e as condições de pagamento?",
  },
  {
    slug: "uni-house-do-marques", name: "Uni House do Marquês", type: "Casa",
    description: "Casa solta de 2 e 3/4, com 37m² e 45m², com quintal amplo e área de lazer completa.",
    highlights: ["Casa solta", "2 e 3 quartos", "37m² e 45m²", "Quintal amplo", "Área de lazer completa"],
    neighborhood: null,
    gradient: ["#2b3a45", "#4f6d7f"],
    script:
      "O Uni House do Marquês é casa solta de 2 e 3/4, com 37m² e 45m², quintal amplo e área de lazer completa. Posso te mandar o book com as plantas e os valores?",
  },
  {
    slug: "bellator-olivia", name: "Bellator Olívia", type: "Casa",
    description: "Casa solta de 2 e 3/4, sendo ambos 2 suítes, na Olívia Flores, com área de lazer completa.",
    highlights: ["Casa solta", "2 e 3 quartos", "2 suítes", "Olívia Flores", "Área de lazer completa"],
    neighborhood: "Olívia Flores",
    gradient: ["#1f3d33", "#3c6e5a"],
    script:
      "O Bellator Olívia fica na Olívia Flores e tem casa solta de 2 e 3/4, ambos com 2 suítes, além de área de lazer completa. Quer conhecer as plantas e a localização?",
  },
  {
    slug: "sculptor", name: "Sculptor", type: "Casa",
    description: "Casa solta e Casa geminada de 4/4 de 100m², 1 suíte + 2 banheiros sociais e quintal amplo.",
    highlights: ["Casa solta e geminada", "4 quartos", "100m²", "1 suíte + 2 banheiros sociais", "Quintal amplo"],
    neighborhood: null,
    gradient: ["#3a3f4a", "#6b7280"],
    script:
      "O Sculptor tem casa solta e geminada de 4/4 com 100m², 1 suíte, 2 banheiros sociais e quintal amplo. É a opção ideal para famílias que precisam de espaço. Posso te enviar as plantas?",
  },
  {
    slug: "vila-do-servidor", name: "Vila do Servidor", type: "Duo Residence",
    description: "Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.",
    highlights: ["Duo Residence", "2 e 3 quartos", "Com e sem suíte", "Área de lazer completa", "Localização privilegiada"],
    neighborhood: null,
    gradient: ["#2f4a3d", "#5a8a72"],
    script:
      "A Vila do Servidor é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o material completo?",
  },
  {
    slug: "uni-ville", name: "Uni Ville", type: "Duo Residence",
    description: "Duo Residence, 2/4 com e sem suíte. Área de lazer completa e ótima localização.",
    highlights: ["Duo Residence", "2 quartos", "Com e sem suíte", "Área de lazer completa", "Ótima localização"],
    neighborhood: null,
    gradient: ["#31424e", "#587687"],
    script:
      "O Uni Ville é Duo Residence de 2/4, com e sem suíte, área de lazer completa e ótima localização. Posso te mandar as plantas e as condições de entrada?",
  },
  {
    slug: "dona-lys", name: "Dona Lys", type: "Duo Residence",
    description: "Duo Residence, 2 e 3/4 com e sem suíte. Área de lazer completa e localização privilegiada.",
    highlights: ["Duo Residence", "2 e 3 quartos", "Com e sem suíte", "Área de lazer completa", "Localização privilegiada"],
    neighborhood: null,
    gradient: ["#3d2f4a", "#6b5a8a"],
    script:
      "A Dona Lys é Duo Residence, com opções de 2 e 3/4, com e sem suíte, área de lazer completa e localização privilegiada. Quer que eu te envie o book com as plantas?",
  },
];

export function buildSeed() {
  const users: LocalUser[] = [
    { id: ADMIN_ID, email: "admin@acervo.local", password: "admin123", created_at: daysAgo(90) },
    { id: CORRETOR_ID, email: "corretor@acervo.local", password: "corretor123", created_at: daysAgo(60) },
  ];

  const profiles: ProfileRow[] = [
    {
      id: ADMIN_ID, full_name: "Administrador(a) Demo", email: "admin@acervo.local",
      phone: null, creci: null, avatar_url: null, status: "ativo",
      created_at: daysAgo(90), updated_at: daysAgo(90), last_access_at: null,
    },
    {
      id: CORRETOR_ID, full_name: "Corretor(a) Demo", email: "corretor@acervo.local",
      phone: "(77) 99999-0000", creci: "12345-BA", avatar_url: null, status: "ativo",
      created_at: daysAgo(60), updated_at: daysAgo(60), last_access_at: null,
    },
  ];

  const user_roles: UserRoleRow[] = [
    { id: "r-1", user_id: ADMIN_ID, role: "admin", created_at: daysAgo(90) },
    { id: "r-2", user_id: CORRETOR_ID, role: "corretor", created_at: daysAgo(60) },
  ];

  const file_categories: FileCategoryRow[] = [
    { id: CAT_BOOK, name: "Book", description: "Apresentação institucional de vendas", icon: null, sort_order: 1, is_active: true, created_at: daysAgo(80) },
    { id: CAT_IMPLANTACAO, name: "Implantação", description: "Implantação geral e mapa de quadras", icon: null, sort_order: 2, is_active: true, created_at: daysAgo(80) },
    { id: CAT_PLANTAS, name: "Plantas", description: "Plantas baixas por tipologia", icon: null, sort_order: 3, is_active: true, created_at: daysAgo(80) },
    { id: CAT_MIDIAS, name: "Vídeos e imagens de apresentação", description: "Perspectivas, fotos e vídeos", icon: null, sort_order: 4, is_active: true, created_at: daysAgo(80) },
    { id: CAT_TABELAS, name: "Tabelas de preço", description: "Tabelas de venda vigentes", icon: null, sort_order: 5, is_active: true, created_at: daysAgo(80) },
  ];

  const developments: DevelopmentRow[] = CATALOGO.map((c, i) => ({
    id: `d-${c.slug}`, name: c.name, slug: c.slug,
    short_description: c.description,
    // Descrição longa, endereço, mapa e galeria ainda não foram informados —
    // o admin completa pelo painel.
    full_description: null,
    commercial_information: null,
    // Situação comercial real de cada empreendimento ainda não informada:
    // todos entram como lançamento. Ajustar no painel do admin.
    commercial_status: "lancamento",
    publication_status: "published",
    development_type: c.type,
    address: null,
    neighborhood: c.neighborhood,
    city: "Vitória da Conquista",
    maps_url: null,
    cover_image_url: `seed/${c.slug}-capa.svg`,
    logo_url: null,
    gallery_urls: null,
    highlights: c.highlights,
    is_featured: false,
    launch_date: null,
    sort_order: i + 1,
    created_by: ADMIN_ID,
    created_at: daysAgo(45 - i),
    updated_at: daysAgo(45 - i),
  }));

  // Dois materiais de demonstração por empreendimento, só para a biblioteca
  // não ficar vazia. Os arquivos reais entram pelo painel do admin.
  const development_files: DevelopmentFileRow[] = CATALOGO.flatMap((c) => [
    {
      id: `f-${c.slug}-book`, development_id: `d-${c.slug}`, category_id: CAT_BOOK,
      title: "Book de vendas", description: `Apresentação completa do ${c.name}.`,
      storage_path: `seed/${c.slug}-book.pdf`, original_file_name: `book-${c.slug}.pdf`,
      file_size: 1_800_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published" as const, is_featured: true, download_count: 0,
      uploaded_by: ADMIN_ID, created_at: daysAgo(20), updated_at: daysAgo(20),
    },
    {
      id: `f-${c.slug}-tabela`, development_id: `d-${c.slug}`, category_id: CAT_TABELAS,
      title: "Tabela de preços", description: "Tabela de demonstração — substituir pela vigente.",
      storage_path: `seed/${c.slug}-tabela.pdf`, original_file_name: `tabela-${c.slug}.pdf`,
      file_size: 48_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published" as const, is_featured: false, download_count: 0,
      uploaded_by: ADMIN_ID, created_at: daysAgo(18), updated_at: daysAgo(18),
    },
  ]);

  const announcements: AnnouncementRow[] = [
    {
      id: "a-1", title: "Materiais dos empreendimentos disponíveis",
      content: "Os empreendimentos já estão cadastrados no acervo. Confira os materiais de cada um e use os scripts prontos para agilizar o atendimento.",
      priority: "informativo", status: "active",
      published_at: daysAgo(1), expires_at: null, link_url: null,
      development_id: null, created_by: ADMIN_ID, created_at: daysAgo(1), updated_at: daysAgo(1),
    },
  ];

  // `development_id: null` = script geral (serve para qualquer abordagem);
  // com um id preenchido, o script aparece no menu daquele empreendimento.
  const scripts: ScriptRow[] = [
    {
      id: "s-1", title: "Primeiro contato (WhatsApp)",
      content:
        "Olá! Tudo bem? Aqui é o(a) corretor(a) da nossa construtora. Vi que você demonstrou interesse em conhecer nossos empreendimentos. Posso te enviar algumas opções que combinam com o que você procura?",
      development_id: null,
      category: "Prospecção", status: "active", sort_order: 1,
      created_by: ADMIN_ID, created_at: daysAgo(20), updated_at: daysAgo(20),
    },
    {
      id: "s-2", title: "Retomar conversa (follow-up)",
      content:
        "Oi! Passando para saber se você teve a chance de analisar o material que enviei. Fico à disposição para tirar qualquer dúvida e, se preferir, podemos agendar uma visita ao decorado.",
      development_id: null,
      category: "Follow-up", status: "active", sort_order: 2,
      created_by: ADMIN_ID, created_at: daysAgo(18), updated_at: daysAgo(18),
    },
    {
      id: "s-3", title: "Objeção de preço",
      content:
        "Entendo perfeitamente a sua preocupação com o investimento. Posso te mostrar as condições de entrada facilitada e as opções de financiamento? Muitas vezes a parcela cabe melhor no orçamento do que se imagina.",
      development_id: null,
      category: "Objeções", status: "active", sort_order: 3,
      created_by: ADMIN_ID, created_at: daysAgo(15), updated_at: daysAgo(15),
    },
    {
      id: "s-4", title: "Convite para visita",
      content:
        "Que tal conhecermos o apartamento decorado pessoalmente? Tenho horários disponíveis esta semana. Qual fica melhor para você: sábado de manhã ou à tarde?",
      development_id: null,
      category: "Fechamento", status: "active", sort_order: 4,
      created_by: ADMIN_ID, created_at: daysAgo(12), updated_at: daysAgo(12),
    },
    {
      id: "s-5", title: "Agradecimento pós-venda",
      content:
        "Muito obrigado(a) pela confiança! Foi um prazer participar dessa conquista. Qualquer coisa que precisar, pode contar comigo. Indicações de amigos e familiares são sempre muito bem-vindas!",
      development_id: null,
      category: "Pós-venda", status: "active", sort_order: 5,
      created_by: ADMIN_ID, created_at: daysAgo(8), updated_at: daysAgo(8),
    },
    // Um script de apresentação por empreendimento: é o que faz o menu do
    // empreendimento aparecer na tela de scripts do corretor.
    ...CATALOGO.map((c) => ({
      id: `s-${c.slug}`, title: `Apresentação — ${c.name}`,
      content: c.script,
      development_id: `d-${c.slug}`,
      category: "Prospecção", status: "active" as const, sort_order: 1,
      created_by: ADMIN_ID, created_at: daysAgo(15), updated_at: daysAgo(15),
    })),
  ];

  // Conteúdo dos arquivos "seed/*": data URLs servidas pelo storage local
  // sem passar pelo IndexedDB. Capa e materiais são gerados a partir do nome
  // de cada empreendimento, então nenhum arquivo cita outro por engano.
  const storage_objects: Record<string, string> = {};
  for (const c of CATALOGO) {
    const [from, to] = c.gradient;
    storage_objects[`covers/seed/${c.slug}-capa.svg`] = svgCover(c.name, from, to);
    storage_objects[`materials/seed/${c.slug}-book.pdf`] = demoPdf(`Book de vendas - ${c.name}`);
    storage_objects[`materials/seed/${c.slug}-tabela.pdf`] = demoPdf(`Tabela de precos - ${c.name}`);
  }

  return {
    users, profiles, user_roles, developments, file_categories,
    development_files, announcements, scripts,
    file_downloads: [], development_views: [],
    storage_objects,
    seeded_at: now(),
  };
}
