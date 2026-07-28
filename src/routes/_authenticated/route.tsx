import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/acervo/AppSidebar";
import { UserMenu } from "@/components/acervo/UserMenu";
import { ThemeToggle } from "@/components/acervo/ThemeToggle";
import { useSession } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    // Desativado enquanto estava logado: encerra a sessão. A tela de login
    // explica o motivo quando a pessoa tentar entrar de novo.
    if (session && !session.isActive) {
      db.auth.signOut().then(() => navigate({ to: "/auth" }));
    }
    // O último acesso passou a ser registrado no servidor, na hora do login:
    // o corretor não tem permissão para escrever nessa coluna.
  }, [session, navigate]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    // open={false} fixa a barra lateral no modo ícone no desktop: não há
    // controle de expansão, e o atalho Ctrl+B fica sem efeito.
    <SidebarProvider open={false}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar session={session} />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            {/* No mobile a barra vira gaveta e ainda precisa de um botão para abrir. */}
            <SidebarTrigger className="md:hidden" />
            <Link to="/" className="hidden md:block font-display text-lg font-semibold tracking-tight">
              Acervo do Corretor
            </Link>
            <div className="ml-auto flex items-center gap-1 sm:gap-3">
              <ThemeToggle />
              <UserMenu session={session} />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
