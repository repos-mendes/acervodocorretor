import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/localdb/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Download, Eye, FileText, Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();
      const [devs, files, users, downloads, views, announcements, topDownloads] = await Promise.all([
        db.from("developments").select("id", { count: "exact", head: true }),
        db.from("development_files").select("id", { count: "exact", head: true }),
        db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        db.from("file_downloads").select("id", { count: "exact", head: true }).gte("downloaded_at", monthAgo),
        db.from("development_views").select("id", { count: "exact", head: true }).gte("viewed_at", monthAgo),
        db.from("announcements").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("development_files").select("id, title, download_count, developments(name)").order("download_count", { ascending: false }).limit(5),
      ]);
      return {
        devs: devs.count ?? 0, files: files.count ?? 0, users: users.count ?? 0,
        downloads: downloads.count ?? 0, views: views.count ?? 0,
        announcements: announcements.count ?? 0,
        topDownloads: topDownloads.data ?? [],
      };
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Painel administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Indicadores gerais da plataforma nos últimos 30 dias.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat icon={Building2} label="Empreendimentos" value={data?.devs ?? 0} />
          <Stat icon={FileText} label="Arquivos publicados" value={data?.files ?? 0} />
          <Stat icon={Users} label="Corretores ativos" value={data?.users ?? 0} />
          <Stat icon={Download} label="Downloads (30d)" value={data?.downloads ?? 0} />
          <Stat icon={Eye} label="Visualizações (30d)" value={data?.views ?? 0} />
          <Stat icon={Megaphone} label="Comunicados ativos" value={data?.announcements ?? 0} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display">Materiais mais baixados</CardTitle></CardHeader>
        <CardContent>
          {!data || data.topDownloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum download registrado ainda.</p>
          ) : (
            <ul className="divide-y">
              {data.topDownloads.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{(f.developments as { name: string } | null)?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" /> {f.download_count}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
