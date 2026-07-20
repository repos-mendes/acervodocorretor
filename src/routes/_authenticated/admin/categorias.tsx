import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CategoriesPage,
});

type Category = { id: string; name: string; description: string | null; icon: string | null; sort_order: number; is_active: boolean };

function CategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await db.from("file_categories").select("*").order("sort_order")).data ?? [],
  });

  async function remove(c: Category) {
    if (!confirm(`Excluir categoria "${c.name}"?`)) return;
    const { error } = await db.from("file_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoria excluída.");
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Categorias de arquivos</h1>
          <p className="text-sm text-muted-foreground">Organize os materiais por tipo.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova</Button>
      </div>

      <div className="rounded-xl border">
        <ul className="divide-y">
          {(data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Tag className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {!c.is_active && <span className="text-xs text-muted-foreground">(inativa)</span>}
                </div>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
              <span className="text-xs text-muted-foreground">Ordem: {c.sort_order}</span>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      </div>

      <CategoryDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["categories"] })} />
    </div>
  );
}

function CategoryDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Category | null; onSaved: () => void;
}) {
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0); const [isActive, setIsActive] = useState(true);
  const key = editing?.id ?? "new";
  const [prev, setPrev] = useState(key);
  if (open && prev !== key) {
    setPrev(key);
    setName(editing?.name ?? ""); setDescription(editing?.description ?? "");
    setSortOrder(editing?.sort_order ?? 0); setIsActive(editing?.is_active ?? true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Nome é obrigatório.");
    const payload = { name, description, sort_order: sortOrder, is_active: isActive };
    const res = editing
      ? await db.from("file_categories").update(payload).eq("id", editing.id)
      : await db.from("file_categories").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo.");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{editing ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label>Ordem</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-3"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativa</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
