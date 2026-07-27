import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/localdb/client";
import { SignedImage } from "@/components/acervo/SignedImage";
import { CommercialBadge } from "@/components/acervo/StatusBadge";
import { FileTypeIcon } from "@/components/acervo/FileTypeIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Download, Package, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadFile, downloadFilesAsZip } from "@/lib/downloads";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/empreendimentos/$slug")({
  loader: async ({ params }) => {
    const { data } = await db
      .from("developments")
      .select("*")
      .eq("slug", params.slug)
      .eq("publication_status", "published")
      .maybeSingle();
    if (!data) throw notFound();
    return { development: data };
  },
  component: DetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="font-display text-2xl">Empreendimento não encontrado</h1>
      <p className="text-muted-foreground mt-2">Ele pode ter sido despublicado.</p>
      <Button asChild className="mt-6"><Link to="/empreendimentos">Voltar</Link></Button>
    </div>
  ),
});

function DetailPage() {
  const { development } = Route.useLoaderData();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.userId) {
      db.from("development_views").insert({ development_id: development.id, user_id: session.userId });
    }
  }, [development.id, session?.userId]);

  const { data: files } = useQuery({
    queryKey: ["development-files", development.id],
    queryFn: async () => {
      const { data } = await db
        .from("development_files")
        .select("*, file_categories(id, name, icon)")
        .eq("development_id", development.id)
        .eq("publication_status", "published")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["file-categories"],
    queryFn: async () => {
      const { data } = await db.from("file_categories").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const filesByCategory = useMemo(() => {
    const map = new Map<string, typeof files>();
    (files ?? []).forEach((f) => {
      const key = f.category_id ?? "uncategorized";
      if (!map.has(key)) map.set(key, [] as never);
      map.get(key)!.push(f as never);
    });
    return map;
  }, [files]);

  const [galleryIdx, setGalleryIdx] = useState(0);
  const gallery = development.gallery_urls ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Link to="/empreendimentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para lista
      </Link>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="relative aspect-[21/9] bg-muted">
          <SignedImage bucket="covers" path={development.cover_image_url} alt={development.name} className="h-full w-full object-cover" />
        </div>
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CommercialBadge status={development.commercial_status} />
                {development.development_type && (
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{development.development_type}</span>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight">{development.name}</h1>
              {(development.address || development.city) && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {[development.address, development.neighborhood, development.city].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            {development.maps_url && (
              <Button variant="outline" asChild>
                <a href={development.maps_url} target="_blank" rel="noopener noreferrer">Ver no mapa</a>
              </Button>
            )}
          </div>

          {development.short_description && (
            <p className="mt-6 text-lg text-muted-foreground">{development.short_description}</p>
          )}

          {development.highlights && development.highlights.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {(development.highlights as string[]).map((h: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/50 px-3 py-1 text-xs">
                  <Star className="h-3 w-3 text-accent" /> {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {gallery.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">Galeria</h2>
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted">
            <SignedImage bucket="galleries" path={gallery[galleryIdx]} alt={`Foto ${galleryIdx + 1}`} className="h-full w-full object-cover" />
            {gallery.length > 1 && (
              <>
                <button onClick={() => setGalleryIdx((i) => (i - 1 + gallery.length) % gallery.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur hover:bg-background"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setGalleryIdx((i) => (i + 1) % gallery.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur hover:bg-background"><ChevronRight className="h-4 w-4" /></button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">{galleryIdx + 1} / {gallery.length}</div>
              </>
            )}
          </div>
        </section>
      )}

      {development.full_description && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Sobre o empreendimento</h2>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">{development.full_description}</div>
        </section>
      )}

      {development.commercial_information && (
        <section className="rounded-xl border bg-secondary/30 p-6">
          <h2 className="font-display text-lg font-semibold mb-2">Informações comerciais</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{development.commercial_information}</p>
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl font-semibold mb-4">Biblioteca de materiais</h2>
        {!files ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum material publicado ainda.</p>
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Todos ({files.length})</TabsTrigger>
              {(categories ?? []).filter((c) => filesByCategory.has(c.id)).map((c) => (
                <TabsTrigger key={c.id} value={c.id}>{c.name} ({filesByCategory.get(c.id)?.length ?? 0})</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <FileList files={files} developmentId={development.id} developmentName={development.name} />
            </TabsContent>
            {(categories ?? []).filter((c) => filesByCategory.has(c.id)).map((c) => (
              <TabsContent key={c.id} value={c.id} className="mt-4">
                <FileList files={filesByCategory.get(c.id) ?? []} developmentId={development.id} developmentName={development.name} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>
    </div>
  );
}

type FileRow = {
  id: string; title: string; description: string | null; storage_path: string;
  original_file_name: string; file_size: number | null; file_extension: string | null;
  is_featured: boolean;
};

function FileList({ files, developmentId, developmentName }: { files: FileRow[]; developmentId: string; developmentName: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState(false);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allSelected = files.length > 0 && files.every((f) => selected.has(f.id));

  async function handleDownload(f: FileRow) {
    try {
      await downloadFile(f, developmentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    }
  }

  async function downloadZip() {
    const list = files.filter((f) => selected.has(f.id));
    if (list.length === 0) return;
    setZipping(true);
    try {
      const n = await downloadFilesAsZip(list, developmentId, `${developmentName}-materiais.zip`);
      toast.success(`${n} arquivo(s) baixado(s)`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar ZIP");
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="space-y-3">
      {files.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
          <label htmlFor="select-all" className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
            <Checkbox
              id="select-all"
              className="h-5 w-5"
              checked={allSelected}
              onCheckedChange={(v) => setSelected(v ? new Set(files.map((f) => f.id)) : new Set())}
            />
            {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar todos"}
          </label>
          <Button size="sm" disabled={selected.size === 0 || zipping} onClick={downloadZip}>
            <Package className="mr-2 h-4 w-4" /> {zipping ? "Compactando..." : "Baixar ZIP"}
          </Button>
        </div>
      )}
      <ul className="divide-y rounded-lg border">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors">
            {/* O label em volta amplia a área de toque no celular sem aumentar a caixinha. */}
            <label htmlFor={`file-${f.id}`} className="-m-1.5 shrink-0 cursor-pointer p-1.5">
              <Checkbox
                id={`file-${f.id}`}
                className="h-5 w-5"
                checked={selected.has(f.id)}
                onCheckedChange={() => toggle(f.id)}
                aria-label={`Selecionar ${f.title}`}
              />
            </label>
            <FileTypeIcon extension={f.file_extension} fileName={f.original_file_name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{f.title}</span>
                {f.is_featured && <Star className="h-3.5 w-3.5 text-accent fill-accent shrink-0" />}
              </div>
              {f.description && <p className="text-xs text-muted-foreground truncate">{f.description}</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {f.file_extension?.toUpperCase() || "ARQUIVO"} · {formatBytes(f.file_size)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDownload(f)} title="Baixar" aria-label={`Baixar ${f.title}`}>
              <Download className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
