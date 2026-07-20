import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PriorityBadge } from "@/components/acervo/StatusBadge";
import { priorityLabel, formatDate } from "@/lib/format";
import type { AnnouncementPriority } from "@/lib/format";
import { Plus, Edit, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/comunicados")({
  component: AnnouncementsPage,
});

type Announcement = {
  id: string; title: string; content: string; priority: AnnouncementPriority;
  status: "active" | "inactive"; published_at: string; expires_at: string | null; link_url: string | null;
};

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => (await db.from("announcements").select("*").order("published_at", { ascending: false })).data ?? [],
  });

  async function remove(a: Announcement) {
    if (!confirm(`Excluir "${a.title}"?`)) return;
    const { error } = await db.from("announcements").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído.");
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Comunicados</h1>
          <p className="text-sm text-muted-foreground">Publique avisos para toda a equipe.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
      </div>

      {(!data || data.length === 0) ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum comunicado publicado.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-semibold">{a.title}</h3>
                    <PriorityBadge priority={a.priority} />
                    {a.status === "inactive" && <span className="text-xs text-muted-foreground">Inativo</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Publicado em {formatDate(a.published_at)}</p>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{a.content}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnouncementDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-announcements"] })} />
    </div>
  );
}

function AnnouncementDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Announcement | null; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("informativo");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [linkUrl, setLinkUrl] = useState("");
  const key = editing?.id ?? "new"; const [prev, setPrev] = useState(key);
  if (open && prev !== key) {
    setPrev(key);
    setTitle(editing?.title ?? ""); setContent(editing?.content ?? "");
    setPriority(editing?.priority ?? "informativo"); setStatus(editing?.status ?? "active");
    setLinkUrl(editing?.link_url ?? "");
  }

  async function save() {
    if (!title.trim() || !content.trim()) return toast.error("Preencha título e conteúdo.");
    const payload = { title, content, priority, status, link_url: linkUrl || null };
    const res = editing
      ? await db.from("announcements").update(payload).eq("id", editing.id)
      : await db.from("announcements").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo.");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Novo"} comunicado</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Conteúdo</Label><Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(priorityLabel) as AnnouncementPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Link (opcional)</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
