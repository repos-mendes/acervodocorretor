import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/localdb/client";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { initials, roleLabel } from "@/lib/format";
import { getSignedUrl, uploadFile } from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (session?.profile) {
      setFullName(session.profile.full_name || "");
      setPhone(session.profile.phone || "");
      setCreci(session.profile.creci || "");
      if (session.profile.avatar_url) getSignedUrl("avatars", session.profile.avatar_url).then(setAvatarUrl);
    }
  }, [session?.profile]);

  async function save() {
    if (!session) return;
    setSaving(true);
    const { error } = await db.from("profiles").update({ full_name: fullName, phone, creci }).eq("id", session.userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado.");
    qc.invalidateQueries({ queryKey: ["session"] });
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await uploadFile("avatars", path, file, true);
    if (error) { setUploading(false); return toast.error(error.message); }
    await db.from("profiles").update({ avatar_url: path }).eq("id", session.userId);
    const url = await getSignedUrl("avatars", path);
    setAvatarUrl(url);
    setUploading(false);
    toast.success("Foto atualizada.");
    qc.invalidateQueries({ queryKey: ["session"] });
  }

  async function changePassword() {
    if (newPw.length < 6) return toast.error("Mínimo 6 caracteres.");
    const { error } = await db.auth.updateUser({ password: newPw });
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada.");
    setNewPw("");
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize suas informações pessoais.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Foto e identificação</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="text-lg bg-accent text-accent-foreground">{initials(fullName || session.email)}</AvatarFallback>
          </Avatar>
          <div>
            <label className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-secondary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Alterar foto
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">{roleLabel[session.isAdmin ? "admin" : "corretor"]} · {session.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Dados pessoais</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label>CRECI</Label>
            <Input value={creci} onChange={(e) => setCreci(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Alterar senha</CardTitle>
          <CardDescription>Defina uma nova senha para o seu acesso.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input type="password" placeholder="Nova senha" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <Button variant="outline" onClick={changePassword}>Atualizar senha</Button>
        </CardContent>
      </Card>
    </div>
  );
}
