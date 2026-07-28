import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { db } from "@/lib/db/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await db.rpc("is_admin", { _user_id: user.id });
    if (!data) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
