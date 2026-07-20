import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/localdb/client";
import type { Database } from "@/lib/localdb/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionData = {
  userId: string;
  email: string;
  profile: Profile | null;
  isAdmin: boolean;
  isActive: boolean;
};

async function fetchSession(): Promise<SessionData | null> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const isActive = profile?.status === "ativo";

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    isAdmin,
    isActive,
  };
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 60_000,
  });
}
