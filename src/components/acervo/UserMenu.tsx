import { useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/localdb/client";
import { initials, roleLabel } from "@/lib/format";
import type { SessionData } from "@/lib/session";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";

export function UserMenu({ session }: { session: SessionData }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session.profile?.avatar_url) {
      getSignedUrl("avatars", session.profile.avatar_url).then(setAvatarUrl);
    }
  }, [session.profile?.avatar_url]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await db.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = session.profile?.full_name || session.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-auto items-center gap-3 rounded-full px-2 py-1.5">
          <Avatar className="h-8 w-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium leading-tight">{name}</div>
            <div className="text-[11px] text-muted-foreground">{roleLabel[session.isAdmin ? "admin" : "corretor"]}</div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{session.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
          <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
