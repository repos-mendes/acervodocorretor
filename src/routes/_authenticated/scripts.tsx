import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/localdb/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { Search, Copy, Check, MessageSquareText, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: ScriptsPage,
});

type Script = {
  id: string;
  title: string;
  content: string;
  development_id: string | null;
  category: string | null;
  sort_order: number;
};

type Development = { id: string; name: string; sort_order: number };

type Group = { id: string; name: string; scripts: Script[] };

function ScriptsPage() {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["broker-scripts"],
    queryFn: async () => {
      const { data } = await db
        .from("scripts")
        .select("id, title, content, development_id, category, sort_order")
        .eq("status", "active")
        .order("sort_order");
      return (data ?? []) as Script[];
    },
  });

  // Só empreendimentos publicados: um script preso a um empreendimento fora do
  // ar não deve vazar para o corretor.
  const { data: developments } = useQuery({
    queryKey: ["published-development-names"],
    queryFn: async () => {
      const { data } = await db
        .from("developments")
        .select("id, name, sort_order")
        .eq("publication_status", "published")
        .order("sort_order");
      return (data ?? []) as Development[];
    },
  });

  const { byDevelopment, gerais, total } = useMemo(() => {
    const lc = q.trim().toLowerCase();
    const matches = (s: Script) =>
      !lc || [s.title, s.content, s.category].some((f) => f?.toLowerCase().includes(lc));

    const visible = (scripts ?? []).filter(matches);
    const published = new Map((developments ?? []).map((d) => [d.id, d]));

    const grouped = new Map<string, Script[]>();
    const soltos: Script[] = [];
    for (const s of visible) {
      if (!s.development_id) {
        soltos.push(s);
      } else if (published.has(s.development_id)) {
        if (!grouped.has(s.development_id)) grouped.set(s.development_id, []);
        grouped.get(s.development_id)!.push(s);
      }
      // Script de empreendimento despublicado: fica oculto, como os materiais.
    }

    // Mantém a ordem dos empreendimentos e descarta os que ficaram sem script.
    const groups: Group[] = (developments ?? [])
      .filter((d) => grouped.has(d.id))
      .map((d) => ({ id: d.id, name: d.name, scripts: grouped.get(d.id)! }));

    return {
      byDevelopment: groups,
      gerais: soltos,
      total: groups.reduce((n, g) => n + g.scripts.length, 0) + soltos.length,
    };
  }, [scripts, developments, q]);

  // Durante a busca todos os menus abrem, senão o resultado ficaria escondido.
  const searching = q.trim().length > 0;
  const isOpen = (id: string) => searching || expanded.has(id);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Scripts rápidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensagens prontas para o dia a dia. Clique em um script para copiar e cole onde precisar.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por assunto, texto ou categoria..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">
            {q ? "Nenhum script encontrado" : "Nenhum script cadastrado ainda"}
          </p>
          <p className="text-sm text-muted-foreground">
            {q ? "Tente outra busca." : "Os scripts publicados pela administração aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {byDevelopment.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Por empreendimento
              </h2>
              <div className="space-y-2">
                {byDevelopment.map((g) => (
                  <DevelopmentScripts
                    key={g.id}
                    group={g}
                    open={isOpen(g.id)}
                    onOpenChange={() => toggle(g.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {gerais.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Scripts gerais
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Servem para qualquer empreendimento e vários tipos de abordagem.
                </p>
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {gerais.map((s) => (
                  <ScriptCard key={s.id} script={s} showCategory />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** Menu suspenso de um empreendimento: nome na barra, scripts dentro. */
function DevelopmentScripts({
  group,
  open,
  onOpenChange,
}: {
  group: Group;
  open: boolean;
  onOpenChange: () => void;
}) {
  const count = group.scripts.length;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold">{group.name}</h3>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? "script" : "scripts"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="grid items-start gap-3 border-t bg-secondary/20 p-3 sm:grid-cols-2">
          {group.scripts.map((s) => (
            <ScriptCard key={s.id} script={s} showCategory />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ScriptCard({ script, showCategory }: { script: Script; showCategory?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(script.content);
    if (!ok) {
      toast.error("Não foi possível copiar. Tente selecionar o texto manualmente.");
      return;
    }
    setCopied(true);
    toast.success("Script copiado!");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copiar script: ${script.title}`}
      className={cn(
        "group flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left transition-all",
        copied ? "border-accent ring-1 ring-accent" : "hover:border-accent/40 hover:shadow-md",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{script.title}</h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs font-medium transition-colors",
            copied ? "text-accent" : "text-muted-foreground group-hover:text-accent",
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </span>
      </div>
      {showCategory && script.category && (
        <span className="mb-2 w-fit rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {script.category}
        </span>
      )}
      <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-5">
        {script.content}
      </p>
    </button>
  );
}
