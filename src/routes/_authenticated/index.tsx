import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/localdb/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Sparkles, Megaphone, ArrowRight, TrendingUp } from "lucide-react";
import { useSession } from "@/lib/session";
import { SignedImage } from "@/components/acervo/SignedImage";
import { CommercialBadge, PriorityBadge } from "@/components/acervo/StatusBadge";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session } = useSession();
  const firstName = (session?.profile?.full_name || "").split(" ")[0] || "Corretor(a)";

  const { data: featured } = useQuery({
    queryKey: ["featured-developments"],
    queryFn: async () => {
      const { data } = await db
        .from("developments")
        .select("id, slug, name, short_description, cover_image_url, commercial_status, city, neighborhood")
        .eq("publication_status", "published")
        .eq("is_featured", true)
        .order("sort_order")
        .limit(6);
      return data ?? [];
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ["active-announcements"],
    queryFn: async () => {
      const { data } = await db
        .from("announcements")
        .select("id, title, content, priority, published_at, link_url, development_id")
        .eq("status", "active")
        .order("published_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["broker-stats"],
    queryFn: async () => {
      const [d, f] = await Promise.all([
        db.from("developments").select("id", { count: "exact", head: true }).eq("publication_status", "published"),
        db.from("development_files").select("id", { count: "exact", head: true }).eq("publication_status", "published"),
      ]);
      return { developments: d.count ?? 0, files: f.count ?? 0 };
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-2xl border bg-gradient-to-br from-card via-card to-secondary/40 p-6 md:p-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Bem-vindo(a) de volta</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight">Olá, {firstName}.</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Acesse os empreendimentos ativos, baixe materiais atualizados e fique por dentro dos comunicados da equipe.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link to="/empreendimentos">Ver empreendimentos <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Building2} label="Empreendimentos ativos" value={stats?.developments ?? "—"} />
          <StatCard icon={Sparkles} label="Materiais disponíveis" value={stats?.files ?? "—"} />
          <StatCard icon={TrendingUp} label="Comunicados ativos" value={announcements?.length ?? "—"} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Destaques</h2>
          <Link to="/empreendimentos" className="text-sm text-accent hover:underline">Ver todos</Link>
        </div>
        {!featured ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : featured.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum destaque no momento" description="Os empreendimentos em destaque aparecerão aqui." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((d) => (
              <Link key={d.id} to="/empreendimentos/$slug" params={{ slug: d.slug }} className="group overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg">
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <SignedImage bucket="covers" path={d.cover_image_url} alt={d.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold truncate">{d.name}</h3>
                    <CommercialBadge status={d.commercial_status} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{d.short_description || " "}</p>
                  {(d.neighborhood || d.city) && (
                    <p className="mt-3 text-xs text-muted-foreground">{[d.neighborhood, d.city].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-accent" />
          <h2 className="font-display text-xl font-semibold">Comunicados</h2>
        </div>
        {!announcements ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : announcements.length === 0 ? (
          <EmptyState icon={Megaphone} title="Sem comunicados no momento" description="Novidades da equipe aparecerão aqui." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {announcements.map((a) => (
              <Card key={a.id} className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="font-display text-base">{a.title}</CardTitle>
                    <PriorityBadge priority={a.priority} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{formatDate(a.published_at)}</p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">
                  {a.content}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-background/60 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-semibold leading-tight">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Building2; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
