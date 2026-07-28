import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionData = {
  userId: string;
  /** Contato do usuário. Com o login por PIN, o corretor pode não ter e-mail. */
  email: string;
  profile: Profile | null;
  isAdmin: boolean;
  isActive: boolean;
};

async function fetchSession(): Promise<SessionData | null> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: profile?.email ?? "",
    profile,
    // O papel vem da sessão assinada pelo servidor, não de uma consulta que a
    // tela poderia contornar.
    isAdmin: user.role === "admin",
    isActive: profile?.status === "ativo",
  };
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });
}
