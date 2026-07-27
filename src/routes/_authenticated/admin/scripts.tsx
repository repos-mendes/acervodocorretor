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
import { Plus, Edit, Trash2, MessageSquareText, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/scripts")({
  component: ScriptsAdminPage,
});

type Script = {
  id: string;
  title: string;
  content: string;
  development_id: string | null;
  category: string | null;
  status: "active" | "inactive";
  sort_order: number;
};

type DevOption = { id: string; name: string };

/** Valor sentinela do Select: o Radix não aceita item com valor vazio. */
const GERAL = "__geral__";

function useDevelopmentOptions() {
  return useQuery({
    queryKey: ["script-development-options"],
    queryFn: async () =>
      ((await db.from("developments").select("id, name").order("name")).data ?? []) as DevOption[],
  });
}

function ScriptsAdminPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Script | null>(null);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-scripts"],
    queryFn: async () =>
      ((await db.from("scripts").select("*").order("sort_order")).data ?? []) as Script[],
  });

  const { data: developments } = useDevelopmentOptions();
  const devName = (id: string | null) =>
    id ? developments?.find((d) => d.id === id)?.name ?? "Empreendimento removido" : null;

  async function remove(s: Script) {
    if (!confirm(`Excluir o script "${s.title}"?`)) return;
    const { error } = await db.from("scripts").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído.");
    qc.invalidateQueries({ queryKey: ["admin-scripts"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Scripts rápidos</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens prontas que o corretor copia com um clique.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo
        </Button>
      </div>

      {(!data || data.length === 0) ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum script cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                      s.development_id
                        ? "bg-accent/10 text-accent"
                        : "bg-secondary text-muted-foreground",
                    )}>
                      <Building2 className="h-3 w-3" />
                      {devName(s.development_id) ?? "Geral"}
                    </span>
                    {s.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {s.category}
                      </span>
                    )}
                    {s.status === "inactive" && (
                      <span className="text-xs text-muted-foreground">Inativo</span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground line-clamp-3">
                    {s.content}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScriptDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-scripts"] })}
      />
    </div>
  );
}

function ScriptDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Script | null; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [developmentId, setDevelopmentId] = useState(GERAL);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [sortOrder, setSortOrder] = useState("0");

  const { data: developments } = useDevelopmentOptions();

  const key = editing?.id ?? "new";
  const [prev, setPrev] = useState(key);
  if (open && prev !== key) {
    setPrev(key);
    setTitle(editing?.title ?? "");
    setContent(editing?.content ?? "");
    setDevelopmentId(editing?.development_id ?? GERAL);
    setCategory(editing?.category ?? "");
    setStatus(editing?.status ?? "active");
    setSortOrder(String(editing?.sort_order ?? 0));
  }

  async function save() {
    if (!title.trim() || !content.trim()) return toast.error("Preencha título e conteúdo.");
    const payload = {
      title: title.trim(),
      content,
      development_id: developmentId === GERAL ? null : developmentId,
      category: category.trim() || null,
      status,
      sort_order: Number(sortOrder) || 0,
    };
    const res = editing
      ? await db.from("scripts").update(payload).eq("id", editing.id)
      : await db.from("scripts").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Editar" : "Novo"} script</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Primeiro contato (WhatsApp)"
            />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo (o texto que será copiado)</Label>
            <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Empreendimento</Label>
            <Select value={developmentId} onValueChange={setDevelopmentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={GERAL}>Geral (serve para qualquer empreendimento)</SelectItem>
                {(developments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Scripts de um empreendimento aparecem no menu dele; os gerais ficam na seção de baixo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex.: Prospecção"
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo (visível ao corretor)</SelectItem>
                <SelectItem value="inactive">Inativo (oculto)</SelectItem>
              </SelectContent>
            </Select>
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
