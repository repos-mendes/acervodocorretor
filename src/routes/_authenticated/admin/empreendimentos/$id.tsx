import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PublicationBadge } from "@/components/acervo/StatusBadge";
import { FileTypeIcon } from "@/components/acervo/FileTypeIcon";
import { publicationStatusLabel, formatBytes } from "@/lib/format";
import type { PublicationStatus } from "@/lib/format";
import { ArrowLeft, Upload, Trash2, Edit, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, removeFile } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/empreendimentos/$id")({
  loader: async ({ params }) => {
    const { data } = await db.from("developments").select("id, name, slug").eq("id", params.id).maybeSingle();
    if (!data) throw notFound();
    return { dev: data };
  },
  component: DevelopmentFilesPage,
});

function DevelopmentFilesPage() {
  const { dev } = Route.useLoaderData();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: files } = useQuery({
    queryKey: ["admin-files", dev.id],
    queryFn: async () => {
      const { data } = await db.from("development_files")
        .select("*, file_categories(name)")
        .eq("development_id", dev.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["file-categories"],
    queryFn: async () => (await db.from("file_categories").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || !list.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const ext = file.name.split(".").pop() ?? "";
        const path = `${dev.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await uploadFile("materials", path, file);
        if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
        await db.from("development_files").insert({
          development_id: dev.id, storage_path: path, original_file_name: file.name,
          title: file.name.replace(/\.[^.]+$/, ""), file_size: file.size, file_extension: ext,
          mime_type: file.type, publication_status: "draft",
        });
      }
      toast.success("Arquivos enviados.");
      qc.invalidateQueries({ queryKey: ["admin-files", dev.id] });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove(f: { id: string; storage_path: string; title: string }) {
    if (!confirm(`Excluir "${f.title}"?`)) return;
    await removeFile("materials", f.storage_path);
    await db.from("development_files").delete().eq("id", f.id);
    toast.success("Arquivo excluído.");
    qc.invalidateQueries({ queryKey: ["admin-files", dev.id] });
  }

  const editing = files?.find((f) => f.id === editingId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/admin/empreendimentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{dev.name}</h1>
          <p className="text-sm text-muted-foreground">Gerencie os arquivos deste empreendimento.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Enviar arquivos
          <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
      </div>

      <div className="rounded-xl border">
        {!files || files.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum arquivo enviado.</p>
        ) : (
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 p-3">
                <FileTypeIcon extension={f.file_extension} fileName={f.original_file_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{f.title}</span>
                    {f.is_featured && <Star className="h-3.5 w-3.5 text-accent fill-accent" />}
                    <PublicationBadge status={f.publication_status} />
                    {(f.file_categories as { name: string } | null) && (
                      <span className="text-[11px] text-muted-foreground">{(f.file_categories as { name: string }).name}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{f.original_file_name} · {formatBytes(f.file_size)} · {f.download_count} downloads</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setEditingId(f.id); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(f)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditFileDialog
          key={editing.id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          file={editing}
          categories={categories ?? []}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-files", dev.id] })}
        />
      )}
    </div>
  );
}

function EditFileDialog({ open, onOpenChange, file, categories, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  file: { id: string; title: string; description: string | null; publication_status: PublicationStatus; is_featured: boolean; category_id: string | null };
  categories: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description ?? "");
  const [status, setStatus] = useState<PublicationStatus>(file.publication_status);
  const [featured, setFeatured] = useState(file.is_featured);
  const [categoryId, setCategoryId] = useState<string>(file.category_id ?? "none");

  async function save() {
    const { error } = await db.from("development_files").update({
      title, description, publication_status: status, is_featured: featured,
      category_id: categoryId === "none" ? null : categoryId,
    }).eq("id", file.id);
    if (error) return toast.error(error.message);
    toast.success("Arquivo atualizado.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Editar arquivo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Publicação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PublicationStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(publicationStatusLabel) as PublicationStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{publicationStatusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={featured} onCheckedChange={setFeatured} />
            <Label>Destacar</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
