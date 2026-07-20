import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Building2, User, Shield,
  Users, Tag, Megaphone, LayoutDashboard,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";
import type { SessionData } from "@/lib/session";

type NavItem = { title: string; url: string; icon: typeof Home; exact?: boolean };

const brokerItems: NavItem[] = [
  { title: "Início", url: "/", icon: Home, exact: true },
  { title: "Empreendimentos", url: "/empreendimentos", icon: Building2 },
  { title: "Meu perfil", url: "/perfil", icon: User },
];

const adminItems: NavItem[] = [
  { title: "Painel", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Empreendimentos", url: "/admin/empreendimentos", icon: Building2 },
  { title: "Categorias", url: "/admin/categorias", icon: Tag },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Comunicados", url: "/admin/comunicados", icon: Megaphone },
];

export function AppSidebar({ session }: { session: SessionData }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 justify-center border-b px-4 py-0 group-data-[collapsible=icon]:px-0">
        <Link to="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold">Acervo</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">do Corretor</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {brokerItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                    <Link to={item.url as never}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {session.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                      <Link to={item.url as never}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
