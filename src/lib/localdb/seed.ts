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
const DEV1 = "d-horizonte";
const DEV2 = "d-parque-aguas";
const DEV3 = "d-villa-jardim";
const CAT_BOOK = "c-book";
const CAT_IMPLANTACAO = "c-implantacao";
const CAT_PLANTAS = "c-plantas";
const CAT_MIDIAS = "c-midias";
const CAT_TABELAS = "c-tabelas";

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

  const developments: DevelopmentRow[] = [
    {
      id: DEV1, name: "Residencial Horizonte", slug: "residencial-horizonte",
      short_description: "Apartamentos de 2 e 3 quartos com lazer completo.",
      full_description: "O Residencial Horizonte une localização privilegiada e lazer completo.\n\nTorres com elevador, área de lazer com piscina, academia e salão de festas. Plantas inteligentes de 58m² a 84m².",
      commercial_information: "Entrada facilitada em até 36x. Consulte a tabela vigente na biblioteca de materiais.",
      commercial_status: "lancamento", publication_status: "published",
      development_type: "Residencial", address: "Av. Olívia Flores, 1200",
      neighborhood: "Candeias", city: "Vitória da Conquista", maps_url: null,
      cover_image_url: "seed/horizonte-capa.svg", logo_url: null,
      gallery_urls: ["seed/horizonte-g1.svg", "seed/horizonte-g2.svg"],
      highlights: ["2 e 3 quartos", "Piscina e academia", "Varanda gourmet", "A 5 min do centro"],
      is_featured: true, launch_date: null, sort_order: 1,
      created_by: ADMIN_ID, created_at: daysAgo(45), updated_at: daysAgo(5),
    },
    {
      id: DEV2, name: "Parque das Águas", slug: "parque-das-aguas",
      short_description: "Lotes de 250m² a 400m² em condomínio fechado.",
      full_description: "Loteamento planejado com infraestrutura completa, portaria 24h e áreas verdes preservadas.",
      commercial_information: null,
      commercial_status: "em_construcao", publication_status: "published",
      development_type: "Loteamento", address: null,
      neighborhood: "Felícia", city: "Vitória da Conquista", maps_url: null,
      cover_image_url: "seed/parque-capa.svg", logo_url: null,
      gallery_urls: null,
      highlights: ["Lotes a partir de 250m²", "Portaria 24h", "Área verde preservada"],
      is_featured: true, launch_date: null, sort_order: 2,
      created_by: ADMIN_ID, created_at: daysAgo(30), updated_at: daysAgo(10),
    },
    {
      id: DEV3, name: "Villa Jardim", slug: "villa-jardim",
      short_description: "Casas em condomínio — em breve.",
      full_description: null, commercial_information: null,
      commercial_status: "em_breve", publication_status: "draft",
      development_type: "Residencial", address: null,
      neighborhood: null, city: "Vitória da Conquista", maps_url: null,
      cover_image_url: null, logo_url: null, gallery_urls: null, highlights: [],
      is_featured: false, launch_date: null, sort_order: 3,
      created_by: ADMIN_ID, created_at: daysAgo(7), updated_at: daysAgo(7),
    },
  ];

  const development_files: DevelopmentFileRow[] = [
    {
      id: "f-1", development_id: DEV1, category_id: CAT_TABELAS,
      title: "Tabela de preços — Julho", description: "Tabela vigente até 31/07.",
      storage_path: "seed/horizonte-tabela.pdf", original_file_name: "tabela-precos-julho.pdf",
      file_size: 48_500, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: true, download_count: 32,
      uploaded_by: ADMIN_ID, created_at: daysAgo(12), updated_at: daysAgo(12),
    },
    {
      id: "f-2", development_id: DEV1, category_id: CAT_BOOK,
      title: "Book de vendas", description: "Apresentação completa do empreendimento.",
      storage_path: "seed/horizonte-book.pdf", original_file_name: "book-residencial-horizonte.pdf",
      file_size: 2_400_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: false, download_count: 21,
      uploaded_by: ADMIN_ID, created_at: daysAgo(40), updated_at: daysAgo(40),
    },
    {
      id: "f-3", development_id: DEV1, category_id: CAT_PLANTAS,
      title: "Planta tipo 84m²", description: null,
      storage_path: "seed/horizonte-planta.pdf", original_file_name: "planta-tipo-84.pdf",
      file_size: 310_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: false, download_count: 14,
      uploaded_by: ADMIN_ID, created_at: daysAgo(38), updated_at: daysAgo(38),
    },
    {
      id: "f-4", development_id: DEV2, category_id: CAT_TABELAS,
      title: "Tabela de lotes", description: "Valores e condições por quadra.",
      storage_path: "seed/parque-tabela.pdf", original_file_name: "tabela-lotes.pdf",
      file_size: 52_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: false, download_count: 9,
      uploaded_by: ADMIN_ID, created_at: daysAgo(9), updated_at: daysAgo(9),
    },
    {
      id: "f-5", development_id: DEV1, category_id: CAT_IMPLANTACAO,
      title: "Implantação geral", description: "Disposição das torres e áreas comuns.",
      storage_path: "seed/horizonte-implantacao.pdf", original_file_name: "implantacao-geral.pdf",
      file_size: 420_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: false, download_count: 11,
      uploaded_by: ADMIN_ID, created_at: daysAgo(36), updated_at: daysAgo(36),
    },
    {
      id: "f-6", development_id: DEV1, category_id: CAT_MIDIAS,
      title: "Perspectiva da fachada", description: null,
      storage_path: "seed/horizonte-perspectiva-fachada.svg", original_file_name: "perspectiva-fachada.svg",
      file_size: 180_000, file_extension: "svg", mime_type: "image/svg+xml",
      publication_status: "published", is_featured: false, download_count: 7,
      uploaded_by: ADMIN_ID, created_at: daysAgo(20), updated_at: daysAgo(20),
    },
    {
      id: "f-7", development_id: DEV1, category_id: CAT_MIDIAS,
      title: "Perspectiva da área de lazer", description: null,
      storage_path: "seed/horizonte-perspectiva-lazer.svg", original_file_name: "perspectiva-lazer.svg",
      file_size: 165_000, file_extension: "svg", mime_type: "image/svg+xml",
      publication_status: "published", is_featured: false, download_count: 5,
      uploaded_by: ADMIN_ID, created_at: daysAgo(19), updated_at: daysAgo(19),
    },
    {
      id: "f-8", development_id: DEV2, category_id: CAT_IMPLANTACAO,
      title: "Mapa de quadras e lotes", description: "Implantação com numeração dos lotes.",
      storage_path: "seed/parque-implantacao.pdf", original_file_name: "mapa-quadras-lotes.pdf",
      file_size: 510_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: true, download_count: 18,
      uploaded_by: ADMIN_ID, created_at: daysAgo(25), updated_at: daysAgo(25),
    },
    {
      id: "f-9", development_id: DEV2, category_id: CAT_BOOK,
      title: "Book do loteamento", description: "Apresentação completa do Parque das Águas.",
      storage_path: "seed/parque-book.pdf", original_file_name: "book-parque-das-aguas.pdf",
      file_size: 1_900_000, file_extension: "pdf", mime_type: "application/pdf",
      publication_status: "published", is_featured: false, download_count: 13,
      uploaded_by: ADMIN_ID, created_at: daysAgo(24), updated_at: daysAgo(24),
    },
  ];

  const announcements: AnnouncementRow[] = [
    {
      id: "a-1", title: "Nova tabela do Residencial Horizonte",
      content: "A tabela de julho já está disponível na biblioteca de materiais. As condições anteriores valem apenas para propostas protocoladas até sexta-feira.",
      priority: "importante", status: "active",
      published_at: daysAgo(3), expires_at: null, link_url: null,
      development_id: DEV1, created_by: ADMIN_ID, created_at: daysAgo(3), updated_at: daysAgo(3),
    },
    {
      id: "a-2", title: "Plantão de vendas no fim de semana",
      content: "Teremos plantão no stand do Parque das Águas sábado e domingo, das 9h às 17h. Confirmem presença com a coordenação.",
      priority: "informativo", status: "active",
      published_at: daysAgo(1), expires_at: null, link_url: null,
      development_id: DEV2, created_by: ADMIN_ID, created_at: daysAgo(1), updated_at: daysAgo(1),
    },
  ];

  const scripts: ScriptRow[] = [
    {
      id: "s-1", title: "Primeiro contato (WhatsApp)",
      content:
        "Olá! Tudo bem? Aqui é o(a) corretor(a) da nossa construtora. Vi que você demonstrou interesse em conhecer nossos empreendimentos. Posso te enviar algumas opções que combinam com o que você procura?",
      category: "Prospecção", status: "active", sort_order: 1,
      created_by: ADMIN_ID, created_at: daysAgo(20), updated_at: daysAgo(20),
    },
    {
      id: "s-2", title: "Retomar conversa (follow-up)",
      content:
        "Oi! Passando para saber se você teve a chance de analisar o material que enviei. Fico à disposição para tirar qualquer dúvida e, se preferir, podemos agendar uma visita ao decorado.",
      category: "Follow-up", status: "active", sort_order: 2,
      created_by: ADMIN_ID, created_at: daysAgo(18), updated_at: daysAgo(18),
    },
    {
      id: "s-3", title: "Objeção de preço",
      content:
        "Entendo perfeitamente a sua preocupação com o investimento. Posso te mostrar as condições de entrada facilitada e as opções de financiamento? Muitas vezes a parcela cabe melhor no orçamento do que se imagina.",
      category: "Objeções", status: "active", sort_order: 3,
      created_by: ADMIN_ID, created_at: daysAgo(15), updated_at: daysAgo(15),
    },
    {
      id: "s-4", title: "Convite para visita",
      content:
        "Que tal conhecermos o apartamento decorado pessoalmente? Tenho horários disponíveis esta semana. Qual fica melhor para você: sábado de manhã ou à tarde?",
      category: "Fechamento", status: "active", sort_order: 4,
      created_by: ADMIN_ID, created_at: daysAgo(12), updated_at: daysAgo(12),
    },
    {
      id: "s-5", title: "Agradecimento pós-venda",
      content:
        "Muito obrigado(a) pela confiança! Foi um prazer participar dessa conquista. Qualquer coisa que precisar, pode contar comigo. Indicações de amigos e familiares são sempre muito bem-vindas!",
      category: "Pós-venda", status: "active", sort_order: 5,
      created_by: ADMIN_ID, created_at: daysAgo(8), updated_at: daysAgo(8),
    },
  ];

  // Conteúdo dos arquivos "seed/*": data URLs servidas pelo storage local
  // sem passar pelo IndexedDB.
  const storage_objects: Record<string, string> = {
    "covers/seed/horizonte-capa.svg": svgCover("Residencial Horizonte", "#22333f", "#3d5a6c"),
    "covers/seed/parque-capa.svg": svgCover("Parque das Águas", "#1f3d33", "#3c6e5a"),
    "galleries/seed/horizonte-g1.svg": svgCover("Área de lazer", "#31424e", "#587687"),
    "galleries/seed/horizonte-g2.svg": svgCover("Fachada", "#3a3f4a", "#6b7280"),
    "materials/seed/horizonte-tabela.pdf": demoPdf("Tabela de precos - Julho"),
    "materials/seed/horizonte-book.pdf": demoPdf("Book de vendas - Residencial Horizonte"),
    "materials/seed/horizonte-planta.pdf": demoPdf("Planta tipo 84m2"),
    "materials/seed/parque-tabela.pdf": demoPdf("Tabela de lotes - Parque das Aguas"),
    "materials/seed/horizonte-implantacao.pdf": demoPdf("Implantacao geral - Residencial Horizonte"),
    "materials/seed/horizonte-perspectiva-fachada.svg": svgCover("Perspectiva - Fachada", "#2b3a45", "#4f6d7f"),
    "materials/seed/horizonte-perspectiva-lazer.svg": svgCover("Perspectiva - Area de lazer", "#2f4a3d", "#5a8a72"),
    "materials/seed/parque-implantacao.pdf": demoPdf("Mapa de quadras e lotes - Parque das Aguas"),
    "materials/seed/parque-book.pdf": demoPdf("Book do loteamento - Parque das Aguas"),
  };

  return {
    users, profiles, user_roles, developments, file_categories,
    development_files, announcements, scripts,
    file_downloads: [], development_views: [],
    storage_objects,
    seeded_at: now(),
  };
}
