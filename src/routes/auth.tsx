// Tela de entrada.
//
// O corretor digita 4 dígitos e pronto — sem e-mail, sem senha, sem cadastro.
// O administrador entra por e-mail e senha, num formulário escondido atrás de
// um link discreto, porque quem usa isso é uma pessoa só.
//
// A tela tem um terceiro estado, o de configuração: enquanto não existir
// nenhum administrador no banco, ela oferece a criação do primeiro. Depois que
// ele existe, essa porta se fecha sozinha (a checagem é feita no servidor).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";

import { db } from "@/lib/db/client";
import { criarPrimeiroAdminFn, precisaConfigurarFn } from "@/lib/db/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ThemeToggle } from "@/components/acervo/ThemeToggle";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Acervo do Corretor" }] }),
  component: AuthPage,
});

type Modo = "pin" | "admin" | "configurar";

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("pin");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Já está logado? Vai direto para dentro.
  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  // Primeira vez no ar: ninguém é administrador ainda.
  useEffect(() => {
    precisaConfigurarFn()
      .then(({ precisa }) => {
        if (precisa) setModo("configurar");
      })
      .catch(() => {
        /* sem servidor: segue na tela de PIN e o erro aparece ao tentar entrar */
      });
  }, []);

  const entrou = useCallback(() => navigate({ to: "/" }), [navigate]);

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
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              Acervo do Corretor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plataforma exclusiva da equipe comercial.
            </p>
          </div>

          <Card className="border-border/60 shadow-sm">
            {erro && (
              <div className="px-6 pt-6">
                <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              </div>
            )}

            {modo === "pin" && (
              <FormularioPin
                carregando={carregando}
                setCarregando={setCarregando}
                setErro={setErro}
                aoEntrar={entrou}
              />
            )}

            {modo === "admin" && (
              <FormularioAdmin
                carregando={carregando}
                setCarregando={setCarregando}
                setErro={setErro}
                aoEntrar={entrou}
              />
            )}

            {modo === "configurar" && (
              <FormularioConfiguracao
                carregando={carregando}
                setCarregando={setCarregando}
                setErro={setErro}
                aoEntrar={entrou}
              />
            )}
          </Card>

          {modo !== "configurar" && (
            <p className="mt-6 text-center text-sm">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  setErro(null);
                  setModo(modo === "pin" ? "admin" : "pin");
                }}
              >
                {modo === "pin" ? "Sou administrador" : "Voltar para o acesso por PIN"}
              </button>
            </p>
          )}

          {modo === "pin" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Esqueceu seu PIN? Fale com o administrador.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type FormProps = {
  carregando: boolean;
  setCarregando: (v: boolean) => void;
  setErro: (v: string | null) => void;
  aoEntrar: () => void;
};

function FormularioPin({ carregando, setCarregando, setErro, aoEntrar }: FormProps) {
  const [pin, setPin] = useState("");

  async function enviar(valor: string) {
    setErro(null);
    setCarregando(true);
    const resposta = await db.auth.entrarComPin(valor);
    setCarregando(false);
    if (!resposta.ok) {
      setErro(resposta.mensagem);
      setPin(""); // limpa para a próxima tentativa
      return;
    }
    aoEntrar();
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="font-display text-xl">Digite seu PIN</CardTitle>
        <CardDescription>
          São os 4 últimos números do seu telefone, salvo se o administrador tiver informado outro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 py-2">
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={(valor) => {
              setPin(valor);
              // Entra sozinho ao completar os 4 dígitos: não há botão a apertar.
              if (valor.length === 4 && !carregando) void enviar(valor);
            }}
            disabled={carregando}
            autoFocus
            // O teclado numérico do celular abre direto.
            inputMode="numeric"
            pattern="[0-9]*"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-14 w-14 text-2xl" />
              <InputOTPSlot index={1} className="h-14 w-14 text-2xl" />
              <InputOTPSlot index={2} className="h-14 w-14 text-2xl" />
              <InputOTPSlot index={3} className="h-14 w-14 text-2xl" />
            </InputOTPGroup>
          </InputOTP>

          <p className="h-5 text-sm text-muted-foreground">
            {carregando && (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando…
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </>
  );
}

function FormularioAdmin({ carregando, setCarregando, setErro, aoEntrar }: FormProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const resposta = await db.auth.entrarComSenha(email, senha);
    setCarregando(false);
    if (!resposta.ok) {
      setErro(resposta.mensagem);
      return;
    }
    aoEntrar();
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="font-display text-xl">Acesso do administrador</CardTitle>
        <CardDescription>Entre com o e-mail e a senha cadastrados.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </CardContent>
    </>
  );
}

function FormularioConfiguracao({ carregando, setCarregando, setErro, aoEntrar }: FormProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const resposta = await criarPrimeiroAdminFn({ data: { nome, email, senha } });
    setCarregando(false);
    if (!resposta.ok) {
      setErro(resposta.mensagem);
      return;
    }
    aoEntrar();
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="font-display text-xl">Primeiro acesso</CardTitle>
        <CardDescription>
          A plataforma ainda não tem administrador. Crie o seu acesso agora — depois disso, esta
          tela não aparece mais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Seu nome</Label>
            <Input
              id="nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-config">E-mail</Label>
            <Input
              id="email-config"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-config">Senha</Label>
            <Input
              id="senha-config"
              type="password"
              required
              minLength={10}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Pelo menos 10 caracteres. Esta senha é sua e não fica guardada em texto — se perder,
              só dá para recuperar mexendo no banco.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar acesso de administrador
          </Button>
        </form>
      </CardContent>
    </>
  );
}
