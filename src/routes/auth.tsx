import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { db } from "@/lib/localdb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/acervo/ThemeToggle";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Acervo do Corretor" }] }),
  validateSearch: (s: Record<string, unknown>): { inactive?: string } => ({ inactive: s.inactive as string | undefined }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await db.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    navigate({ to: "/" });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    toast.success("Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha.");
    setMode("login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end px-4 pt-4">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Acervo do Corretor</h1>
            <p className="mt-1 text-sm text-muted-foreground">Plataforma exclusiva da equipe comercial.</p>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-xl">{mode === "login" ? "Entrar na plataforma" : "Redefinir senha"}</CardTitle>
              <CardDescription>
                {mode === "login" ? "Utilize as credenciais fornecidas pela construtora." : "Informe seu e-mail para receber o link de redefinição."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {search.inactive === "1" && (
                <Alert className="mb-4 border-destructive/30 bg-destructive/5 text-destructive">
                  <AlertDescription>Seu acesso está inativo. Contate um administrador.</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert className="mb-4 border-destructive/30 bg-destructive/5 text-destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                {mode === "login" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Entrar" : "Enviar link"}
                </Button>
              </form>
              <div className="mt-4 flex items-center justify-between text-sm">
                {mode === "login" ? (
                  <button type="button" className="text-accent hover:underline" onClick={() => { setMode("forgot"); setError(null); }}>
                    Esqueci minha senha
                  </button>
                ) : (
                  <button type="button" className="text-accent hover:underline" onClick={() => { setMode("login"); setError(null); }}>
                    Voltar para o login
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Sem acesso? Solicite o cadastro ao administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
