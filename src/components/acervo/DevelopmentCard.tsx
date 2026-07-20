import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  BookOpen,
  Map as MapIcon,
  Ruler,
  Images,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { db } from "@/lib/localdb/client";
import { SignedImage } from "@/components/acervo/SignedImage";
import { CommercialBadge } from "@/components/acervo/StatusBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadGroup } from "@/lib/downloads";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommercialStatus } from "@/lib/format";
import { toast } from "sonner";

type CardDevelopment = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  cover_image_url: string | null;
  commercial_status: CommercialStatus;
  city: string | null;
  neighborhood: string | null;
};

type CardFile = {
  id: string;
  title: string;
  category_id: string | null;
  storage_path: string;
  original_file_name: string;
  file_size: number | null;
};

type Group = { id: string; name: string; files: CardFile[] };

const UNCATEGORIZED = "uncategorized";

/** Ícone por categoria, resolvido pelo nome (o admin pode renomear/criar categorias). */
function categoryIcon(name: string) {
  const n = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (n.includes("book") || n.includes("apresentac")) return BookOpen;
  if (n.includes("implanta")) return MapIcon;
  if (n.includes("planta")) return Ruler;
  if (n.includes("video") || n.includes("imagem") || n.includes("imagens") || n.includes("foto"))
    return Images;
  if (n.includes("tabela") || n.includes("preco")) return FileSpreadsheet;
  return FileText;
}

export function DevelopmentCard({ development }: { development: CardDevelopment }) {
  const [open, setOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["file-categories"],
    queryFn: async () =>
      (
        await db
          .from("file_categories")
          .select("id, name, sort_order")
          .eq("is_active", true)
          .order("sort_order")
      ).data ?? [],
    staleTime: 5 * 60_000,
  });

  const { data: files, isLoading } = useQuery({
    queryKey: ["development-files", development.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await db
        .from("development_files")
        .select("id, title, category_id, storage_path, original_file_name, file_size")
        .eq("development_id", development.id)
        .eq("publication_status", "published")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      return (data ?? []) as CardFile[];
    },
  });

  // Todas as categorias ativas aparecem sempre, mesmo vazias, para que o menu
  // do card seja previsível entre um empreendimento e outro.
  const groups: Group[] = useMemo(() => {
    const byCategory = new Map<string, CardFile[]>();
    (files ?? []).forEach((f) => {
      const key = f.category_id ?? UNCATEGORIZED;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(f);
    });

    const list: Group[] = (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      files: byCategory.get(c.id) ?? [],
    }));

    const loose = byCategory.get(UNCATEGORIZED);
    if (loose?.length) list.push({ id: UNCATEGORIZED, name: "Outros materiais", files: loose });
    return list;
  }, [categories, files]);

  const totalFiles = files?.length ?? 0;
  const location = [development.neighborhood, development.city].filter(Boolean).join(" · ");

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "group overflow-hidden rounded-xl border bg-card transition-shadow",
        open ? "shadow-lg" : "hover:shadow-lg",
      )}
    >
      <CollapsibleTrigger className="block w-full cursor-pointer text-left">
        <div className="aspect-[16/10] overflow-hidden bg-muted">
          <SignedImage
            bucket="covers"
            path={development.cover_image_url}
            alt={development.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold truncate">{development.name}</h3>
            <CommercialBadge status={development.commercial_status} />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {development.short_description || " "}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{location}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              {open ? "Fechar" : "Ver materiais"}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
              />
            </span>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="border-t bg-secondary/20 p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : totalFiles === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum material publicado ainda.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {groups.map((g) => (
                <li key={g.id}>
                  <CategoryRow
                    group={g}
                    developmentId={development.id}
                    developmentName={development.name}
                  />
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/empreendimentos/$slug"
            params={{ slug: development.slug }}
            className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Ver página completa do empreendimento
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CategoryRow({
  group,
  developmentId,
  developmentName,
}: {
  group: Group;
  developmentId: string;
  developmentName: string;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = categoryIcon(group.name);
  const count = group.files.length;
  const empty = count === 0;

  const totalSize = group.files.reduce((sum, f) => sum + (f.file_size ?? 0), 0);
  const detail = empty
    ? "Nenhum arquivo"
    : `${count} ${count === 1 ? "arquivo" : "arquivos"}${totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ""}`;

  async function handleDownload() {
    if (empty || busy) return;
    setBusy(true);
    try {
      const n = await downloadGroup(
        group.files,
        developmentId,
        `${developmentName} - ${group.name}.zip`,
      );
      toast.success(n === 1 ? "Download iniciado." : `${n} arquivos baixados em ZIP.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar os arquivos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={empty || busy}
      aria-label={empty ? `${group.name} — nenhum arquivo disponível` : `Baixar ${group.name}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors",
        empty ? "cursor-not-allowed opacity-50" : "hover:border-accent/40 hover:bg-secondary/60",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{group.name}</span>
        <span className="block text-[11px] text-muted-foreground">{detail}</span>
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Download
          className={cn("h-4 w-4 shrink-0", empty ? "text-muted-foreground" : "text-accent")}
        />
      )}
    </button>
  );
}
