import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, roleLabel } from "@/lib/format";
import type { AppRole } from "@/lib/format";
import type { Profile } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        db.from("profiles").select("*").order("created_at", { ascending: false }),
        db.from("user_roles").select("*"),
      ]);
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role); roleMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: Profile) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  async function toggleStatus(userId: string, current: string) {
    const next = current === "ativo" ? "inativo" : "ativo";
    const { error } = await db.from("profiles").update({ status: next }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success(`Usuário ${next === "ativo" ? "ativado" : "desativado"}.`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function setRole(userId: string, role: AppRole, hasRole: boolean) {
    if (hasRole) {
      await db.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      await db.from("user_roles").insert({ user_id: userId, role });
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os acessos da equipe.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Novo usuário</Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papéis</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(users ?? []).map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name || "—"}</div>
                    {u.creci && <div className="text-xs text-muted-foreground">CRECI {u.creci}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className={r === "admin" ? "border-accent/40 text-accent" : ""}>
                          {r === "admin" && <Shield className="mr-1 h-3 w-3" />}
                          {roleLabel[r]}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.status === "ativo" ? "default" : "secondary"}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.last_access_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setRole(u.id, "admin", isAdmin)}>
                      {isAdmin ? "Remover admin" : "Tornar admin"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(u.id, u.status)}>
                      {u.status === "ativo" ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState<AppRole>("corretor");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!email || !password) return toast.error("Preencha e-mail e senha.");
    setLoading(true);
    // Use signUp to create the user. Trigger creates profile.
    const { data, error } = await db.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) { setLoading(false); return toast.error(error.message); }
    if (data.user) {
      await db.from("profiles").update({ full_name: name }).eq("id", data.user.id);
      if (role === "admin") await db.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
    }
    setLoading(false);
    toast.success("Usuário criado. Um e-mail de confirmação pode ter sido enviado.");
    setEmail(""); setName(""); setPassword(""); setRole("corretor");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Novo usuário</DialogTitle>
          <DialogDescription>O corretor receberá acesso com a senha temporária.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>Senha inicial</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corretor">Corretor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
