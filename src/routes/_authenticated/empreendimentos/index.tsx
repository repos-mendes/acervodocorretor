import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/localdb/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DevelopmentCard } from "@/components/acervo/DevelopmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { commercialStatusLabel } from "@/lib/format";
import type { CommercialStatus } from "@/lib/format";
import { Search, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empreendimentos/")({
  component: ListPage,
});

function ListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["published-developments"],
    queryFn: async () => {
      const { data } = await db
        .from("developments")
        .select("id, slug, name, short_description, cover_image_url, commercial_status, city, neighborhood, is_featured, sort_order")
        .eq("publication_status", "published")
        .order("is_featured", { ascending: false })
        .order("sort_order");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (status !== "all" && d.commercial_status !== status) return false;
      if (!lc) return true;
      return [d.name, d.short_description, d.city, d.neighborhood].some((f) => f?.toLowerCase().includes(lc));
    });
  }, [data, q, status]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Empreendimentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Clique em um empreendimento para abrir os materiais e baixar o que precisar.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, bairro, cidade..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {(Object.keys(commercialStatusLabel) as CommercialStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{commercialStatusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">Nenhum empreendimento encontrado</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros ou aguarde novas publicações.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DevelopmentCard key={d.id} development={d} />
          ))}
        </div>
      )}
    </div>
  );
}
