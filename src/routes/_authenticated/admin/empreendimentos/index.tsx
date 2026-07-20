import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CommercialBadge, PublicationBadge } from "@/components/acervo/StatusBadge";
import { commercialStatusLabel, publicationStatusLabel, slugify } from "@/lib/format";
import type { CommercialStatus, PublicationStatus } from "@/lib/format";
import { Plus, Edit, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { SignedImage } from "@/components/acervo/SignedImage";
import { uploadFile } from "@/lib/storage";
import type { Database } from "@/lib/localdb/types";

type Development = Database["public"]["Tables"]["developments"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/empreendimentos/")({
  component: AdminDevelopmentsPage,
});

const EMPTY = {
  name: "", slug: "", short_description: "", full_description: "", commercial_information: "",
  commercial_status: "lancamento" as CommercialStatus, publication_status: "draft" as PublicationStatus,
  city: "", neighborhood: "", address: "", development_type: "", maps_url: "",
  is_featured: false, cover_image_url: null as string | null, highlights: [] as string[], sort_order: 0,
};

function AdminDevelopmentsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Development | null>(null);
  const [open, setOpen] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ["admin-developments"],
    queryFn: async () => {
      const { data } = await db.from("developments").select("*").order("sort_order").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(d: Development) { setEditing(d); setOpen(true); }

  async function remove(d: Development) {
    if (!confirm(`Excluir "${d.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from("developments").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Empreendimento excluído.");
    qc.invalidateQueries({ queryKey: ["admin-developments"] });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Empreendimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre, edite e publique empreendimentos.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3">
          {(list ?? []).map((d) => (
            <div key={d.id} className="flex items-center gap-4 rounded-xl border bg-card p-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                <SignedImage bucket="covers" path={d.cover_image_url} alt={d.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{d.name}</span>
                  <CommercialBadge status={d.commercial_status} />
                  <PublicationBadge status={d.publication_status} />
                  {d.is_featured && <span className="text-xs text-accent">★ destaque</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">/{d.slug} · {[d.neighborhood, d.city].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/empreendimentos/$id" params={{ id: d.id }}>
                    <FolderOpen className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(d)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DevelopmentDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-developments"] })} />
    </div>
  );
}

function DevelopmentDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Development | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [highlightsText, setHighlightsText] = useState("");

  // reset when opening
  const key = editing?.id ?? "new";
  const [prevKey, setPrevKey] = useState(key);
  if (open && prevKey !== key) {
    setPrevKey(key);
    if (editing) {
      setForm({
        name: editing.name, slug: editing.slug, short_description: editing.short_description ?? "",
        full_description: editing.full_description ?? "", commercial_information: editing.commercial_information ?? "",
        commercial_status: editing.commercial_status, publication_status: editing.publication_status,
        city: editing.city ?? "", neighborhood: editing.neighborhood ?? "", address: editing.address ?? "",
        development_type: editing.development_type ?? "", maps_url: editing.maps_url ?? "",
        is_featured: editing.is_featured, cover_image_url: editing.cover_image_url,
        highlights: editing.highlights ?? [], sort_order: editing.sort_order,
      });
      setHighlightsText((editing.highlights ?? []).join("\n"));
    } else {
      setForm({ ...EMPTY });
      setHighlightsText("");
    }
  }

  async function onCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${form.slug || "novo"}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await uploadFile("covers", path, file, true);
    if (error) return toast.error(error.message);
    setForm((f) => ({ ...f, cover_image_url: path }));
    toast.success("Capa enviada.");
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Nome é obrigatório.");
    const slug = (form.slug || slugify(form.name)).trim();
    const highlights = highlightsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const payload = { ...form, slug, highlights };
    setSaving(true);
    const res = editing
      ? await db.from("developments").update(payload).eq("id", editing.id)
      : await db.from("developments").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Empreendimento atualizado." : "Empreendimento criado.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo"} empreendimento</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Capa</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-32 overflow-hidden rounded-md border bg-muted">
                <SignedImage bucket="covers" path={form.cover_image_url} alt="capa" className="h-full w-full object-cover" />
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-secondary">
                Enviar imagem
                <input type="file" accept="image/*" className="hidden" onChange={onCoverUpload} />
              </label>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Slug (URL)</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Input value={form.development_type} onChange={(e) => setForm({ ...form, development_type: e.target.value })} placeholder="Residencial, Comercial, Lote..." />
          </div>
          <div className="space-y-2">
            <Label>Status comercial</Label>
            <Select value={form.commercial_status} onValueChange={(v) => setForm({ ...form, commercial_status: v as CommercialStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(commercialStatusLabel) as CommercialStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{commercialStatusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Publicação</Label>
            <Select value={form.publication_status} onValueChange={(v) => setForm({ ...form, publication_status: v as PublicationStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(publicationStatusLabel) as PublicationStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{publicationStatusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição curta</Label>
            <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição completa</Label>
            <Textarea rows={4} value={form.full_description} onChange={(e) => setForm({ ...form, full_description: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Informações comerciais</Label>
            <Textarea rows={3} value={form.commercial_information} onChange={(e) => setForm({ ...form, commercial_information: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>URL Google Maps</Label>
            <Input value={form.maps_url} onChange={(e) => setForm({ ...form, maps_url: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Destaques (um por linha)</Label>
            <Textarea rows={4} value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} placeholder="3 dormitórios&#10;Piscina e academia&#10;A 5 min do centro" />
          </div>
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
            <Label>Destacar na página inicial</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
